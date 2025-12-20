import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const serviceAccountUrl = new URL("../../service-account.json", import.meta.url);
const serviceAccountPath = fileURLToPath(serviceAccountUrl);
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const customToken = await getAuth().createCustomToken("codex-debugger", {
  orgId: "org-dev",
  roles: ["gestor", "analista", "suporte"],
  email: "codex@taskora.dev"
});
console.log(customToken);
