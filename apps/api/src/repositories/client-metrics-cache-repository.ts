import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type { MetricsRange, PlatformKey, PlatformTotals, PlatformKpi } from "../services/client-metrics.js";

export type ClientMetricsCacheEntity = {
  id: string;
  orgId: string;
  clientId: string;
  platform: PlatformKey;
  range: MetricsRange;
  totals: PlatformTotals;
  lastSynced: string | null;
  cachedAt: string;
  kpis?: PlatformKpi[];
};

export interface ClientMetricsCacheRepository {
  save(entity: ClientMetricsCacheEntity): Promise<void>;
  get(orgId: string, clientId: string, platform: PlatformKey, range: MetricsRange): Promise<ClientMetricsCacheEntity | null>;
}

function nowISO() {
  return new Date().toISOString();
}

class InMemoryClientMetricsCacheRepository implements ClientMetricsCacheRepository {
  private store = new Map<string, ClientMetricsCacheEntity>();

  private key(orgId: string, clientId: string, platform: PlatformKey, range: MetricsRange): string {
    return `${orgId}:${clientId}:${platform}:${range}`;
  }

  async save(entity: ClientMetricsCacheEntity): Promise<void> {
    this.store.set(this.key(entity.orgId, entity.clientId, entity.platform, entity.range), {
      ...entity,
      cachedAt: nowISO()
    });
  }

  async get(orgId: string, clientId: string, platform: PlatformKey, range: MetricsRange): Promise<ClientMetricsCacheEntity | null> {
    const entity = this.store.get(this.key(orgId, clientId, platform, range));
    return entity ?? null;
  }
}

class FirestoreClientMetricsCacheRepository implements ClientMetricsCacheRepository {
  private collection: FirebaseFirestore.CollectionReference<ClientMetricsCacheEntity>;

  constructor() {
    const db = getFirestoreDb();
    if (!db) {
      throw new Error("Firestore not configured");
    }
    this.collection = db.collection("client_metrics_cache") as FirebaseFirestore.CollectionReference<ClientMetricsCacheEntity>;
  }

  private docId(orgId: string, clientId: string, platform: PlatformKey, range: MetricsRange) {
    return `${orgId}_${clientId}_${platform}_${range}`;
  }

  async save(entity: ClientMetricsCacheEntity): Promise<void> {
    const payload: ClientMetricsCacheEntity = {
      ...entity,
      cachedAt: nowISO()
    };
    await this.collection.doc(this.docId(entity.orgId, entity.clientId, entity.platform, entity.range)).set(payload);
  }

  async get(orgId: string, clientId: string, platform: PlatformKey, range: MetricsRange): Promise<ClientMetricsCacheEntity | null> {
    const doc = await this.collection.doc(this.docId(orgId, clientId, platform, range)).get();
    return doc.exists ? (doc.data() as ClientMetricsCacheEntity) : null;
  }
}

let repository: ClientMetricsCacheRepository | null = null;

export function getClientMetricsCacheRepository(): ClientMetricsCacheRepository {
  if (repository) {
    return repository;
  }
  if (firestoreConfigured && getFirestoreDb()) {
    repository = new FirestoreClientMetricsCacheRepository();
  } else {
    repository = new InMemoryClientMetricsCacheRepository();
  }
  return repository;
}

export function __resetClientMetricsCacheRepository() {
  repository = null;
}
