import { getClientsRepository } from "../repositories/clients-repository.js";
import { getClientMetricsStatusRepository } from "../repositories/client-metrics-status-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getSpendOverviewCacheRepository } from "../repositories/spend-overview-cache-repository.js";
import type { ClientEntity } from "../types/clients.js";
import type { PlatformKey } from "./client-metrics.js";
import { callExternalApi } from "./external-clients.js";

const clientsRepository = getClientsRepository();
const projectsRepository = getProjectsRepository();

export type SpendSnapshotItem = {
  platform: "meta" | "google";
  accountId: string;
  accountName: string | null;
  isPrepaid: boolean | null;
  balanceAvailable: number | null;
  averageDailySpend: number | null;
  monthToDateSpend: number | null;
  creditLimit: number | null;
  currency: string | null;
  matchedClient: ClientEntity | null;
};

type SpendSnapshotResult = {
  items: Array<{
    clientId: string | null;
    clientName: string;
    platform: SpendSnapshotItem["platform"];
    accountId: string;
    accountName: string | null;
    isPrepaid: boolean | null;
    balanceAvailable: number | null;
    averageDailySpend: number | null;
    monthToDateSpend: number | null;
    creditLimit: number | null;
    currency: string | null;
  }>;
  cachedAt: string;
};

export async function getMetricsSummarySnapshot(orgId: string) {
  const [activeClients, archivedClients, projects] = await Promise.all([
    clientsRepository.list(orgId, { status: "active" }),
    clientsRepository.list(orgId, { status: "archived" }),
    projectsRepository.list(orgId)
  ]);

  const clientsTotal = activeClients.length + archivedClients.length;
  const projectsActive = projects.filter((project) => project.status === "active").length;
  const projectsPaused = projects.filter((project) => project.status === "paused").length;
  const onboarding = calculateOnboarding(activeClients);

  return {
    clients: {
      total: clientsTotal,
      active: activeClients.length,
      archived: archivedClients.length
    },
    projects: {
      total: projects.length,
      active: projectsActive,
      paused: projectsPaused
    },
    onboarding
  };
}

const SPEND_CACHE_TTL_MS = Number(process.env.SPEND_OVERVIEW_CACHE_TTL_MS ?? 15) * 60 * 1000; // default 15 minutes

function isCacheFresh(cachedAt: string | null): boolean {
  if (!cachedAt) return false;
  const cachedTime = new Date(cachedAt).getTime();
  if (Number.isNaN(cachedTime)) return false;
  return Date.now() - cachedTime < SPEND_CACHE_TTL_MS;
}

export async function getSpendOverviewSnapshot(orgId: string, opts: { force?: boolean } = {}): Promise<SpendSnapshotResult> {
  const cacheRepo = getSpendOverviewCacheRepository();
  const cached = await cacheRepo.get(orgId);
  if (!opts.force && cached && isCacheFresh(cached.cachedAt)) {
    return {
      items: cached.items.map((item) => ({
        clientId: item.matchedClient?.id ?? null,
        clientName: item.matchedClient?.name ?? item.accountName ?? item.accountId,
        platform: item.platform,
        accountId: item.accountId,
        accountName: item.accountName,
        isPrepaid: item.isPrepaid,
        balanceAvailable: item.balanceAvailable,
        averageDailySpend: item.averageDailySpend,
        monthToDateSpend: item.monthToDateSpend,
        creditLimit: item.creditLimit,
        currency: item.currency
      })),
      cachedAt: cached.cachedAt
    };
  }

  const clients = await clientsRepository.list(orgId, { status: "active" });

  const metaIndex = new Map<string, ClientEntity>();
  const googleIndex = new Map<string, ClientEntity>();

  clients.forEach((client) => {
    (client.metaAccountIds ?? []).forEach((id) => {
      if (typeof id === "string") {
        metaIndex.set(normalizeAccountId(id), client);
      }
    });
    (client.googleCustomerIds ?? []).forEach((id) => {
      if (typeof id === "string") {
        googleIndex.set(normalizeAccountId(id), client);
      }
    });
  });

  const [metaAccounts, googleAccounts] = await Promise.all([
    fetchMetaAccounts(metaIndex),
    fetchGoogleAccounts(googleIndex)
  ]);

  const items = [...metaAccounts, ...googleAccounts]
    .filter((item) => item.matchedClient) // garante org scoping (conta precisa casar com cliente da org)
    .map((item) => ({
      clientId: item.matchedClient?.id ?? null,
      clientName: item.matchedClient?.name ?? item.accountName ?? item.accountId,
      platform: item.platform,
      accountId: item.accountId,
      accountName: item.accountName,
      isPrepaid: item.isPrepaid,
      balanceAvailable: item.balanceAvailable,
      averageDailySpend: item.averageDailySpend,
      monthToDateSpend: item.monthToDateSpend,
      creditLimit: item.creditLimit,
      currency: item.currency
    }));

  const cachedAt = new Date().toISOString();
  await cacheRepo.save({ orgId, items: metaAccounts.concat(googleAccounts), cachedAt });

  return { items, cachedAt };
}

export async function getIntegrationStatusSnapshot(orgId: string) {
  const PLATFORMS: PlatformKey[] = ["google", "meta", "ga4"];
  const clientMetricsStatusRepository = getClientMetricsStatusRepository();
  const statuses = await clientMetricsStatusRepository.listByOrg(orgId);

  const platforms = PLATFORMS.map((platform) => {
    const counts: Record<string, number> = {
      connected: 0,
      missing: 0,
      pending: 0,
      error: 0
    };

    statuses
      .filter((status) => status.platform === platform)
      .forEach((status) => {
        counts[status.status] = (counts[status.status] ?? 0) + 1;
      });

    return {
      platform,
      statusCounts: counts
    };
  });

  const alerts = statuses
    .filter((status) => status.status === "error" || status.status === "pending")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 25);

  return {
    platforms,
    alerts
  };
}

function calculateOnboarding(clients: ClientEntity[]) {
  let pendingDirectory = 0;
  let pendingIds = 0;
  let ready = 0;

  for (const client of clients) {
    const hasDirectory = Boolean(client.integrations?.directoryId);
    const hasIds = clientHasAnyId(client);

    if (!hasDirectory) {
      pendingDirectory += 1;
    } else if (!hasIds) {
      pendingIds += 1;
    } else {
      ready += 1;
    }
  }

  return {
    pendingDirectory,
    pendingIds,
    ready
  };
}

function clientHasAnyId(client: ClientEntity): boolean {
  return (
    (client.googleCustomerIds?.length ?? 0) > 0 ||
    (client.metaAccountIds?.length ?? 0) > 0 ||
    (client.ga4PropertyIds?.length ?? 0) > 0
  );
}

function normalizeAccountId(value: string): string {
  return value.replace(/^act_/i, "").replace(/[^a-zA-Z0-9]/g, "").trim().toLowerCase();
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function convertMinorToCurrency(value: unknown): number | null {
  const parsed = coerceNumber(value);
  if (parsed === null) {
    return null;
  }
  return parsed / 100;
}

function convertMicrosToCurrency(value: unknown): number | null {
  const parsed = coerceNumber(value);
  if (parsed === null) {
    return null;
  }
  return parsed / 1_000_000;
}

function extractAccounts(payload: unknown): Array<Record<string, unknown>> {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.accounts)) {
      return record.accounts as Array<Record<string, unknown>>;
    }
    if (record.data && typeof record.data === "object") {
      const nested = record.data as Record<string, unknown>;
      if (Array.isArray(nested.accounts)) {
        return nested.accounts as Array<Record<string, unknown>>;
      }
    }
  }
  return [];
}

function normalizePrepaidFlag(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "prepaid", "pre-paid", "prepaid_card", "prepaidcard"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "postpaid", "credit", "card", "post-paid"].includes(normalized)) {
      return false;
    }
  }
  return null;
}

async function fetchMetaAccounts(index: Map<string, ClientEntity>): Promise<SpendSnapshotItem[]> {
  try {
    const response = await callExternalApi({
      path: "/meta/accounts"
    });

    const accounts = extractAccounts(response);

    return accounts.map((account) => {
      const accountId = String(account.id ?? account.accountId ?? "");
      const accountName = typeof account.name === "string" ? account.name : null;
      const billingInfo =
        (account.billingInfo as Record<string, unknown> | undefined) ??
        (account.billing_info as Record<string, unknown> | undefined);
      const fundingInfo =
        (account.fundingInfo as Record<string, unknown> | undefined) ??
        (account.funding_info as Record<string, unknown> | undefined);
      const isPrepaid =
        normalizePrepaidFlag(
          account.isPrepaid ??
            (account as Record<string, unknown>).isPrePaid ??
            (account as Record<string, unknown>).prepaid
        ) ??
        normalizePrepaidFlag(account.billingType ?? account.fundingType ?? account.fundingSource) ??
        normalizePrepaidFlag(
          billingInfo?.isPrepaid ?? billingInfo?.is_prepaid ?? billingInfo?.prepaid ?? billingInfo?.type
        ) ??
        normalizePrepaidFlag(fundingInfo?.type ?? fundingInfo?.mode ?? fundingInfo?.category);
      const balanceAvailable =
        coerceNumber((account.balance as Record<string, unknown>)?.available) ??
        coerceNumber(account.availableBalance) ??
        convertMinorToCurrency(account.storedBalanceMinor ?? account.balanceMinor);
      const monthToDateSpend =
        coerceNumber((account.spend as Record<string, unknown>)?.monthToDate) ??
        coerceNumber(account.monthToDateSpend) ??
        coerceNumber(account.spendMonth) ??
        convertMinorToCurrency(account.currentMonthCostMinor) ??
        coerceNumber(account.currentMonthCostBRL);
      const averageDailySpend =
        coerceNumber((account.spend as Record<string, unknown>)?.averageDaily) ??
        coerceNumber(account.averageDailySpend) ??
        coerceNumber(account.dailySpend) ??
        convertMinorToCurrency(account.averageDailySpendMinor) ??
        coerceNumber(account.averageDailySpendBRL);
      const currency =
        typeof (account.balance as Record<string, unknown>)?.currency === "string"
          ? ((account.balance as Record<string, unknown>).currency as string)
          : typeof account.currency === "string"
            ? (account.currency as string)
            : "BRL";
      const creditLimit =
        coerceNumber(account.creditLimit ?? (account.limit as Record<string, unknown>)?.amount) ??
        convertMinorToCurrency(account.spendCapMinor ?? account.storedBalanceMinor);
      const key = normalizeAccountId(accountId);
      const matchedClient = index.get(key) ?? null;

      return {
        platform: "meta" as const,
        accountId,
        accountName,
        isPrepaid,
        balanceAvailable,
        averageDailySpend,
        monthToDateSpend,
        creditLimit,
        currency,
        matchedClient
      };
    });
  } catch (error) {
    requestLogger("meta", error);
    return [];
  }
}

async function fetchGoogleAccounts(index: Map<string, ClientEntity>): Promise<SpendSnapshotItem[]> {
  try {
    const response = await callExternalApi({
      path: "/google/accounts",
      query: { activeOnly: "true" }
    });
    const accounts = extractAccounts(response);

    return accounts.map((account) => {
      const accountId = String(account.id ?? account.customerId ?? "");
      const accountName = typeof account.name === "string" ? account.name : null;
      const metrics = (account.metrics as Record<string, unknown>) ?? {};
      const monthToDateSpend =
        convertMicrosToCurrency(metrics.currentMonthCostMicros ?? account.currentMonthCostMicros) ??
        convertMicrosToCurrency(account.last7DaysCostMicros) ??
        null;
      const averageDailySpend =
        convertMicrosToCurrency(metrics.averageDailyCostMicros ?? account.averageDailyCostMicros) ?? null;
      const creditLimit = coerceNumber(account.creditLimit ?? (account.limit as Record<string, unknown>)?.amount);
      const currency = typeof account.currency === "string" ? (account.currency as string) : "BRL";
      const key = normalizeAccountId(accountId);
      const matchedClient = index.get(key) ?? null;

      return {
        platform: "google" as const,
        accountId,
        accountName,
        isPrepaid: null,
        balanceAvailable: null,
        averageDailySpend,
        monthToDateSpend,
        creditLimit,
        currency,
        matchedClient
      };
    });
  } catch (error) {
    requestLogger("google", error);
    return [];
  }
}

function requestLogger(platform: string, error: unknown): void {
  console.warn(`[metrics] Falha ao buscar contas ${platform}:`, error);
}
