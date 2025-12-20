import { syncMetricsCacheForOrg } from "../services/metrics-sync.js";
import type { MetricsRange } from "../services/client-metrics.js";

const ORG_ID = process.env.METRICS_SYNC_ORG_ID ?? "org-dev";
const rangeEnv = process.env.METRICS_SYNC_RANGES;
const AVAILABLE_RANGES: MetricsRange[] = ["LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"];

const ranges = rangeEnv
  ? rangeEnv
      .split(",")
      .map((item) => item.trim() as MetricsRange)
      .filter((item): item is MetricsRange => AVAILABLE_RANGES.includes(item))
  : undefined;

async function main(): Promise<void> {
  const result = await syncMetricsCacheForOrg({
    orgId: ORG_ID,
    ranges,
    logger: console
  });
  console.log(
    `[metrics-sync] processed ${result.processedClients} clients for ranges ${result.ranges.join(", ")}`
  );
}

main().catch((error) => {
  console.error("metrics-sync failed", error);
  process.exit(1);
});
