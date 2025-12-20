import { env } from "../env.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import type { ClientEntity, ClientPlatform, ClientUpdateInput } from "../types/clients.js";
import type { ExternalDirectoryClient, ExternalDirectoryResponse } from "../types/directory.js";
import { callExternalApi } from "./external-clients.js";

export type DirectorySyncOptions = {
  orgId: string;
  actorId: string;
  batchSize?: number;
  maxEntries?: number;
  logger?: Pick<Console, "log" | "warn" | "error">;
};

export type DirectorySyncResult = {
  processed: number;
  created: number;
  updated: number;
};

const repo = getClientsRepository();

function mapPlatforms(platforms?: string[] | null): ClientPlatform[] {
  if (!Array.isArray(platforms)) {
    return [];
  }
  const allowed = new Set<ClientPlatform>(["google", "meta", "pinterest", "tiktok", "other"]);
  return platforms
    .map((platform) => platform.toLowerCase())
    .map((platform) => (allowed.has(platform as ClientPlatform) ? (platform as ClientPlatform) : "other"))
    .filter((platform, index, array) => array.indexOf(platform) === index);
}

function removeUndefined<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

export function collectIdentifiers(entry: ExternalDirectoryClient): {
  googleCustomerIds: string[];
  metaAccountIds: string[];
  ga4PropertyIds: string[];
} {
  const sanitize = (values: (string | null | undefined)[]): string[] => {
    const clean = values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    return Array.from(new Set(clean));
  };

  const googleCandidates = [
    ...(Array.isArray(entry.googleCustomerIds) ? entry.googleCustomerIds : []),
    entry.googleCustomerId ?? null
  ];
  const metaCandidates = [
    ...(Array.isArray(entry.metaAccountIds) ? entry.metaAccountIds : []),
    entry.metaAccountId ?? null
  ];

  const ga4Candidates = [
    ...(Array.isArray(entry.ga4PropertyIds) ? entry.ga4PropertyIds : []),
    entry.ga4PropertyId ?? null,
    (entry as Record<string, unknown>)["gaPropertyIds"],
    (entry as Record<string, unknown>)["gaPropertyId"]
  ];

  return {
    googleCustomerIds: sanitize(googleCandidates),
    metaAccountIds: sanitize(metaCandidates),
    ga4PropertyIds: sanitize(
      ga4Candidates.flatMap((candidate) =>
        Array.isArray(candidate) ? (candidate as (string | null | undefined)[]) : [candidate as string | null | undefined]
      )
    )
  };
}

function buildIntegrationSnapshot(entry: ExternalDirectoryClient) {
  const identifiers = collectIdentifiers(entry);
  return removeUndefined({
    directoryId: entry.id,
    directorySnapshot: entry,
    googleCustomerIds: identifiers.googleCustomerIds.length ? identifiers.googleCustomerIds : undefined,
    metaAccountIds: identifiers.metaAccountIds.length ? identifiers.metaAccountIds : undefined,
    ga4PropertyIds: identifiers.ga4PropertyIds.length ? identifiers.ga4PropertyIds : undefined,
    syncedAt: new Date().toISOString()
  });
}

function shouldUpdateClient(current: ClientEntity, nextName: string, nextPlatforms: ClientPlatform[]): boolean {
  if (current.name !== nextName) {
    return true;
  }
  if (current.platforms.length !== nextPlatforms.length) {
    return true;
  }
  const currentSorted = [...current.platforms].sort();
  const nextSorted = [...nextPlatforms].sort();
  return currentSorted.some((platform, index) => platform !== nextSorted[index]);
}

async function fetchBatch(offset: number, limit: number): Promise<ExternalDirectoryResponse["data"]> {
  const response = (await callExternalApi({
    path: "/directory/clients",
    query: {
      limit,
      offset
    }
  })) as ExternalDirectoryResponse;

  if (!response?.ok || !response.data) {
    throw new Error("Invalid response from directory clients endpoint");
  }

  return response.data;
}

export async function syncDirectoryClients({
  orgId,
  actorId,
  batchSize = Number(process.env.SEED_DIRECTORY_BATCH_SIZE ?? "50"),
  maxEntries = Number(process.env.SEED_DIRECTORY_MAX_BATCHES ?? "20") * batchSize,
  logger = console
}: DirectorySyncOptions): Promise<DirectorySyncResult> {
  if (!env.EXTERNAL_API_BEARER) {
    throw new Error("EXTERNAL_API_BEARER not configured");
  }

  const existing = await repo.list(orgId);
  const byDirectoryId = new Map(
    existing
      .filter((client) => client.integrations?.directoryId)
      .map((client) => [client.integrations!.directoryId!, client])
  );

  let offset = 0;
  let processed = 0;
  let created = 0;
  let updated = 0;

  while (offset < maxEntries) {
    const batch = await fetchBatch(offset, batchSize);
    if (batch.items.length === 0) {
      break;
    }

    for (const entry of batch.items as ExternalDirectoryClient[]) {
      const existingClient = byDirectoryId.get(entry.id);
      const platforms = mapPlatforms(entry.activePlatforms);
      const identifiers = collectIdentifiers(entry);
      let client: ClientEntity | null = existingClient ?? null;

      if (!client) {
        client = await repo.create(
          orgId,
          {
            name: entry.clientName,
            platforms,
            googleCustomerIds: identifiers.googleCustomerIds,
            metaAccountIds: identifiers.metaAccountIds,
            ga4PropertyIds: identifiers.ga4PropertyIds
          },
          actorId
        );
        byDirectoryId.set(entry.id, client);
        created += 1;
      } else if (shouldUpdateClient(client, entry.clientName, platforms)) {
        const updatePayload: ClientUpdateInput = {
          name: entry.clientName,
          platforms
        };

        if (identifiers.googleCustomerIds.length > 0) {
          updatePayload.googleCustomerIds = identifiers.googleCustomerIds;
        }
        if (identifiers.metaAccountIds.length > 0) {
          updatePayload.metaAccountIds = identifiers.metaAccountIds;
        }
        if (identifiers.ga4PropertyIds.length > 0) {
          updatePayload.ga4PropertyIds = identifiers.ga4PropertyIds;
        }

        client = await repo.update(orgId, client.id, updatePayload, actorId);
        byDirectoryId.set(entry.id, client);
        updated += 1;
      }

      if (client) {
        await repo.updateIntegrations(orgId, client.id, buildIntegrationSnapshot(entry), actorId);
      }

      processed += 1;
    }

    offset += batch.items.length;
    logger.log(
      `[directory-sync] processed batch: offset=${offset} total=${batch.total} created=${created} updated=${updated}`
    );

    if (offset >= batch.total || batch.items.length < batchSize) {
      break;
    }
  }

  return { processed, created, updated };
}
