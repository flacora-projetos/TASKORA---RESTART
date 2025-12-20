import { getFirestoreDb, firestoreConfigured } from "../firebase.js";
import type {
  ClientCreateInput,
  ClientEntity,
  ClientIntegrationInfo,
  ClientStatus,
  ClientUpdateInput,
} from "../types/clients.js";

type ListParams = {
  status?: ClientStatus;
  query?: string;
  responsibleId?: string;
};

export interface ClientsRepository {
  list(orgId: string, params?: ListParams): Promise<ClientEntity[]>;
  findById(orgId: string, id: string): Promise<ClientEntity | null>;
  create(orgId: string, data: ClientCreateInput, actorId: string): Promise<ClientEntity>;
  update(
    orgId: string,
    id: string,
    data: ClientUpdateInput,
    actorId: string,
  ): Promise<ClientEntity>;
  archive(orgId: string, id: string, actorId: string): Promise<ClientEntity>;
  updateIntegrations(
    orgId: string,
    id: string,
    integrations: ClientIntegrationInfo,
    actorId: string,
  ): Promise<ClientEntity>;
}

function getISODate(): string {
  return new Date().toISOString();
}

function sanitizeIdentifierArray(value?: string[] | null): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const sanitized = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return Array.from(new Set(sanitized));
}

function normalizeCreateInput(data: ClientCreateInput): ClientCreateInput {
  return {
    ...data,
    segment: data.segment ?? null,
    monthlyBudget:
      typeof data.monthlyBudget === "number" ? Number(data.monthlyBudget) : null,
    platforms: Array.isArray(data.platforms) ? data.platforms : [],
    driveLink: data.driveLink ?? null,
    whatsappGroup: data.whatsappGroup ?? null,
    status: data.status ?? "active",
    googleCustomerIds: sanitizeIdentifierArray(data.googleCustomerIds ?? null),
    metaAccountIds: sanitizeIdentifierArray(data.metaAccountIds ?? null),
    ga4PropertyIds: sanitizeIdentifierArray(data.ga4PropertyIds ?? null),
    pinterestAccountIds: sanitizeIdentifierArray(data.pinterestAccountIds ?? null),
    responsibleId: data.responsibleId ?? null,
  };
}

function resolveUpdatedIdentifiers(
  current: string[],
  next?: string[] | null,
): string[] {
  if (next === undefined) {
    return current;
  }
  return sanitizeIdentifierArray(next);
}

function applyUpdates(
  current: ClientEntity,
  data: ClientUpdateInput,
): ClientEntity {
  return {
    ...current,
    name: data.name ?? current.name,
    segment: data.segment ?? current.segment,
    monthlyBudget:
      data.monthlyBudget !== undefined
        ? data.monthlyBudget === null
          ? null
          : Number(data.monthlyBudget)
        : current.monthlyBudget,
    platforms: data.platforms ?? current.platforms,
    driveLink: data.driveLink ?? current.driveLink,
    whatsappGroup: data.whatsappGroup ?? current.whatsappGroup,
    status: data.status ?? current.status,
    googleCustomerIds: resolveUpdatedIdentifiers(
      current.googleCustomerIds,
      data.googleCustomerIds,
    ),
    metaAccountIds: resolveUpdatedIdentifiers(
      current.metaAccountIds,
      data.metaAccountIds,
    ),
    ga4PropertyIds: resolveUpdatedIdentifiers(
      current.ga4PropertyIds,
      data.ga4PropertyIds,
    ),
    pinterestAccountIds: resolveUpdatedIdentifiers(
      current.pinterestAccountIds,
      data.pinterestAccountIds,
    ),
    responsibleId:
      data.responsibleId !== undefined
        ? data.responsibleId === null
          ? null
          : data.responsibleId
        : current.responsibleId,
    updatedAt: getISODate(),
    integrations: current.integrations,
  };
}

/* -------------------------------------------------------------------------- */
/*                               In-Memory Repo                               */
/* -------------------------------------------------------------------------- */

class InMemoryClientsRepository implements ClientsRepository {
  private store = new Map<string, ClientEntity>();

  async list(orgId: string, params: ListParams = {}): Promise<ClientEntity[]> {
    let items = Array.from(this.store.values()).filter((item) => item.orgId === orgId);

    if (params.status) {
      items = items.filter((item) => item.status === params.status);
    } else {
      items = items.filter((item) => item.status !== "archived");
    }

    if (params.responsibleId) {
      items = items.filter((item) => item.responsibleId === params.responsibleId);
    }

    if (params.query) {
      const q = params.query.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.segment ?? "").toLowerCase().includes(q),
      );
    }

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(orgId: string, id: string): Promise<ClientEntity | null> {
    const item = this.store.get(id);
    if (!item || item.orgId !== orgId) {
      return null;
    }
    return item;
  }
  async create(
    orgId: string,
    data: ClientCreateInput,
    _actorId: string,
  ): Promise<ClientEntity> {
    const normalized = normalizeCreateInput(data);
    const now = getISODate();
    const id = crypto.randomUUID();

    const record: ClientEntity = {
      id,
      orgId,
      name: normalized.name,
      segment: normalized.segment ?? null,
      monthlyBudget: normalized.monthlyBudget ?? null,
      platforms: normalized.platforms ?? [],
      driveLink: normalized.driveLink ?? null,
      whatsappGroup: normalized.whatsappGroup ?? null,
      status: normalized.status ?? "active",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      googleCustomerIds: normalized.googleCustomerIds ?? [],
      metaAccountIds: normalized.metaAccountIds ?? [],
      ga4PropertyIds: normalized.ga4PropertyIds ?? [],
      pinterestAccountIds: normalized.pinterestAccountIds ?? [],
      responsibleId: normalized.responsibleId ?? null,
      integrations: null,
    };

    this.store.set(id, record);
    return record;
  }

  async update(
    orgId: string,
    id: string,
    data: ClientUpdateInput,
    _actorId: string,
  ): Promise<ClientEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Client not found");
    }

    const next = applyUpdates(current, data);
    this.store.set(id, next);
    return next;
  }

  async archive(orgId: string, id: string, _actorId: string): Promise<ClientEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Client not found");
    }

    const now = getISODate();
    const next: ClientEntity = {
      ...current,
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    };

    this.store.set(id, next);
    return next;
  }

  async updateIntegrations(
    orgId: string,
    id: string,
    integrations: ClientIntegrationInfo,
    _actorId: string,
  ): Promise<ClientEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Client not found");
    }

    const next: ClientEntity = {
      ...current,
      integrations,
      googleCustomerIds: sanitizeIdentifierArray(
        integrations.googleCustomerIds ?? current.googleCustomerIds,
      ),
      metaAccountIds: sanitizeIdentifierArray(
        integrations.metaAccountIds ?? current.metaAccountIds,
      ),
      ga4PropertyIds: sanitizeIdentifierArray(
        integrations.ga4PropertyIds ?? current.ga4PropertyIds,
      ),
      pinterestAccountIds: current.pinterestAccountIds,
      updatedAt: getISODate(),
    };
    this.store.set(id, next);
    return next;
  }
}

/* -------------------------------------------------------------------------- */
/*                               Firestore Repo                               */
/* -------------------------------------------------------------------------- */

class FirestoreClientsRepository implements ClientsRepository {
  private collection: FirebaseFirestore.CollectionReference;

  constructor() {
    const firestore = getFirestoreDb();
    if (!firestore) {
      throw new Error("Firestore not configured");
    }
    this.collection = firestore.collection("clients");
  }

  private docToEntity(doc: FirebaseFirestore.DocumentSnapshot): ClientEntity {
    const data = doc.data() as Omit<ClientEntity, "id"> | undefined;
    if (!data) {
      throw new Error("Invalid Firestore document");
    }

    return {
      id: doc.id,
      ...data,
      platforms: Array.isArray(data.platforms) ? data.platforms : [],
      googleCustomerIds: Array.isArray(data.googleCustomerIds)
        ? data.googleCustomerIds
        : [],
      metaAccountIds: Array.isArray(data.metaAccountIds)
        ? data.metaAccountIds
        : [],
      ga4PropertyIds: Array.isArray(data.ga4PropertyIds)
        ? data.ga4PropertyIds
        : [],
      pinterestAccountIds: Array.isArray(data.pinterestAccountIds)
        ? data.pinterestAccountIds
        : [],
      responsibleId:
        typeof data.responsibleId === "string" && data.responsibleId.length > 0
          ? data.responsibleId
          : null,
    };
  }

  async list(orgId: string, params: ListParams = {}): Promise<ClientEntity[]> {
    let query: FirebaseFirestore.Query = this.collection.where("orgId", "==", orgId);

    if (params.status) {
      query = query.where("status", "==", params.status);
    }
    if (params.responsibleId) {
      query = query.where("responsibleId", "==", params.responsibleId);
    }

    const snapshot = await query.orderBy("createdAt", "desc").get();
    let items = snapshot.docs.map((doc) => this.docToEntity(doc));

    if (!params.status) {
      items = items.filter((item) => item.status !== "archived");
    }

    if (params.query) {
      const q = params.query.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          (item.segment ?? "").toLowerCase().includes(q),
      );
    }
    if (params.responsibleId) {
      items = items.filter((item) => item.responsibleId === params.responsibleId);
    }

    return items;
  }

  async findById(orgId: string, id: string): Promise<ClientEntity | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const entity = this.docToEntity(doc);
    if (entity.orgId !== orgId) {
      return null;
    }
    return entity;
  }

  async create(
    orgId: string,
    data: ClientCreateInput,
    _actorId: string,
  ): Promise<ClientEntity> {
    const normalized = normalizeCreateInput(data);
    const now = getISODate();

    const docRef = this.collection.doc();
    const record: ClientEntity = {
      id: docRef.id,
      orgId,
      name: normalized.name,
      segment: normalized.segment ?? null,
      monthlyBudget: normalized.monthlyBudget ?? null,
      platforms: normalized.platforms ?? [],
      driveLink: normalized.driveLink ?? null,
      whatsappGroup: normalized.whatsappGroup ?? null,
      status: normalized.status ?? "active",
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      googleCustomerIds: normalized.googleCustomerIds ?? [],
      metaAccountIds: normalized.metaAccountIds ?? [],
      ga4PropertyIds: normalized.ga4PropertyIds ?? [],
      pinterestAccountIds: normalized.pinterestAccountIds ?? [],
      responsibleId: normalized.responsibleId ?? null,
      integrations: null,
    };

    await docRef.set(record);
    return record;
  }

  async update(
    orgId: string,
    id: string,
    data: ClientUpdateInput,
    _actorId: string,
  ): Promise<ClientEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Client not found");
    }

    const next = applyUpdates(current, data);
    await this.collection.doc(id).set(next);
    return next;
  }

  async archive(orgId: string, id: string, _actorId: string): Promise<ClientEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Client not found");
    }

    const now = getISODate();
    const next: ClientEntity = {
      ...current,
      status: "archived",
      archivedAt: now,
      updatedAt: now,
    };

    await this.collection.doc(id).set(next);
    return next;
  }

  async updateIntegrations(
    orgId: string,
    id: string,
    integrations: ClientIntegrationInfo,
    _actorId: string,
  ): Promise<ClientEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Client not found");
    }

    const next: ClientEntity = {
      ...current,
      integrations,
      googleCustomerIds: sanitizeIdentifierArray(
        integrations.googleCustomerIds ?? current.googleCustomerIds,
      ),
      metaAccountIds: sanitizeIdentifierArray(
        integrations.metaAccountIds ?? current.metaAccountIds,
      ),
      ga4PropertyIds: sanitizeIdentifierArray(
        integrations.ga4PropertyIds ?? current.ga4PropertyIds,
      ),
      pinterestAccountIds: current.pinterestAccountIds,
      updatedAt: getISODate(),
    };

    await this.collection.doc(id).set(next);
    return next;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Repository Factory                             */
/* -------------------------------------------------------------------------- */

let repository: ClientsRepository | null = null;

export function getClientsRepository(): ClientsRepository {
  if (!repository) {
    if (firestoreConfigured && getFirestoreDb()) {
      repository = new FirestoreClientsRepository();
    } else {
      repository = new InMemoryClientsRepository();
    }
  }
  return repository;
}
