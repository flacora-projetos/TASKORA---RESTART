import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type { PlatformKey, PlatformSummary } from "../services/client-metrics.js";

export type ClientMetricsStatusEntity = {
  id: string;
  orgId: string;
  clientId: string;
  clientName: string;
  platform: PlatformKey;
  status: PlatformSummary["status"];
  updatedAt: string;
};

export interface ClientMetricsStatusRepository {
  get(orgId: string, clientId: string, platform: PlatformKey): Promise<ClientMetricsStatusEntity | null>;
  upsert(
    orgId: string,
    clientId: string,
    clientName: string,
    platform: PlatformKey,
    status: PlatformSummary["status"]
  ): Promise<ClientMetricsStatusEntity>;
  listByOrg(orgId: string): Promise<ClientMetricsStatusEntity[]>;
}

function now() {
  return new Date().toISOString();
}

class InMemoryClientMetricsStatusRepository implements ClientMetricsStatusRepository {
  private store = new Map<string, ClientMetricsStatusEntity>();

  private buildKey(orgId: string, clientId: string, platform: PlatformKey) {
    return `${orgId}:${clientId}:${platform}`;
  }

  async get(orgId: string, clientId: string, platform: PlatformKey): Promise<ClientMetricsStatusEntity | null> {
    return this.store.get(this.buildKey(orgId, clientId, platform)) ?? null;
  }

  async listByOrg(orgId: string): Promise<ClientMetricsStatusEntity[]> {
    return Array.from(this.store.values()).filter((entity) => entity.orgId === orgId);
  }

  async upsert(
    orgId: string,
    clientId: string,
    clientName: string,
    platform: PlatformKey,
    status: PlatformSummary["status"]
  ): Promise<ClientMetricsStatusEntity> {
    const key = this.buildKey(orgId, clientId, platform);
    const entity: ClientMetricsStatusEntity = {
      id: key,
      orgId,
      clientId,
      clientName,
      platform,
      status,
      updatedAt: now()
    };
    this.store.set(key, entity);
    return entity;
  }
}

class FirestoreClientMetricsStatusRepository implements ClientMetricsStatusRepository {
  private collection: FirebaseFirestore.CollectionReference<ClientMetricsStatusEntity>;

  constructor() {
    const db = getFirestoreDb();
    if (!db) {
      throw new Error("Firestore not configured");
    }
    this.collection = db.collection("client_metrics_status") as FirebaseFirestore.CollectionReference<ClientMetricsStatusEntity>;
  }

  private docId(orgId: string, clientId: string, platform: PlatformKey) {
    return `${orgId}_${clientId}_${platform}`;
  }

  async get(orgId: string, clientId: string, platform: PlatformKey): Promise<ClientMetricsStatusEntity | null> {
    const snapshot = await this.collection.doc(this.docId(orgId, clientId, platform)).get();
    return snapshot.exists ? (snapshot.data() as ClientMetricsStatusEntity) : null;
  }

  async listByOrg(orgId: string): Promise<ClientMetricsStatusEntity[]> {
    const snapshot = await this.collection.where("orgId", "==", orgId).get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async upsert(
    orgId: string,
    clientId: string,
    clientName: string,
    platform: PlatformKey,
    status: PlatformSummary["status"]
  ): Promise<ClientMetricsStatusEntity> {
    const entity: ClientMetricsStatusEntity = {
      id: this.docId(orgId, clientId, platform),
      orgId,
      clientId,
      clientName,
      platform,
      status,
      updatedAt: now()
    };
    await this.collection.doc(entity.id).set(entity);
    return entity;
  }
}

let repository: ClientMetricsStatusRepository | null = null;

export function getClientMetricsStatusRepository(): ClientMetricsStatusRepository {
  if (repository) {
    return repository;
  }
  if (firestoreConfigured && getFirestoreDb()) {
    repository = new FirestoreClientMetricsStatusRepository();
  } else {
    repository = new InMemoryClientMetricsStatusRepository();
  }
  return repository;
}

export function __resetClientMetricsStatusRepository() {
  repository = null;
}
