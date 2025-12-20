import type { MetricsRange } from "./client-metrics.js";
import { fetchClientMetricsSummary } from "./client-metrics.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import type { ClientStatus } from "../types/clients.js";

const DEFAULT_RANGES: MetricsRange[] = ["LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"];

type Logger = {
  log?: (...args: unknown[]) => void;
  warn?: (...args: unknown[]) => void;
};

type SyncOptions = {
  orgId: string;
  ranges?: MetricsRange[];
  logger?: Logger;
};

export async function syncMetricsCacheForOrg({
  orgId,
  ranges = DEFAULT_RANGES,
  logger = console
}: SyncOptions): Promise<{ processedClients: number; ranges: MetricsRange[] }> {
  const repo = getClientsRepository();
  const clients = await repo.list(orgId, { status: "active" as ClientStatus });

  for (const client of clients) {
    for (const range of ranges) {
      try {
        await fetchClientMetricsSummary(
          {
            orgId,
            clientId: client.id,
            clientName: client.name
          },
          {
            integrations: client.integrations,
            googleCustomerIds: client.googleCustomerIds ?? [],
            metaAccountIds: client.metaAccountIds ?? [],
            ga4PropertyIds: client.ga4PropertyIds ?? []
          },
          range
        );
      } catch (error) {
        logger.warn?.(
          `[metrics-sync] failed client=${client.id} range=${range}: ${(error as Error).message}`
        );
      }
    }
  }

  logger.log?.(`[metrics-sync] synced metrics for ${clients.length} clients in org ${orgId}`);
  return { processedClients: clients.length, ranges };
}
