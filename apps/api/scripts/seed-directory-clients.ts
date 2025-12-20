import process from "node:process";

import { env } from "../src/env.js";
import { syncDirectoryClients } from "../src/services/directory-sync.js";

const orgId = process.env.SEED_ORG_ID ?? "org-dev";
const actorId = process.env.SEED_ACTOR_ID ?? "seed-script";
const batchSize = Number(process.env.SEED_DIRECTORY_BATCH_SIZE ?? "50");
const maxBatches = Number(process.env.SEED_DIRECTORY_MAX_BATCHES ?? "20");

if (!env.EXTERNAL_API_BEARER) {
  console.error("EXTERNAL_API_BEARER must be configured to run this script.");
  process.exit(1);
}

async function main() {
  console.log(`Seeding directory clients into org "${orgId}" using actor "${actorId}"...`);
  const result = await syncDirectoryClients({
    orgId,
    actorId,
    batchSize,
    maxEntries: batchSize * maxBatches,
    logger: console
  });

  console.log(
    `Seed completed. Processed ${result.processed} entries (created ${result.created}, updated ${result.updated}). Remaining directory entries can be imported by re-running the script.`
  );
}

main().catch((error) => {
  console.error("Failed to seed directory clients", error);
  process.exit(1);
});
