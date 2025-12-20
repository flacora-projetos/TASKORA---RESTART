import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type { SpendSnapshotItem } from "../services/dashboard-data.js";

export type SpendOverviewCacheEntity = {
  orgId: string;
  items: SpendSnapshotItem[];
  cachedAt: string;
};

export interface SpendOverviewCacheRepository {
  get(orgId: string): Promise<SpendOverviewCacheEntity | null>;
  save(entity: SpendOverviewCacheEntity): Promise<void>;
}

class InMemorySpendOverviewCacheRepository implements SpendOverviewCacheRepository {
  private store = new Map<string, SpendOverviewCacheEntity>();

  async get(orgId: string): Promise<SpendOverviewCacheEntity | null> {
    return this.store.get(orgId) ?? null;
  }

  async save(entity: SpendOverviewCacheEntity): Promise<void> {
    this.store.set(entity.orgId, entity);
  }
}

class FirestoreSpendOverviewCacheRepository implements SpendOverviewCacheRepository {
  private collection: FirebaseFirestore.CollectionReference<SpendOverviewCacheEntity>;

  constructor() {
    const db = getFirestoreDb();
    if (!db) {
      throw new Error("Firestore not configured");
    }
    this.collection = db.collection("spend_overview_cache") as FirebaseFirestore.CollectionReference<SpendOverviewCacheEntity>;
  }

  async get(orgId: string): Promise<SpendOverviewCacheEntity | null> {
    const doc = await this.collection.doc(orgId).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data() ?? null;
  }

  async save(entity: SpendOverviewCacheEntity): Promise<void> {
    await this.collection.doc(entity.orgId).set(entity);
  }
}

let repository: SpendOverviewCacheRepository | null = null;

export function getSpendOverviewCacheRepository(): SpendOverviewCacheRepository {
  if (repository) {
    return repository;
  }
  if (firestoreConfigured && getFirestoreDb()) {
    repository = new FirestoreSpendOverviewCacheRepository();
  } else {
    repository = new InMemorySpendOverviewCacheRepository();
  }
  return repository;
}

export function __resetSpendOverviewCacheRepository() {
  repository = null;
}
