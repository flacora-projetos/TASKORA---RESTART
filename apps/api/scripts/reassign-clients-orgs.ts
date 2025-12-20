import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

type OrgCode = "D" | "A" | "N";

type ClientMapEntry = {
  clientId: string;
  name: string;
  currentOrgId?: string | null;
  org: OrgCode | "" | null;
};

type OrgMapFile = {
  generatedAt?: string;
  orgCodes?: Record<string, string>;
  clients: ClientMapEntry[];
};

const DEFAULT_MAP_PATH = path.resolve(
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

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const fileIndex = args.findIndex((arg) => arg === "--file");
const mapPath = fileIndex >= 0 && args[fileIndex + 1] ? args[fileIndex + 1] : DEFAULT_MAP_PATH;

const raw = fs.readFileSync(mapPath, "utf-8");
const parsed = JSON.parse(raw) as OrgMapFile;

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

const db = admin.firestore();

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureOrganizations(): Promise<Record<OrgCode, string>> {
  const orgsSnapshot = await db.collection("organizations").get();
  const orgs = orgsSnapshot.docs.map((doc) => ({
    id: doc.id,
    name: String(doc.data().name ?? doc.id),
    slug: String(doc.data().slug ?? doc.id)
  }));

  const lookup = (name: string) =>
    orgs.find(
      (org) =>
        org.name.toLowerCase() === name.toLowerCase() || org.slug.toLowerCase() === slugify(name)
    );

  const resolved: Record<OrgCode, string> = {
    D: process.env.ORG_D_ID || "",
    A: process.env.ORG_A_ID || "",
    N: process.env.ORG_N_ID || ""
  };

  if (!resolved.D) {
    const fallback = parsed.clients.find((client) => client.org === "D" && client.currentOrgId)?.currentOrgId;
    resolved.D = fallback ?? "Dacora";
  }

  const now = new Date().toISOString();
  const hasOrg = (id: string, name: string) =>
    orgs.some((org) => org.id === id) || Boolean(lookup(name));

  if (resolved.D && !hasOrg(resolved.D, CODE_TO_NAME.D)) {
    await db.collection("organizations").doc(resolved.D).set({
      name: CODE_TO_NAME.D,
      slug: slugify(CODE_TO_NAME.D),
      createdAt: now,
      updatedAt: now,
      ownerUid: null
    });
  }

  for (const code of ["A", "N"] as OrgCode[]) {
    if (resolved[code]) {
      continue;
    }
    const name = CODE_TO_NAME[code];
    const existing = lookup(name);
    if (existing) {
      resolved[code] = existing.id;
      continue;
    }
    const id = slugify(name);
    await db.collection("organizations").doc(id).set({
      name,
      slug: id,
      createdAt: now,
      updatedAt: now,
      ownerUid: null
    });
    resolved[code] = id;
  }

  return resolved;
}

class Batcher {
  private batch = db.batch();
  private counter = 0;

  async update(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) {
    if (!apply) {
      return;
    }
    this.batch.update(ref, data);
    this.counter += 1;
    if (this.counter >= 400) {
      await this.flush();
    }
  }

  async set(ref: FirebaseFirestore.DocumentReference, data: Record<string, unknown>) {
    if (!apply) {
      return;
    }
    this.batch.set(ref, data);
    this.counter += 1;
    if (this.counter >= 400) {
      await this.flush();
    }
  }

  async delete(ref: FirebaseFirestore.DocumentReference) {
    if (!apply) {
      return;
    }
    this.batch.delete(ref);
    this.counter += 1;
    if (this.counter >= 400) {
      await this.flush();
    }
  }

  async flush() {
    if (!apply || this.counter === 0) {
      this.batch = db.batch();
      this.counter = 0;
      return;
    }
    await this.batch.commit();
    this.batch = db.batch();
    this.counter = 0;
  }
}

async function migrateClient(entry: ClientMapEntry, targetOrgId: string, batcher: Batcher) {
  const summary = {
    projects: 0,
    tasks: 0,
    timeEntries: 0,
    timeline: 0,
    insights: 0,
    insightComments: 0,
    metricsCache: 0,
    metricsStatus: 0
  };

  const clientRef = db.collection("clients").doc(entry.clientId);
  const clientDoc = await clientRef.get();
  if (!clientDoc.exists) {
    console.warn(`Cliente nao encontrado: ${entry.clientId} (${entry.name})`);
    return summary;
  }
  const clientData = clientDoc.data() ?? {};
  const currentOrgId = typeof clientData.orgId === "string" ? clientData.orgId : null;
  if (currentOrgId === targetOrgId) {
    return summary;
  }

  await batcher.update(clientRef, { orgId: targetOrgId });

  const projectSnapshot = await db.collection("projects").where("clientId", "==", entry.clientId).get();
  const projectIds: string[] = [];
  for (const doc of projectSnapshot.docs) {
    const data = doc.data();
    if (data.orgId === targetOrgId) {
      continue;
    }
    await batcher.update(doc.ref, { orgId: targetOrgId });
    summary.projects += 1;
    projectIds.push(doc.id);
  }

  const taskIds: string[] = [];
  for (const projectId of projectIds) {
    const taskSnapshot = await db.collection("tasks").where("projectId", "==", projectId).get();
    for (const taskDoc of taskSnapshot.docs) {
      const data = taskDoc.data();
      if (data.orgId === targetOrgId) {
        continue;
      }
      await batcher.update(taskDoc.ref, { orgId: targetOrgId });
      summary.tasks += 1;
      taskIds.push(taskDoc.id);
    }
  }

  const timeEntryIds = new Set<string>();
  for (const projectId of projectIds) {
    const entriesSnapshot = await db.collection("time_entries").where("projectId", "==", projectId).get();
    for (const doc of entriesSnapshot.docs) {
      if (timeEntryIds.has(doc.id)) {
        continue;
      }
      const data = doc.data();
      if (data.orgId === targetOrgId) {
        continue;
      }
      await batcher.update(doc.ref, { orgId: targetOrgId });
      summary.timeEntries += 1;
      timeEntryIds.add(doc.id);
    }
  }
  for (const taskId of taskIds) {
    const entriesSnapshot = await db.collection("time_entries").where("taskId", "==", taskId).get();
    for (const doc of entriesSnapshot.docs) {
      if (timeEntryIds.has(doc.id)) {
        continue;
      }
      const data = doc.data();
      if (data.orgId === targetOrgId) {
        continue;
      }
      await batcher.update(doc.ref, { orgId: targetOrgId });
      summary.timeEntries += 1;
      timeEntryIds.add(doc.id);
    }
  }

  const timelineSnapshot = await db.collection("client_timeline").where("clientId", "==", entry.clientId).get();
  for (const doc of timelineSnapshot.docs) {
    const data = doc.data();
    if (data.orgId === targetOrgId) {
      continue;
    }
    await batcher.update(doc.ref, { orgId: targetOrgId });
    summary.timeline += 1;
  }

  const insightsSnapshot = await db.collection("insight_posts").where("clientId", "==", entry.clientId).get();
  const insightIds: string[] = [];
  for (const doc of insightsSnapshot.docs) {
    const data = doc.data();
    if (data.orgId === targetOrgId) {
      continue;
    }
    await batcher.update(doc.ref, { orgId: targetOrgId });
    summary.insights += 1;
    insightIds.push(doc.id);
  }

  for (const projectId of projectIds) {
    const insightsByProject = await db.collection("insight_posts").where("projectId", "==", projectId).get();
    for (const doc of insightsByProject.docs) {
      if (insightIds.includes(doc.id)) {
        continue;
      }
      const data = doc.data();
      if (data.orgId === targetOrgId) {
        continue;
      }
      await batcher.update(doc.ref, { orgId: targetOrgId });
      summary.insights += 1;
      insightIds.push(doc.id);
    }
  }

  for (const taskId of taskIds) {
    const insightsByTask = await db.collection("insight_posts").where("taskId", "==", taskId).get();
    for (const doc of insightsByTask.docs) {
      if (insightIds.includes(doc.id)) {
        continue;
      }
      const data = doc.data();
      if (data.orgId === targetOrgId) {
        continue;
      }
      await batcher.update(doc.ref, { orgId: targetOrgId });
      summary.insights += 1;
      insightIds.push(doc.id);
    }
  }

  for (const insightId of insightIds) {
    const commentsSnapshot = await db.collection("comments").where("postId", "==", insightId).get();
    for (const doc of commentsSnapshot.docs) {
      const data = doc.data();
      if (data.orgId === targetOrgId) {
        continue;
      }
      await batcher.update(doc.ref, { orgId: targetOrgId });
      summary.insightComments += 1;
    }
  }

  const cacheSnapshot = await db.collection("client_metrics_cache").where("clientId", "==", entry.clientId).get();
  for (const doc of cacheSnapshot.docs) {
    const data = doc.data();
    if (data.orgId === targetOrgId) {
      continue;
    }
    const platform = data.platform ?? "unknown";
    const range = data.range ?? "unknown";
    const newId = `${targetOrgId}_${entry.clientId}_${platform}_${range}`;
    const next = { ...data, id: newId, orgId: targetOrgId };
    await batcher.set(db.collection("client_metrics_cache").doc(newId), next);
    await batcher.delete(doc.ref);
    summary.metricsCache += 1;
  }

  const statusSnapshot = await db.collection("client_metrics_status").where("clientId", "==", entry.clientId).get();
  for (const doc of statusSnapshot.docs) {
    const data = doc.data();
    if (data.orgId === targetOrgId) {
      continue;
    }
    const platform = data.platform ?? "unknown";
    const newId = `${targetOrgId}_${entry.clientId}_${platform}`;
    const next = { ...data, id: newId, orgId: targetOrgId };
    await batcher.set(db.collection("client_metrics_status").doc(newId), next);
    await batcher.delete(doc.ref);
    summary.metricsStatus += 1;
  }

  return summary;
}

async function run() {
  const orgIds = await ensureOrganizations();
  const batcher = new Batcher();

  const entries = parsed.clients.filter((client) => client.org && client.org !== "");
  const totals = {
    clients: 0,
    projects: 0,
    tasks: 0,
    timeEntries: 0,
    timeline: 0,
    insights: 0,
    insightComments: 0,
    metricsCache: 0,
    metricsStatus: 0
  };

  console.log(`Mapa carregado: ${entries.length} clientes. Modo: ${apply ? "APLICAR" : "DRY-RUN"}`);
  console.log(`Orgs: D=${orgIds.D}, A=${orgIds.A}, N=${orgIds.N}`);

  for (const entry of entries) {
    const code = String(entry.org ?? "").toUpperCase() as OrgCode;
    const targetOrgId = orgIds[code];
    if (!targetOrgId) {
      console.warn(`Org invalida para ${entry.name} (${entry.clientId}): ${entry.org}`);
      continue;
    }

    const summary = await migrateClient(entry, targetOrgId, batcher);
    if (
      summary.projects ||
      summary.tasks ||
      summary.timeEntries ||
      summary.timeline ||
      summary.insights ||
      summary.insightComments ||
      summary.metricsCache ||
      summary.metricsStatus
    ) {
      totals.clients += 1;
      totals.projects += summary.projects;
      totals.tasks += summary.tasks;
      totals.timeEntries += summary.timeEntries;
      totals.timeline += summary.timeline;
      totals.insights += summary.insights;
      totals.insightComments += summary.insightComments;
      totals.metricsCache += summary.metricsCache;
      totals.metricsStatus += summary.metricsStatus;
      console.log(
        `Migrado ${entry.name}: projects=${summary.projects}, tasks=${summary.tasks}, time_entries=${summary.timeEntries}, timeline=${summary.timeline}, insights=${summary.insights}`
      );
    }
  }

  await batcher.flush();

  console.log("Resumo:", totals);
  if (!apply) {
    console.log("Dry-run finalizado. Use --apply para gravar.");
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
