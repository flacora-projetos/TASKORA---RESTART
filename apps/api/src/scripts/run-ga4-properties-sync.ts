import { syncGa4Properties } from "../services/ga4-properties-sync.js";

const dryRun = process.env.GA4_PROPERTIES_DRY_RUN === "true";

async function main(): Promise<void> {
  await syncGa4Properties({ dryRun, logger: console });
  console.log(
    dryRun
      ? "[ga4-properties] Dry-run concluido."
      : "[ga4-properties] Sincronizacao concluida."
  );
}

main().catch((error) => {
  console.error("[ga4-properties] Falha ao sincronizar propriedades GA4", error);
  process.exit(1);
});
