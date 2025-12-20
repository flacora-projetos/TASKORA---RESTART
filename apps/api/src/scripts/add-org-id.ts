import { getFirestoreDb } from "../firebase.js";

const DEFAULT_ORG_ID = process.env.SEED_ORG_ID || "Dacora";
const COLLECTIONS: Array<{ name: string; orgField?: string }> = [
  { name: "clients" },
  { name: "projects" },
  { name: "tasks" },
  { name: "time_entries" },
  { name: "client_timeline" },
  { name: "client_metrics_cache" },
  { name: "client_metrics_status" },
  { name: "insight_posts" },
  { name: "feedback_posts" },
  { name: "comments" },
  { name: "votes" },
  { name: "push_subscriptions" }
];

async function main(): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error("Firestore nao configurado. Defina as credenciais antes de rodar.");
  }

  console.log(`Aplicando orgId="${DEFAULT_ORG_ID}" em colecoes: ${COLLECTIONS.map((c) => c.name).join(", ")}`);

  for (const { name, orgField } of COLLECTIONS) {
    const field = orgField ?? "orgId";
    let snapshot: FirebaseFirestore.QuerySnapshot;
    try {
      snapshot = await db.collection(name).where(field, "==", null).get();
    } catch {
      // Alguns ambientes usam ausencia de campo em vez de null
      snapshot = await db.collection(name).where(field, "==", undefined).get();
    }

    if (snapshot.empty) {
      console.log(`[${name}] Nenhum documento sem orgId`);
      continue;
    }

    const batch = db.batch();
    let counter = 0;

    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { [field]: DEFAULT_ORG_ID });
      counter += 1;
    });

    await batch.commit();
    console.log(`[${name}] Atualizados ${counter} documentos com orgId=${DEFAULT_ORG_ID}`);
  }

  console.log("Concluido.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

