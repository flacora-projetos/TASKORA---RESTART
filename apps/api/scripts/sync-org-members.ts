import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

type OrgCode = "D" | "A" | "N";
type MemberRole = "admin" | "member";

type MemberEntry = {
  email: string;
  orgs: Array<OrgCode | string>;
  roles?: MemberRole[];
};

type MemberMapFile = {
  orgCodes?: Record<string, string>;
  members: MemberEntry[];
};

const DEFAULT_MAP_PATH = path.resolve(
  process.cwd(),
  "..",
  "..",
  "Documentacao",
  "Multitenant",
  "org_members_map.json"
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

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fileIndex = args.findIndex((arg) => arg === "--file");
const mapPath = fileIndex >= 0 && args[fileIndex + 1] ? args[fileIndex + 1] : DEFAULT_MAP_PATH;

if (!fs.existsSync(mapPath)) {
  console.error(`Map file not found: ${mapPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(mapPath, "utf-8");
const parsed = JSON.parse(raw) as MemberMapFile;

const CODE_TO_NAME: Record<OrgCode, string> = {
  D: parsed.orgCodes?.D ?? "Dacora",
  A: parsed.orgCodes?.A ?? "Allgrotech",
  N: parsed.orgCodes?.N ?? "Narah Lopes"
};

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(credentialsPath)
  });
}

const auth = admin.auth();
const db = admin.firestore();

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureOrganization(id: string, name: string) {
  const doc = await db.collection("organizations").doc(id).get();
  if (doc.exists) {
    return;
  }
  const now = new Date().toISOString();
  await db.collection("organizations").doc(id).set({
    name,
    slug: slugify(name),
    createdAt: now,
    updatedAt: now,
    ownerUid: null
  });
}

async function ensureOrganizations(orgIds: Record<OrgCode, string>) {
  await ensureOrganization(orgIds.D, CODE_TO_NAME.D);
  await ensureOrganization(orgIds.A, CODE_TO_NAME.A);
  await ensureOrganization(orgIds.N, CODE_TO_NAME.N);
}

function resolveOrgId(value: string, orgIds: Record<OrgCode, string>): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const upper = trimmed.toUpperCase();
  if (upper === "D" || upper === "A" || upper === "N") {
    return orgIds[upper as OrgCode];
  }
  return trimmed;
}

async function run() {
  const orgIds: Record<OrgCode, string> = {
    D: process.env.ORG_D_ID || "org-dev",
    A: process.env.ORG_A_ID || "allgrotech",
    N: process.env.ORG_N_ID || "narah-lopes"
  };

  await ensureOrganizations(orgIds);

  const errors: string[] = [];
  const members = parsed.members ?? [];

  console.log(`Mapa carregado: ${members.length} membros. Modo: ${apply ? "APLICAR" : "DRY-RUN"}`);
  console.log(`Orgs: D=${orgIds.D}, A=${orgIds.A}, N=${orgIds.N}`);

  for (const entry of members) {
    let userRecord: admin.auth.UserRecord;
    try {
      userRecord = await auth.getUserByEmail(entry.email);
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/user-not-found") {
        errors.push(`Usuario nao encontrado: ${entry.email}`);
        continue;
      }
      throw err;
    }

    const roles = entry.roles?.length ? entry.roles : (["member"] as MemberRole[]);
    for (const orgValue of entry.orgs) {
      const orgId = resolveOrgId(String(orgValue), orgIds);
      if (!orgId) {
        errors.push(`Org invalida para ${entry.email}: ${orgValue}`);
        continue;
      }
      const memberId = `${orgId}_${userRecord.uid}`;
      const payload = {
        id: memberId,
        orgId,
        userId: userRecord.uid,
        roles,
        createdAt: new Date().toISOString()
      };

      if (apply) {
        await db.collection("organizationMembers").doc(memberId).set(payload, { merge: true });
      }
      console.log(`${apply ? "Gravou" : "Simulou"} ${entry.email} -> ${orgId} (${roles.join(",")})`);
    }
  }

  if (errors.length) {
    console.error("Erros:");
    errors.forEach((msg) => console.error(`- ${msg}`));
    process.exitCode = 1;
  }

  if (!apply) {
    console.log("Dry-run finalizado. Use --apply para gravar.");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
