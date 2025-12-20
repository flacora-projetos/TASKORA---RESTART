import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const orgIndex = args.findIndex((arg) => arg === "--org");
const targetOrgId = orgIndex >= 0 && args[orgIndex + 1] ? args[orgIndex + 1] : null;

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

const serviceAccount = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

const COLLECTIONS: Array<{ name: string; fields: string[] }> = [
  { name: "clients", fields: ["name", "segment"] },
  { name: "projects", fields: ["name"] },
  { name: "tasks", fields: ["title", "description"] },
  { name: "team_members", fields: ["name"] }
];

const REPLACEMENTS = new Map<string, string>([
  ["\u2018", "'"],
  ["\u2019", "'"],
  ["\u201c", '"'],
  ["\u201d", '"'],
  ["\u2013", "-"],
  ["\u2014", "-"],
  ["\u2026", "..."],
  ["\u00a0", " "],
  ["\u00b7", "-"],
  ["\u0103", "\u00e3"],
  ["\u0102", "\u00c3"],
  ["\u0119", "\u00ea"],
  ["\u0118", "\u00ca"]
]);

const MOJIBAKE_PATTERN = /[\u00c3\u00c2\ufffd]/;

function fixMojibake(value: string): string {
  if (!MOJIBAKE_PATTERN.test(value)) {
    return value;
  }
  try {
    const candidate = Buffer.from(value, "latin1").toString("utf8");
    return candidate || value;
  } catch {
    return value;
  }
}

function normalizeText(value: string): string {
  let output = fixMojibake(value);
  for (const [from, to] of REPLACEMENTS.entries()) {
    if (output.includes(from)) {
      output = output.split(from).join(to);
    }
  }

  let sanitized = "";
  for (const ch of output) {
    const replacement = REPLACEMENTS.get(ch);
    if (replacement) {
      sanitized += replacement;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (code <= 0xff) {
      sanitized += ch;
      continue;
    }
    const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (base.length > 0) {
      const baseCode = base.codePointAt(0) ?? 0;
      if (baseCode <= 0xff) {
        sanitized += base;
      }
    }
  }

  return sanitized;
}

async function run() {
  console.log(
    `Normalize PT-BR data: mode=${apply ? "APPLY" : "DRY-RUN"}, org=${targetOrgId ?? "ALL"}`
  );

  let totalDocs = 0;
  let totalUpdates = 0;

  for (const collection of COLLECTIONS) {
    let query: FirebaseFirestore.Query = db.collection(collection.name);
    if (targetOrgId) {
      query = query.where("orgId", "==", targetOrgId);
    }
    const snapshot = await query.get();
    let batch = db.batch();
    let batchCount = 0;
    let collectionUpdates = 0;

    for (const doc of snapshot.docs) {
      totalDocs += 1;
      const data = doc.data() as Record<string, unknown>;
      const updates: Record<string, string> = {};

      for (const field of collection.fields) {
        const value = data[field];
        if (typeof value !== "string") {
          continue;
        }
        const normalized = normalizeText(value);
        if (normalized !== value) {
          updates[field] = normalized;
        }
      }

      if (Object.keys(updates).length > 0) {
        collectionUpdates += 1;
        totalUpdates += 1;
        if (apply) {
          batch.update(doc.ref, updates);
          batchCount += 1;
        }
      }

      if (apply && batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    }

    if (apply && batchCount > 0) {
      await batch.commit();
    }

    console.log(
      `Collection ${collection.name}: scanned=${snapshot.size}, updated=${collectionUpdates}`
    );
  }

  console.log(`Total scanned=${totalDocs}, total updated=${totalUpdates}`);
  if (!apply) {
    console.log("Dry-run complete. Re-run with --apply to persist changes.");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
