import { syncGa4Properties } from "../src/services/ga4-properties-sync.js";

const dryRun = process.argv.includes("--dry-run");

syncGa4Properties({ dryRun })
  .then(() => {
    if (dryRun) {
      console.log("[ga4-properties] Dry-run concluido.");
    } else {
      console.log("[ga4-properties] Sincronizacao concluida.");
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error("[ga4-properties] Falha ao sincronizar propriedades GA4", error);
    process.exit(1);
  });
