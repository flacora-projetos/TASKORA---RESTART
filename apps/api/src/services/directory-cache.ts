import { env } from "../env.js";
import {
  getDirectoryClientsRepository,
  type DirectoryCacheStats,
  type DirectoryClientCacheEntity
} from "../repositories/directory-clients-repository.js";
import type { ExternalDirectoryClient, ExternalDirectoryResponse } from "../types/directory.js";
import { callExternalApi } from "./external-clients.js";

const repository = getDirectoryClientsRepository();
type DirectoryClientSummary = {
  id: string;
  name: string;
  platform: string;
  accountId?: string | null;
  metadata?: Record<string, unknown> | null;
};

const DEFAULT_BATCH_SIZE = Number(process.env.DIRECTORY_CACHE_BATCH_SIZE ?? "100");
const DEFAULT_MAX_ENTRIES = Number(process.env.DIRECTORY_CACHE_MAX_ENTRIES ?? "1000");
const DIRECTORY_CACHE_TTL_MINUTES = Number(process.env.DIRECTORY_CACHE_TTL_MINUTES ?? "180");

type SearchParams = {
  query?: string;
  platform?: string;
  limit?: number;
};

export type DirectoryCacheSearchResult = {
  items: DirectoryClientSummary[];
  stats: DirectoryCacheStats & { stale: boolean };
};

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapPlatforms(entry: ExternalDirectoryClient): string[] {
  if (Array.isArray(entry.activePlatforms) && entry.activePlatforms.length > 0) {
    return Array.from(new Set(entry.activePlatforms.map((platform) => platform.toLowerCase())));
  }
  const platforms: string[] = [];
  if (entry.googleCustomerId ?? entry.googleCustomerIds?.length) {
    platforms.push("google");
  }
  if (entry.metaAccountId ?? entry.metaAccountIds?.length) {
    platforms.push("meta");
  }
  return platforms.length ? platforms : ["other"];
}

function ensureArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.length > 0);
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return [];
}

function buildSearchText(name: string, aliases: string[], ids: string[]): string {
  const normalized = [name, ...aliases, ...ids].map(normalizeText).filter((token) => token.length > 0);
  return Array.from(new Set(normalized)).join(" ");
}

function collectGa4PropertyIds(entry: ExternalDirectoryClient): string[] {
  return ensureArray(
    entry.ga4PropertyIds ??
      (entry as Record<string, unknown>)["ga4PropertyId"] ??
      (entry as Record<string, unknown>)["gaPropertyIds"] ??
      (entry as Record<string, unknown>)["gaPropertyId"]
  );
}

function mapEntryToCacheEntity(entry: ExternalDirectoryClient, syncToken: string): DirectoryClientCacheEntity {
  const aliases = ensureArray(entry.aliases ?? entry.searchTokens);
  const googleCustomerIds = ensureArray(entry.googleCustomerIds ?? entry.googleCustomerId);
  const metaAccountIds = ensureArray(entry.metaAccountIds ?? entry.metaAccountId);
  const ga4PropertyIds = collectGa4PropertyIds(entry);
  const platforms = mapPlatforms(entry);
  const idsForSearch = [...googleCustomerIds, ...metaAccountIds, ...ga4PropertyIds];

  return {
    id: entry.id,
    name: entry.clientName,
    nameLowercase: entry.clientName.toLowerCase(),
    aliases,
    platforms,
    googleCustomerIds,
    metaAccountIds,
    ga4PropertyIds,
    searchText: buildSearchText(entry.clientName, aliases, idsForSearch),
    directorySnapshot: entry,
    syncedAt: syncToken,
    updatedAt: syncToken
  };
}

function summarizeRecord(record: DirectoryClientCacheEntity): DirectoryClientSummary {
  const primaryPlatform =
    record.platforms.find((platform) => platform !== "other") ??
    (record.googleCustomerIds.length ? "google" : record.metaAccountIds.length ? "meta" : "other");
  const accountId =
    record.metaAccountIds[0] ?? record.googleCustomerIds[0] ?? record.ga4PropertyIds[0] ?? record.aliases[0] ?? null;

  return {
    id: record.id,
    name: record.name,
    platform: primaryPlatform,
    accountId,
    metadata: {
      aliases: record.aliases,
      platforms: record.platforms,
      googleCustomerIds: record.googleCustomerIds,
      metaAccountIds: record.metaAccountIds,
      ga4PropertyIds: record.ga4PropertyIds
    }
  };
}

function isStale(lastSyncedAt: string | null): boolean {
  if (!lastSyncedAt) {
    return true;
  }
  const lastSyncDate = new Date(lastSyncedAt).getTime();
  if (Number.isNaN(lastSyncDate)) {
    return true;
  }
  const ttlMs = DIRECTORY_CACHE_TTL_MINUTES * 60 * 1000;
  return Date.now() - lastSyncDate > ttlMs;
}

function filterRecords(
  records: DirectoryClientCacheEntity[],
  { query, platform }: { query?: string; platform?: string }
): DirectoryClientCacheEntity[] {
  const normalizedQuery = query ? normalizeText(query) : null;
  const normalizedPlatform = platform ? platform.toLowerCase() : null;

  return records.filter((record) => {
    const matchesQuery = normalizedQuery ? record.searchText.includes(normalizedQuery) : true;
    const matchesPlatform = normalizedPlatform ? record.platforms.includes(normalizedPlatform) : true;
    return matchesQuery && matchesPlatform;
  });
}

async function fetchBatch(offset: number, limit: number): Promise<ExternalDirectoryResponse["data"]> {
  const response = (await callExternalApi({
    path: "/directory/clients",
    query: { limit, offset }
  })) as ExternalDirectoryResponse;

  if (!response?.ok || !response.data) {
    throw new Error("Invalid response from directory clients endpoint");
  }

  return response.data;
}

export async function searchDirectoryCache(params: SearchParams = {}): Promise<DirectoryCacheSearchResult> {
  const records = await repository.listAll();
  const stats = await repository.getStats();
  const filtered = filterRecords(records, params);
  const limit = params.limit ?? 10;

  return {
    items: filtered.slice(0, limit).map(summarizeRecord),
    stats: {
      ...stats,
      stale: isStale(stats.lastSyncedAt)
    }
  };
}

export async function refreshDirectoryCache({
  batchSize = DEFAULT_BATCH_SIZE,
  maxEntries = DEFAULT_MAX_ENTRIES,
  logger = console
}: {
  batchSize?: number;
  maxEntries?: number;
  logger?: Pick<Console, "log" | "warn" | "error">;
} = {}): Promise<{ processed: number; syncToken: string }> {
  if (!env.EXTERNAL_API_BEARER) {
    throw new Error("EXTERNAL_API_BEARER not configured");
  }

  const syncToken = new Date().toISOString();
  let offset = 0;
  let processed = 0;

  while (offset < maxEntries) {
    const batch = await fetchBatch(offset, batchSize);
    if (batch.items.length === 0) {
      break;
    }

    const records = batch.items.map((entry) => mapEntryToCacheEntity(entry, syncToken));
    await repository.upsertMany(records);
    processed += records.length;
    offset += batch.items.length;
    logger.log(`[directory-cache] processed batch offset=${offset} total=${batch.total}`);

    if (offset >= batch.total || batch.items.length < batchSize) {
      break;
    }
  }

  await repository.deleteWhereSyncedBefore(syncToken);
  return { processed, syncToken };
}

export { isStale as isDirectoryCacheStale };

export function externalEntryToSummary(entry: ExternalDirectoryClient): DirectoryClientSummary {
  return summarizeRecord(mapEntryToCacheEntity(entry, new Date().toISOString()));
}

export { collectGa4PropertyIds };
