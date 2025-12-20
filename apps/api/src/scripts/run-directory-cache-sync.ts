import { refreshDirectoryCache } from "../services/directory-cache.js";

async function main(): Promise<void> {
  const result = await refreshDirectoryCache({ logger: console });
  console.log(`[directory-cache] synced ${result.processed} entries at ${result.syncToken}`);
}

main().catch((error) => {
  console.error("Failed to refresh directory cache", error);
  process.exit(1);
});
