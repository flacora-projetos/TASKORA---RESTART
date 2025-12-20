import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

type ClientMapEntry = {
  clientId: string;
  name: string;
  currentOrgId: string | null;
  org: "D" | "A" | "N" | "";
};

const ORG_CODE_BY_ID: Record<string, ClientMapEntry["org"]> = {
  Dacora: "D",
  Allgrotech: "A",
  "Narah Lopes": "N"
};

const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "Documentacao",
  "Multitenant",
  "org_client_map.json"
);

const credentialCandidates = [
  process.env.FIREBASE_CREDENTIALS_PATH,
  path.resolve(process.cwd(), "service-account.json"),
  path.resolve(process.cwd(), "..", "service-account.json"),
  path.resolve(process.cwd(), "..", "..", "service-account.json")
].filter((candidate): candidate is string => Boolean(candidate));

const credentialsPath = credentialCandidates.find((candidate) => fs.existsSync(candidate));

if (!credentialsPath) {
  console.error(
    "Unable to locate Firebase service account JSON. Set FIREBASE_CREDENTIALS_PATH or place the file at the repo root."
  );
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credentialsPath)
  });
}

const db = admin.firestore();

const clientsSnapshot = await db.collection("clients").get();
const entries: ClientMapEntry[] = clientsSnapshot.docs.map((doc) => {
  const data = doc.data();
  const name = typeof data.name === "string" ? data.name : doc.id;
  const currentOrgId = typeof data.orgId === "string" ? data.orgId : null;
  const orgCode = currentOrgId ? ORG_CODE_BY_ID[currentOrgId] ?? "" : "";
  return {
    clientId: doc.id,
    name,
    currentOrgId,
    org: orgCode || "D"
  };
});

entries.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

const payload = {
  generatedAt: new Date().toISOString(),
  orgCodes: {
    D: "Dacora",
    A: "Allgrotech",
    N: "Narah Lopes"
  },
  clients: entries
};

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2));

console.log(`Arquivo gerado: ${OUTPUT_PATH}`);
console.log(`Clientes exportados: ${entries.length}`);
