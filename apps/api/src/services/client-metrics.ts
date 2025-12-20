import { env } from "../env.js";
import type { ClientIntegrationInfo } from "../types/clients.js";
import { ClientMetricsCacheEntity, getClientMetricsCacheRepository } from "../repositories/client-metrics-cache-repository.js";
import { callExternalApi, callExternalGa4, callExternalMcp } from "./external-clients.js";

export type MetricsRange = "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "LAST_MONTH";

export type PlatformKey = "google" | "meta" | "ga4";

export type PlatformTotals = {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  cpc: number | null;
  ctr: number | null;
  revenue: number | null;
};

export type PlatformKpiFormat = "currency" | "number" | "percent";

export type PlatformKpi = {
  key: string;
  label: string;
  value: number | null;
  format?: PlatformKpiFormat;
  precision?: number;
};

export type PlatformSummary = {
  platform: PlatformKey;
  status: "connected" | "missing" | "error" | "pending";
  message?: string;
  totals: PlatformTotals;
  lastSynced: string | null;
  raw?: unknown;
  kpis?: PlatformKpi[];
};

export type ClientMetricsSummary = {
  range: MetricsRange;
  generatedAt: string;
  platforms: PlatformSummary[];
};

const EMPTY_TOTALS: PlatformTotals = {
  spend: null,
  impressions: null,
  clicks: null,
  conversions: null,
  cpc: null,
  ctr: null,
  revenue: null
};

const GA4_METRIC_NAMES = [
  "sessions",
  "newUsers",
  "screenPageViews",
  "eventCount",
  "conversions",
  "purchaseRevenue"
] as const;

const GA4_DEFAULT_DIMENSIONS = [
  {
    name: "date"
  }
] as const;

const GA4_REPORT_LIMIT = 1000;

type NormalizedPayload = {
  totals: PlatformTotals;
  lastSynced: string | null;
  metricsMap?: Record<string, number | null>;
  kpis?: PlatformKpi[];
};

type DateRange = {
  startDate: string;
  endDate: string;
};

type MetricsContext = {
  orgId: string;
  clientId: string;
  clientName: string;
};

type ClientIdentifiers = {
  googleCustomerIds: string[];
  metaAccountIds: string[];
  ga4PropertyIds: string[];
};

type ClientMetricsSource = ClientIdentifiers & {
  integrations: ClientIntegrationInfo | null;
};

const META_RANGE_MAP: Record<MetricsRange, string> = {
  LAST_7_DAYS: "last_7d",
  LAST_30_DAYS: "last_30d",
  THIS_MONTH: "this_month",
  LAST_MONTH: "last_month"
};

type MetaActionCategoryKey = "sales" | "leads" | "messages" | "clicks";

const META_ACTION_CATEGORIES: Array<{
  key: MetaActionCategoryKey;
  label: string;
  actionTypes: string[];
}> = [
  {
    key: "sales",
    label: "Vendas",
    actionTypes: [
      "purchase",
      "omni_purchase",
      "onsite_conversion.purchase",
      "offsite_conversion.fb_pixel_purchase",
      "onsite_conversion.fb_pixel_purchase"
    ]
  },
  {
    key: "leads",
    label: "Leads",
    actionTypes: ["lead", "omni_lead", "onsite_conversion.lead", "offsite_conversion.fb_pixel_lead"]
  },
  {
    key: "messages",
    label: "Mensagens",
    actionTypes: [
      "messaging_conversation_started_7d",
      "onsite_conversion.messaging_first_reply",
      "messaging_first_reply",
      "onsite_conversion.messaging_conversation_started_7d"
    ]
  },
  {
    key: "clicks",
    label: "Cliques qualificados",
    actionTypes: ["link_click", "unique_link_click", "outbound_click", "landing_page_view"]
  }
];

const META_ACTION_METRIC_KEYS: Record<MetaActionCategoryKey, string> = {
  sales: "meta:conversions:sales",
  leads: "meta:conversions:leads",
  messages: "meta:conversions:messages",
  clicks: "meta:conversions:clicks"
};

const metricsCacheRepository = getClientMetricsCacheRepository();
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 dias

function startOfUTCMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

function resolveMetaRange(range: MetricsRange): string {
  return META_RANGE_MAP[range] ?? "last_30d";
}

function resolveGa4DateRange(range: MetricsRange): DateRange {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  switch (range) {
    case "LAST_7_DAYS": {
      const end = addUtcDays(todayUtc, -1);
      const start = addUtcDays(todayUtc, -7);
      return { startDate: formatUTCDate(start), endDate: formatUTCDate(end) };
    }
    case "LAST_30_DAYS": {
      const end = addUtcDays(todayUtc, -1);
      const start = addUtcDays(todayUtc, -30);
      return { startDate: formatUTCDate(start), endDate: formatUTCDate(end) };
    }
    case "THIS_MONTH": {
      const start = startOfUTCMonth(todayUtc);
      return { startDate: formatUTCDate(start), endDate: formatUTCDate(todayUtc) };
    }
    case "LAST_MONTH": {
      const currentMonthStart = startOfUTCMonth(todayUtc);
      const lastMonthEnd = addUtcDays(currentMonthStart, -1);
      const lastMonthStart = startOfUTCMonth(lastMonthEnd);
      return { startDate: formatUTCDate(lastMonthStart), endDate: formatUTCDate(lastMonthEnd) };
    }
    default:
      return { startDate: formatUTCDate(todayUtc), endDate: formatUTCDate(todayUtc) };
  }
}

async function saveMetricsCache(
  context: MetricsContext,
  platform: PlatformKey,
  range: MetricsRange,
  payload: NormalizedPayload
): Promise<void> {
  await metricsCacheRepository.save({
    id: "",
    orgId: context.orgId,
    clientId: context.clientId,
    platform,
    range,
    totals: payload.totals,
    lastSynced: payload.lastSynced ?? null,
    cachedAt: "",
    kpis: payload.kpis
  });
}

async function loadMetricsCache(
  context: MetricsContext,
  platform: PlatformKey,
  range: MetricsRange
): Promise<ClientMetricsCacheEntity | null> {
  const cached = await metricsCacheRepository.get(context.orgId, context.clientId, platform, range);
  if (!cached) {
    return null;
  }
  const cachedTime = Date.parse(cached.cachedAt);
  if (Number.isFinite(cachedTime) && Date.now() - cachedTime > CACHE_TTL_MS) {
    return null;
  }
  return cached;
}

function buildSummaryFromCache(
  platform: PlatformKey,
  cached: ClientMetricsCacheEntity,
  reason: string
): PlatformSummary {
  const formatted = new Date(cached.cachedAt).toLocaleString("pt-BR");
  return {
    platform,
    status: "connected",
    message: `Mostrando dados salvos em ${formatted}. ${reason}`,
    totals: cached.totals,
    lastSynced: cached.lastSynced ?? cached.cachedAt,
    kpis: cached.kpis ?? buildDefaultKpisFromTotals(cached.totals)
  };
}

function coerceNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function extractPayload(response: unknown): Record<string, unknown> {
  if (response && typeof response === "object") {
    const payloadCandidate = response as Record<string, unknown>;
    if (payloadCandidate.body && typeof payloadCandidate.body === "object") {
      return payloadCandidate.body as Record<string, unknown>;
    }
    if (payloadCandidate.data && typeof payloadCandidate.data === "object") {
      return payloadCandidate.data as Record<string, unknown>;
    }
    return payloadCandidate;
  }
  return {};
}

function collectMetaActions(source: Record<string, unknown>): Array<Record<string, unknown>> {
  const collected: Array<Record<string, unknown>> = [];
  const pushEntry = (actionType: string, value: unknown) => {
    const numeric = coerceNumber(value);
    if (numeric === null) {
      return;
    }
    collected.push({ action_type: actionType, value: numeric });
  };
  const addFromArray = (value: unknown) => {
    if (!Array.isArray(value)) {
      return;
    }
    for (const entry of value) {
      if (entry && typeof entry === "object") {
        collected.push(entry as Record<string, unknown>);
      }
    }
  };
  const addFromRecord = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }
    for (const [actionType, rawValue] of Object.entries(value as Record<string, unknown>)) {
      if (typeof actionType !== "string" || !actionType) {
        continue;
      }
      pushEntry(actionType, rawValue);
    }
  };
  const addFrom = (value: unknown) => {
    addFromArray(value);
    addFromRecord(value);
  };

  addFrom(source.actions);

  const totals = source.totals;
  if (totals && typeof totals === "object") {
    addFrom((totals as Record<string, unknown>).actions);
  }

  const dataField = source.data;
  if (Array.isArray(dataField)) {
    for (const item of dataField) {
      if (item && typeof item === "object") {
        addFrom((item as Record<string, unknown>).actions);
      }
    }
  } else if (dataField && typeof dataField === "object") {
    addFrom((dataField as Record<string, unknown>).actions);
  }

  return collected;
}

type MetaActionSummary = {
  total: number | null;
  categories: Partial<Record<MetaActionCategoryKey, number>>;
};

function summarizeMetaActions(
  payload: Record<string, unknown>,
  metrics: Record<string, unknown>
): MetaActionSummary {
  const entries = [...collectMetaActions(payload)];
  if (metrics !== payload) {
    entries.push(...collectMetaActions(metrics));
  }
  if (entries.length === 0) {
    return { total: null, categories: {} };
  }
  const totals = new Map<string, number>();
  for (const entry of entries) {
    const typeField = (entry as Record<string, unknown>).action_type ?? (entry as Record<string, unknown>).actionType;
    const type = typeof typeField === "string" ? typeField : null;
    if (!type) {
      continue;
    }
    const value = coerceNumber(
      entry.value ??
        entry.count ??
        entry.total ??
        (typeof (entry as Record<string, unknown>)["1d_view"] === "number"
          ? (entry as Record<string, unknown>)["1d_view"]
          : null)
    );
    if (value === null) {
      continue;
    }
    totals.set(type, (totals.get(type) ?? 0) + value);
  }

  const categories: Partial<Record<MetaActionCategoryKey, number>> = {};
  for (const category of META_ACTION_CATEGORIES) {
    let sum = 0;
    for (const type of category.actionTypes) {
      const value = totals.get(type);
      if (typeof value === "number") {
        sum += value;
      }
    }
    if (sum > 0) {
      categories[category.key] = sum;
    }
  }

  let aggregate = 0;
  totals.forEach((value) => {
    aggregate += value;
  });

  return {
    total: totals.size > 0 ? aggregate : null,
    categories
  };
}

function normalizeMetrics(response: unknown): NormalizedPayload {
  const payload = extractPayload(response);
  const metrics =
    (payload.metrics && typeof payload.metrics === "object"
      ? (payload.metrics as Record<string, unknown>)
      : (payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : {})) ?? {};

  const totals =
    metrics && typeof metrics.totals === "object" && metrics.totals !== null
      ? (metrics.totals as Record<string, unknown>)
      : metrics;

  const numberFrom = (...candidates: Array<unknown>): number | null => {
    for (const candidate of candidates) {
      const value = coerceNumber(candidate);
      if (value !== null) {
        return value;
      }
    }
    return null;
  };

  let spend =
    numberFrom(
      totals.spend,
      totals.total_spend,
      totals.totalSpend,
      totals.amount,
      totals.amount_spent,
      totals.amountSpent,
      totals.spend_amount,
      metrics.spend,
      metrics.total_spend,
      metrics.totalSpend,
      metrics.amount,
      metrics.amount_spent,
      metrics.amountSpent
    ) ?? null;
  if (spend === null) {
    const micros =
      numberFrom(
        totals.cost_micros,
        totals.costMicros,
        totals.total_cost_micros,
        totals.totalCostMicros,
        metrics.cost_micros,
        metrics.costMicros,
        payload.cost_micros,
        payload.costMicros
      ) ?? null;
    spend = micros !== null ? micros / 1_000_000 : null;
  }

  const impressions = numberFrom(
    totals.impressions,
    totals.total_impressions,
    totals.totalImpressions,
    metrics.impressions,
    metrics.total_impressions,
    metrics.totalImpressions
  );
  const clicks = numberFrom(
    totals.clicks,
    totals.total_clicks,
    totals.totalClicks,
    metrics.clicks,
    metrics.total_clicks,
    metrics.totalClicks
  );
  const metaActions = summarizeMetaActions(payload, metrics);
  const conversions =
    numberFrom(
      totals.conversions,
      totals.total_conversions,
      totals.totalConversions,
      metrics.conversions,
      metrics.total_conversions,
      metrics.totalConversions
    ) ?? metaActions.total;
  let cpc =
    numberFrom(
      totals.cpc,
      totals.average_cpc,
      totals.avg_cpc,
      totals.averageCpc,
      totals.avgCpc,
      metrics.cpc,
      metrics.average_cpc,
      metrics.avg_cpc,
      metrics.averageCpc,
      metrics.avgCpc
    ) ?? null;
  if (cpc === null) {
    const cpcMicros =
      numberFrom(
        totals.cpc_micros,
        totals.cpcMicros,
        totals.average_cpc_micros,
        totals.averageCpcMicros,
        totals.avg_cpc_micros,
        totals.avgCpcMicros,
        metrics.cpc_micros,
        metrics.cpcMicros,
        metrics.average_cpc_micros,
        metrics.averageCpcMicros,
        metrics.avg_cpc_micros,
        metrics.avgCpcMicros
      ) ?? null;
    cpc = cpcMicros !== null ? cpcMicros / 1_000_000 : null;
  }
  const ctr = numberFrom(totals.ctr, totals.total_ctr, metrics.ctr, metrics.total_ctr);
  const revenue = numberFrom(
    totals.revenue,
    totals.total_revenue,
    totals.conversion_value,
    totals.conversionValue,
    totals.total_conversion_value,
    totals.totalConversionValue,
    totals.conversions_value,
    totals.conversionsValue,
    totals.purchase_value,
    totals.purchaseValue,
    metrics.revenue,
    metrics.total_revenue,
    metrics.conversion_value,
    metrics.conversionValue,
    metrics.total_conversion_value,
    metrics.totalConversionValue,
    metrics.purchase_value,
    metrics.purchaseValue,
    payload.revenue,
    payload.value,
    payload.total_revenue,
    payload.conversion_value,
    payload.conversionValue,
    payload.total_conversion_value,
    payload.totalConversionValue,
    payload.purchase_value,
    payload.purchaseValue
  );

  const lastSynced =
    typeof payload.updatedAt === "string"
      ? payload.updatedAt
      : typeof payload.timestamp === "string"
        ? payload.timestamp
        : null;

  const metricsMap: Record<string, number | null> = {
    spend,
    impressions,
    clicks,
    conversions,
    cpc,
    ctr,
    revenue
  };

  if (Object.keys(metaActions.categories).length > 0) {
    for (const category of META_ACTION_CATEGORIES) {
      const value = metaActions.categories[category.key] ?? null;
      metricsMap[META_ACTION_METRIC_KEYS[category.key]] = value ?? null;
    }
  }

  return {
    totals: {
      spend,
      impressions,
      clicks,
      conversions,
      cpc,
      ctr,
      revenue
    },
    lastSynced,
    metricsMap
  };
}

type Ga4Row = {
  metricValues?: Array<{ value?: string } | null> | null;
};

type Ga4Payload = {
  rows?: Ga4Row[] | null;
  metricHeaders?: Array<{ name?: string | null } | null> | null;
  updatedAt?: string;
};

function normalizeGa4RunReport(response: unknown): NormalizedPayload {
  const payload = extractPayload(response) as Ga4Payload;
  const rows = Array.isArray(payload?.rows) ? (payload.rows as Ga4Row[]) : [];
  const metricHeaders = Array.isArray(payload?.metricHeaders) ? payload.metricHeaders : [];
  const accumulator: Record<string, number> = {};

  for (const row of rows) {
    if (!row?.metricValues) {
      continue;
    }
    row.metricValues.forEach((metricValue, index) => {
      const header = metricHeaders[index];
      const headerName = header?.name;
      if (!headerName) {
        return;
      }
      const numeric = coerceNumber(metricValue?.value ?? null);
      if (numeric === null) {
        return;
      }
      accumulator[headerName] = (accumulator[headerName] ?? 0) + numeric;
    });
  }

  const getMetric = (name: string): number | null => {
    return accumulator[name] ?? null;
  };

  const metricsMap: Record<string, number | null> = {};
  for (const [key, value] of Object.entries(accumulator)) {
    metricsMap[key] = value;
  }

  const sessions = getMetric("sessions");
  const screenPageViews = getMetric("screenPageViews") ?? getMetric("views");
  const conversions = getMetric("conversionEventCount") ?? getMetric("conversions");
  const events = getMetric("eventCount");
  const revenue = getMetric("purchaseRevenue") ?? getMetric("totalRevenue");

  return {
    totals: {
      spend: null,
      impressions: screenPageViews,
      clicks: sessions,
      conversions,
      cpc: null,
      ctr: null,
      revenue
    },
    lastSynced: typeof payload?.updatedAt === "string" ? payload.updatedAt : null,
    metricsMap
  };
}

function buildDefaultKpisFromTotals(totals: PlatformTotals): PlatformKpi[] {
  return [
    { key: "spend", label: "Investimento", value: totals.spend, format: "currency" },
    { key: "clicks", label: "Cliques", value: totals.clicks, format: "number" },
    { key: "impressions", label: "Impressões", value: totals.impressions, format: "number" },
    { key: "conversions", label: "Conversões", value: totals.conversions, format: "number" },
    { key: "cpc", label: "CPC médio", value: totals.cpc, format: "currency", precision: 2 },
    { key: "ctr", label: "CTR", value: totals.ctr, format: "percent" }
  ];
}

function buildGoogleKpis(payload: NormalizedPayload): PlatformKpi[] {
  const totals = payload.totals;
  return [
    { key: "spend", label: "Investimento", value: totals.spend, format: "currency" },
    { key: "revenue", label: "Receita", value: totals.revenue, format: "currency" },
    { key: "impressions", label: "Impressões", value: totals.impressions, format: "number" },
    { key: "clicks", label: "Cliques", value: totals.clicks, format: "number" },
    { key: "conversions", label: "Conversões", value: totals.conversions, format: "number" },
    { key: "cpc", label: "CPC médio", value: totals.cpc, format: "currency", precision: 2 },
    { key: "ctr", label: "CTR", value: totals.ctr, format: "percent" }
  ];
}

function buildMetaKpis(payload: NormalizedPayload): PlatformKpi[] {
  const totals = payload.totals;
  const metrics = payload.metricsMap ?? {};
  const actionKpis: PlatformKpi[] = META_ACTION_CATEGORIES.map((category) => ({
    key: META_ACTION_METRIC_KEYS[category.key],
    label: category.label,
    value: metrics[META_ACTION_METRIC_KEYS[category.key]] ?? null,
    format: "number"
  }));
  return [
    { key: "spend", label: "Investimento", value: totals.spend, format: "currency" },
    { key: "revenue", label: "Receita", value: totals.revenue, format: "currency" },
    { key: "impressions", label: "Impressões", value: totals.impressions, format: "number" },
    { key: "clicks", label: "Cliques", value: totals.clicks, format: "number" },
    { key: "ctr", label: "CTR", value: totals.ctr, format: "percent" },
    { key: "cpc", label: "CPC médio", value: totals.cpc, format: "currency", precision: 2 },
    { key: "conversions", label: "Conversões (total)", value: totals.conversions, format: "number" },
    ...actionKpis
  ];
}

function buildGa4Kpis(payload: NormalizedPayload): PlatformKpi[] {
  const metrics = payload.metricsMap ?? {};
  const getMetric = (name: string): number | null => {
    const value = metrics[name];
    return value ?? null;
  };
  const sessions = getMetric("sessions") ?? payload.totals.clicks;
  const newUsers = getMetric("newUsers") ?? getMetric("totalUsers");
  const visits = getMetric("screenPageViews") ?? getMetric("views") ?? payload.totals.impressions;
  const events = getMetric("eventCount");
  const conversionEvents =
    getMetric("conversionEventCount") ?? getMetric("conversions") ?? payload.totals.conversions;
  const revenue = getMetric("purchaseRevenue") ?? payload.totals.revenue;

  return [
    { key: "sessions", label: "Sess?es", value: sessions, format: "number" },
    { key: "newUsers", label: "Novos usu?rios", value: newUsers, format: "number" },
    { key: "screenPageViews", label: "Visitas", value: visits, format: "number" },
    { key: "eventCount", label: "Eventos", value: events, format: "number" },
    {
      key: "conversionEventCount",
      label: "Eventos de convers?o",
      value: conversionEvents,
      format: "number"
    },
    { key: "purchaseRevenue", label: "Receita", value: revenue, format: "currency" }
  ];
}

function getKpisForPlatform(platform: PlatformKey, payload: NormalizedPayload): PlatformKpi[] {
  switch (platform) {
    case "google":
      return buildGoogleKpis(payload);
    case "meta":
      return buildMetaKpis(payload);
    case "ga4":
      return buildGa4Kpis(payload);
    default:
      return buildDefaultKpisFromTotals(payload.totals);
  }
}

function normalizeGa4PropertyId(identifier: string): string {
  return identifier.replace(/^properties\//i, "").trim();
}

function pickIdentifiers(
  preferred?: string[] | null,
  fallback?: string[] | null,
  transform?: (value: string) => string
): string[] {
  const normalizeList = (source?: string[] | null) => {
    if (!Array.isArray(source)) {
      return [];
    }
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const item of source) {
      if (typeof item !== "string") {
        continue;
      }
      const transformed = transform ? transform(item) : item;
      const trimmed = transformed.trim();
      if (!trimmed || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      normalized.push(trimmed);
    }
    return normalized;
  };

  const primary = normalizeList(preferred);
  if (primary.length > 0) {
    return primary;
  }
  return normalizeList(fallback);
}

function resolveClientIdentifiers(source: ClientMetricsSource): ClientIdentifiers {
  return {
    googleCustomerIds: pickIdentifiers(
      source.googleCustomerIds,
      source.integrations?.googleCustomerIds
    ),
    metaAccountIds: pickIdentifiers(
      source.metaAccountIds,
      source.integrations?.metaAccountIds
    ),
    ga4PropertyIds: pickIdentifiers(
      source.ga4PropertyIds,
      source.integrations?.ga4PropertyIds,
      normalizeGa4PropertyId
    )
  };
}

async function fetchGoogleSummary(
  context: MetricsContext,
  identifiers: ClientIdentifiers,
  integrations: ClientIntegrationInfo | null,
  range: MetricsRange
): Promise<PlatformSummary> {
  if (!identifiers.googleCustomerIds.length) {
    return {
      platform: "google",
      status: "missing",
      message: "N?o se aplica (cliente sem integra??o Google Ads).",
      totals: EMPTY_TOTALS,
      lastSynced: null
    };
  }

  const [customerId] = identifiers.googleCustomerIds;
  const loginCustomerId =
    (integrations?.directorySnapshot?.["googleLoginCustomerId"] as string | undefined) ?? undefined;

  try {
    const response = await callExternalApi({
      path: `/google/accounts/${customerId}/summary`,
      query: {
        range,
        loginCustomerId
      }
    });
    const normalized = normalizeMetrics(response);
    const lastSynced = normalized.lastSynced ?? new Date().toISOString();
    const kpis = getKpisForPlatform("google", normalized);
    const summary: PlatformSummary = {
      platform: "google",
      status: "connected",
      totals: normalized.totals,
      lastSynced,
      raw: response,
      kpis
    };
    await saveMetricsCache(context, "google", range, { ...normalized, lastSynced, kpis });
    return summary;
  } catch (error) {
    const cached = await loadMetricsCache(context, "google", range);
    if (cached) {
      return buildSummaryFromCache("google", cached, "Google Ads n?o respondeu agora.");
    }
    return {
      platform: "google",
      status: "error",
      message: (error as Error).message,
      totals: EMPTY_TOTALS,
      lastSynced: null
    };
  }
}

async function fetchMetaSummary(
  context: MetricsContext,
  identifiers: ClientIdentifiers,
  range: MetricsRange
): Promise<PlatformSummary> {
  if (!identifiers.metaAccountIds.length) {
    return {
      platform: "meta",
      status: "missing",
      message: "N?o se aplica (cliente sem integra??o Meta Ads).",
      totals: EMPTY_TOTALS,
      lastSynced: null
    };
  }

  const [accountId] = identifiers.metaAccountIds;

  try {
    const response = await callExternalApi({
      path: `/meta/accounts/${accountId}/summary`,
      query: {
        range: resolveMetaRange(range)
      }
    });
    const normalized = normalizeMetrics(response);
    const lastSynced = normalized.lastSynced ?? new Date().toISOString();
    const kpis = getKpisForPlatform("meta", normalized);
    const summary: PlatformSummary = {
      platform: "meta",
      status: "connected",
      totals: normalized.totals,
      lastSynced,
      raw: response,
      kpis
    };
    await saveMetricsCache(context, "meta", range, { ...normalized, lastSynced, kpis });
    return summary;
  } catch (error) {
    const cached = await loadMetricsCache(context, "meta", range);
    if (cached) {
      return buildSummaryFromCache("meta", cached, "Meta Ads n?o respondeu agora.");
    }
    return {
      platform: "meta",
      status: "error",
      message: (error as Error).message,
      totals: EMPTY_TOTALS,
      lastSynced: null
    };
  }
}

async function fetchGa4Summary(
  context: MetricsContext,
  identifiers: ClientIdentifiers,
  range: MetricsRange
): Promise<PlatformSummary> {
  if (!identifiers.ga4PropertyIds.length) {
    return {
      platform: "ga4",
      status: "missing",
      message: "N?o se aplica (cliente sem propriedades GA4).",
      totals: EMPTY_TOTALS,
      lastSynced: null
    };
  }

  const [rawPropertyId] = identifiers.ga4PropertyIds;
  const propertyId = rawPropertyId ? normalizeGa4PropertyId(rawPropertyId) : "";
  if (!propertyId) {
    return {
      platform: "ga4",
      status: "missing",
      message: "N?o se aplica (cliente sem propriedades GA4).",
      totals: EMPTY_TOTALS,
      lastSynced: null
    };
  }
  let lastError: Error | null = null;

  if (env.EXTERNAL_GA4_TOKEN) {
    try {
      const { startDate, endDate } = resolveGa4DateRange(range);
      const response = await callExternalGa4({
        path: `/ga4/properties/${propertyId}/runReport`,
        method: "POST",
        body: {
          dimensions: [...GA4_DEFAULT_DIMENSIONS],
          metrics: GA4_METRIC_NAMES.map((name) => ({ name })),
          dateRanges: [{ startDate, endDate }],
          limit: GA4_REPORT_LIMIT
        }
      });
      const normalized = normalizeGa4RunReport(response);
      const lastSynced = normalized.lastSynced ?? new Date().toISOString();
      const kpis = getKpisForPlatform("ga4", normalized);
      const summary: PlatformSummary = {
        platform: "ga4",
        status: "connected",
        totals: normalized.totals,
        lastSynced,
        raw: response,
        kpis
      };
      await saveMetricsCache(context, "ga4", range, { ...normalized, lastSynced, kpis });
      return summary;
    } catch (error) {
      lastError = error as Error;
    }
  } else if (!lastError) {
    lastError = new Error("EXTERNAL_GA4_TOKEN not configured");
  }

  try {
    const response = await callExternalMcp({
      path: "/tools/ga4_summary/call",
      method: "POST",
      body: {
        args: {
          propertyId,
          range,
          metrics: GA4_METRIC_NAMES
        }
      }
    });
    const normalized = normalizeMetrics(response);
    const lastSynced = normalized.lastSynced ?? new Date().toISOString();
    const kpis = getKpisForPlatform("ga4", normalized);
    const summary: PlatformSummary = {
      platform: "ga4",
      status: "connected",
      totals: normalized.totals,
      lastSynced,
      raw: response,
      kpis
    };
    await saveMetricsCache(context, "ga4", range, { ...normalized, lastSynced, kpis });
    return summary;
  } catch (error) {
    if (!lastError) {
      lastError = error as Error;
    }
  }

  const message = lastError?.message ?? "Falha ao consultar GA4.";
  const status: PlatformSummary["status"] =
    message.includes("EXTERNAL_GA4_TOKEN") || message.includes("EXTERNAL_MCP_TOKEN") ? "pending" : "error";

  const cached = await loadMetricsCache(context, "ga4", range);
  if (cached) {
    return buildSummaryFromCache("ga4", cached, "GA4 n?o respondeu agora.");
  }

  return {
    platform: "ga4",
    status,
    message,
    totals: EMPTY_TOTALS,
    lastSynced: null
  };
}

export async function fetchClientMetricsSummary(
  context: MetricsContext,
  client: ClientMetricsSource,
  range: MetricsRange = "LAST_7_DAYS"
): Promise<ClientMetricsSummary> {
  const generatedAt = new Date().toISOString();
  const identifiers = resolveClientIdentifiers(client);
  const [google, meta, ga4] = await Promise.all([
    fetchGoogleSummary(context, identifiers, client.integrations, range),
    fetchMetaSummary(context, identifiers, range),
    fetchGa4Summary(context, identifiers, range)
  ]);

  return {
    range,
    generatedAt,
    platforms: [google, meta, ga4]
  };
}

export async function getCachedClientMetricsSummary(
  context: MetricsContext,
  client: ClientMetricsSource,
  range: MetricsRange = "LAST_7_DAYS"
): Promise<ClientMetricsSummary> {
  const generatedAt = new Date().toISOString();
  const identifiers = resolveClientIdentifiers(client);

  async function fromCache(
    platform: PlatformKey,
    hasIdentifiers: boolean,
    missingMessage: string
  ): Promise<PlatformSummary> {
    if (!hasIdentifiers) {
      return {
        platform,
        status: "missing",
        message: missingMessage,
        totals: EMPTY_TOTALS,
        lastSynced: null
      };
    }
    const cached = await loadMetricsCache(context, platform, range);
    if (!cached) {
      return {
        platform,
        status: "pending",
        message: "Aguardando sincronizacao (metrics:sync).",
        totals: EMPTY_TOTALS,
        lastSynced: null
      };
    }
    const formattedDate = new Date(cached.cachedAt).toLocaleString("pt-BR");
    return {
      platform,
      status: "connected",
      message: `Atualizado em ${formattedDate}`,
      totals: cached.totals,
      lastSynced: cached.lastSynced ?? cached.cachedAt,
      kpis: cached.kpis ?? buildDefaultKpisFromTotals(cached.totals)
    };
  }

  const [google, meta, ga4] = await Promise.all([
    fromCache(
      "google",
      identifiers.googleCustomerIds.length > 0,
      "N?o se aplica (cliente sem integra??o Google Ads)."
    ),
    fromCache("meta", identifiers.metaAccountIds.length > 0, "N?o se aplica (cliente sem integra??o Meta Ads)."),
    fromCache("ga4", identifiers.ga4PropertyIds.length > 0, "N?o se aplica (cliente sem propriedades GA4).")
  ]);

  return {
    range,
    generatedAt,
    platforms: [google, meta, ga4]
  };
}
