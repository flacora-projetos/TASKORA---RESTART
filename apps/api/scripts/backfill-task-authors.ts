import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

import admin from "firebase-admin";

function resolveServiceAccountPath(): string {
  const candidates = [
    path.resolve(process.cwd(), "service-account.json"),
    path.resolve(process.cwd(), "../service-account.json"),
    path.resolve(process.cwd(), "../../service-account.json")
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error("service-account.json nao encontrado (tente colocar na raiz do repo).");
  }
  return found;
}

function initFirestore(): FirebaseFirestore.Firestore {
  const credentialsPath = resolveServiceAccountPath();
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8"));
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(credentials)
    });
  }
  return admin.firestore();
}

async function buildMemberLookup(db: FirebaseFirestore.Firestore) {
  const snapshot = await db.collection("team_members").get();
  const byId = new Map<string, string>();
  const byUserId = new Map<string, string>();
  const users = new Map<string, string>();

  const usersSnap = await db.collection("users").get();
  usersSnap.forEach((doc) => {
    const data = doc.data() as { name?: string; displayName?: string; email?: string | null } | undefined;
    const name = data?.name || data?.displayName || data?.email;
    if (name) {
      users.set(doc.id, name);
    }
  });

  snapshot.forEach((doc) => {
    const data = doc.data() as { name?: string; userId?: string | null } | undefined;
    if (!data?.name) {
      return;
    }
    byId.set(doc.id, data.name);
    if (data.userId) {
      byUserId.set(data.userId, data.name);
    }
  });

  return { byId, byUserId, users, total: snapshot.size, usersTotal: usersSnap.size };
}

function resolveAuthorName(
  actorId: string | null | undefined,
  byId: Map<string, string>,
  byUserId: Map<string, string>,
  users: Map<string, string>
): string | null {
  if (!actorId) {
    return null;
  }
  return byId.get(actorId) ?? byUserId.get(actorId) ?? users.get(actorId) ?? null;
}

async function backfill() {
  const db = initFirestore();
  const { byId, byUserId, users, total: members, usersTotal } = await buildMemberLookup(db);

  const snapshot = await db.collection("tasks").get();
  let updated = 0;
  let skippedNoActor = 0;
  let skippedNoMatch = 0;
  let alreadySet = 0;

  let batch = db.batch();
  let opsInBatch = 0;
  const commits: Promise<FirebaseFirestore.WriteResult[]>[] = [];

  snapshot.forEach((doc: TaskDoc, index) => {
    const data = doc.data() ?? {};
    const activityLog: Array<{ type?: string; actorId?: string | null }> = Array.isArray(data.activityLog)
      ? data.activityLog
      : [];
    const createdEntry = activityLog.find((entry) => entry?.type === "created");
    const actorId = createdEntry?.actorId ?? data.createdById ?? null;

    if (!actorId) {
      skippedNoActor += 1;
      return;
    }

    const name = resolveAuthorName(actorId, byId, byUserId, users);
    if (!name) {
      skippedNoMatch += 1;
      return;
    }

    if (data.createdById === actorId && data.createdByName === name) {
      alreadySet += 1;
      return;
    }

    batch.set(doc.ref, { createdById: actorId, createdByName: name }, { merge: true });
    updated += 1;
    opsInBatch += 1;

    // Commit em lotes de 400 para evitar limites.
    if (opsInBatch >= 400) {
      commits.push(batch.commit());
      batch = db.batch();
      opsInBatch = 0;
    }
  });

  // Commit final.
  if (opsInBatch > 0) {
    commits.push(batch.commit());
  }

  await Promise.all(commits);

  console.log(
    JSON.stringify(
      {
        members,
        users: usersTotal,
        tasksChecked: snapshot.size,
        updated,
        alreadySet,
        skippedNoActor,
        skippedNoMatch
      },
      null,
      2
    )
  );
}

backfill()
  .then(() => {
    console.log("Backfill concluido.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
