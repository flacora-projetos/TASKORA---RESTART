import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type {
  ClientTimelineCreateInput,
  ClientTimelineEvent,
  ClientTimelineListParams
} from "../types/client-timeline.js";

export interface ClientTimelineRepository {
  list(orgId: string, clientId: string, params?: ClientTimelineListParams): Promise<ClientTimelineEvent[]>;
  listByOrg(orgId: string, params?: ClientTimelineListParams & { clientId?: string }): Promise<ClientTimelineEvent[]>;
  add(
    orgId: string,
    clientId: string,
    data: ClientTimelineCreateInput,
    actor: { id: string | null; label: string | null }
  ): Promise<ClientTimelineEvent>;
}

function getNow(): string {
  return new Date().toISOString();
}

function sanitizeTags(tags?: string[]): string[] {
  if (!Array.isArray(tags)) {
    return [];
  }
  return Array.from(
    new Set(
      tags
        .map((tag) => tag?.trim())
        .filter((tag): tag is string => Boolean(tag))
        .map((tag) => tag.slice(0, 32))
    )
  ).slice(0, 6);
}

function normalizeInput(data: ClientTimelineCreateInput) {
  const occurredAt =
    data.occurredAt && !Number.isNaN(Date.parse(data.occurredAt))
      ? new Date(data.occurredAt).toISOString()
      : getNow();
  const projectId = typeof data.metadata?.["projectId"] === "string" ? data.metadata["projectId"] : null;
  const taskId = typeof data.metadata?.["taskId"] === "string" ? data.metadata["taskId"] : null;
  return {
    ...data,
    occurredAt,
    description: data.description ?? null,
    metadata: data.metadata ?? null,
    source: data.source ?? null,
    tags: sanitizeTags(data.tags),
    projectId,
    taskId
  };
}

/* -------------------------------------------------------------------------- */
/*                               In-Memory Repo                               */
/* -------------------------------------------------------------------------- */

class InMemoryClientTimelineRepository implements ClientTimelineRepository {
  private store = new Map<string, ClientTimelineEvent>();

  async list(
    orgId: string,
    clientId: string,
    params: ClientTimelineListParams = {}
  ): Promise<ClientTimelineEvent[]> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 200);
    let items = Array.from(this.store.values()).filter(
      (event) => event.orgId === orgId && event.clientId === clientId
    );

    if (params.eventType) {
      items = items.filter((event) => event.eventType === params.eventType);
    }

    if (params.before) {
      items = items.filter((event) => event.occurredAt < params.before!);
    }

    return items
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit);
  }

  async listByOrg(
    orgId: string,
    params: ClientTimelineListParams & { clientId?: string } = {}
  ): Promise<ClientTimelineEvent[]> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 200);
    let items = Array.from(this.store.values()).filter((event) => event.orgId === orgId);

    if (params.clientId) {
      items = items.filter((event) => event.clientId === params.clientId);
    }
    if (params.eventType) {
      items = items.filter((event) => event.eventType === params.eventType);
    }
    if (params.before) {
      items = items.filter((event) => event.occurredAt < params.before!);
    }
    if (params.from) {
      items = items.filter((event) => event.occurredAt >= params.from!);
    }
    if (params.to) {
      items = items.filter((event) => event.occurredAt <= params.to!);
    }

    return items
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit);
  }

  async add(
    orgId: string,
    clientId: string,
    data: ClientTimelineCreateInput,
    actor: { id: string | null; label: string | null }
  ): Promise<ClientTimelineEvent> {
    const normalized = normalizeInput(data);
    const id = crypto.randomUUID();
    const now = getNow();
    const record: ClientTimelineEvent = {
      id,
      orgId,
      clientId,
      eventType: normalized.eventType,
      title: normalized.title,
      description: normalized.description,
      tags: normalized.tags,
      metadata: normalized.metadata,
      occurredAt: normalized.occurredAt,
      createdAt: now,
      actorId: actor.id,
      actorLabel: actor.label,
      source: normalized.source,
      projectId: normalized.projectId ?? null,
      taskId: normalized.taskId ?? null
    };

    this.store.set(id, record);
    return record;
  }
}

/* -------------------------------------------------------------------------- */
/*                               Firestore Repo                               */
/* -------------------------------------------------------------------------- */

class FirestoreClientTimelineRepository implements ClientTimelineRepository {
  private collection: FirebaseFirestore.CollectionReference<ClientTimelineEvent>;

  constructor() {
    const db = getFirestoreDb();
    if (!db) {
      throw new Error("Firestore is not configured");
    }
    this.collection = db.collection("client_timeline") as FirebaseFirestore.CollectionReference<ClientTimelineEvent>;
  }

  async list(
    orgId: string,
    clientId: string,
    params: ClientTimelineListParams = {}
  ): Promise<ClientTimelineEvent[]> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    let query: FirebaseFirestore.Query<ClientTimelineEvent> = this.collection
      .where("orgId", "==", orgId)
      .where("clientId", "==", clientId)
      .orderBy("occurredAt", "desc");

    if (params.eventType) {
      query = query.where("eventType", "==", params.eventType);
    }

    if (params.before) {
      query = query.where("occurredAt", "<", params.before);
    }
    if (params.from) {
      query = query.where("occurredAt", ">=", params.from);
    }
    if (params.to) {
      query = query.where("occurredAt", "<=", params.to);
    }

    const snapshot = await query.limit(limit).get();

    return snapshot.docs.map((doc) => doc.data());
  }

  async listByOrg(
    orgId: string,
    params: ClientTimelineListParams & { clientId?: string } = {}
  ): Promise<ClientTimelineEvent[]> {
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    let query: FirebaseFirestore.Query<ClientTimelineEvent> = this.collection
      .where("orgId", "==", orgId)
      .orderBy("occurredAt", "desc");

    if (params.clientId) {
      query = query.where("clientId", "==", params.clientId);
    }

    if (params.eventType) {
      query = query.where("eventType", "==", params.eventType);
    }

    if (params.before) {
      query = query.where("occurredAt", "<", params.before);
    }
    if (params.from) {
      query = query.where("occurredAt", ">=", params.from);
    }
    if (params.to) {
      query = query.where("occurredAt", "<=", params.to);
    }

    const snapshot = await query.limit(limit).get();
    return snapshot.docs.map((doc) => doc.data());
  }

  async add(
    orgId: string,
    clientId: string,
    data: ClientTimelineCreateInput,
    actor: { id: string | null; label: string | null }
  ): Promise<ClientTimelineEvent> {
    const normalized = normalizeInput(data);
    const now = getNow();
    const docRef = this.collection.doc();
    const record: ClientTimelineEvent = {
      id: docRef.id,
      orgId,
      clientId,
      eventType: normalized.eventType,
      title: normalized.title,
      description: normalized.description,
      tags: normalized.tags,
      metadata: normalized.metadata,
      occurredAt: normalized.occurredAt,
      createdAt: now,
      actorId: actor.id,
      actorLabel: actor.label,
      source: normalized.source
    };

    await docRef.set(record);
    return record;
  }
}
/* -------------------------------------------------------------------------- */
/*                              Repository Factory                             */
/* -------------------------------------------------------------------------- */

let repository: ClientTimelineRepository | null = null;

export function getClientTimelineRepository(): ClientTimelineRepository {
  if (!repository) {
    if (firestoreConfigured && getFirestoreDb()) {
      repository = new FirestoreClientTimelineRepository();
    } else {
      repository = new InMemoryClientTimelineRepository();
    }
  }

  return repository;
}
