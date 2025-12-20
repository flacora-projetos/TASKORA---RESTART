import { refreshDirectoryCache } from "../src/services/directory-cache.js";

async function main() {
  const result = await refreshDirectoryCache({ logger: console });
  console.log(`[directory-cache] synced ${result.processed} entries at ${result.syncToken}`);
}

main().catch((error) => {
  console.error("Failed to refresh directory cache", error);
  process.exit(1);
});
