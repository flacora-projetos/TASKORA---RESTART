import { getFirestoreDb, firestoreConfigured } from "../firebase.js";
import type {
  ProjectCreateInput,
  ProjectEntity,
  ProjectStatus,
  ProjectUpdateInput,
} from "../types/projects.js";

type ListParams = {
  status?: ProjectStatus;
  clientId?: string;
};

export interface ProjectsRepository {
  list(orgId: string, params?: ListParams): Promise<ProjectEntity[]>;
  findById(orgId: string, id: string): Promise<ProjectEntity | null>;
  create(orgId: string, data: ProjectCreateInput, actorId: string): Promise<ProjectEntity>;
  update(
    orgId: string,
    id: string,
    data: ProjectUpdateInput,
    actorId: string,
  ): Promise<ProjectEntity>;
  archive(orgId: string, id: string, actorId: string): Promise<ProjectEntity>;
}

function getISODate(): string {
  return new Date().toISOString();
}

function normalizeCreateInput(data: ProjectCreateInput): ProjectCreateInput {
  return {
    ...data,
    ownerId: data.ownerId ?? null,
    budget: typeof data.budget === "number" ? Number(data.budget) : null,
    startDate: data.startDate ?? null,
    endDate: data.endDate ?? null,
    status: data.status ?? "draft",
    notes: data.notes ?? null,
  };
}

function applyUpdates(
  current: ProjectEntity,
  data: ProjectUpdateInput,
): ProjectEntity {
  return {
    ...current,
    clientId: data.clientId ?? current.clientId,
    name: data.name ?? current.name,
    ownerId: data.ownerId ?? current.ownerId,
    budget:
      data.budget !== undefined
        ? data.budget === null
          ? null
          : Number(data.budget)
        : current.budget,
    startDate: data.startDate ?? current.startDate,
    endDate: data.endDate ?? current.endDate,
    status: data.status ?? current.status,
    notes: data.notes ?? current.notes,
    updatedAt: getISODate(),
  };
}

/* -------------------------------------------------------------------------- */
/*                               In-Memory Repo                               */
/* -------------------------------------------------------------------------- */

class InMemoryProjectsRepository implements ProjectsRepository {
  private store = new Map<string, ProjectEntity>();

  async list(orgId: string, params: ListParams = {}): Promise<ProjectEntity[]> {
    let items = Array.from(this.store.values()).filter((item) => item.orgId === orgId);

    if (params.clientId) {
      items = items.filter((item) => item.clientId === params.clientId);
    }

    if (params.status) {
      items = items.filter((item) => item.status === params.status);
    }

    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(orgId: string, id: string): Promise<ProjectEntity | null> {
    const item = this.store.get(id);
    if (!item || item.orgId !== orgId) {
      return null;
    }
    return item;
  }

  async create(
    orgId: string,
    data: ProjectCreateInput,
    _actorId: string,
  ): Promise<ProjectEntity> {
    const normalized = normalizeCreateInput(data);
    const now = getISODate();
    const id = crypto.randomUUID();

    const record: ProjectEntity = {
      id,
      orgId,
      clientId: normalized.clientId,
      name: normalized.name,
      ownerId: normalized.ownerId ?? null,
      budget: normalized.budget ?? null,
      startDate: normalized.startDate ?? null,
      endDate: normalized.endDate ?? null,
      status: normalized.status ?? "draft",
      notes: normalized.notes ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      integrations: null,
    };

    this.store.set(id, record);
    return record;
  }

  async update(
    orgId: string,
    id: string,
    data: ProjectUpdateInput,
    _actorId: string,
  ): Promise<ProjectEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Project not found");
    }

    const next = applyUpdates(current, data);
    this.store.set(id, next);
    return next;
  }

  async archive(orgId: string, id: string, _actorId: string): Promise<ProjectEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Project not found");
    }

    const now = getISODate();
    const next: ProjectEntity = {
      ...current,
      status: "completed",
      archivedAt: now,
      updatedAt: now,
    };

    this.store.set(id, next);
    return next;
  }
}

/* -------------------------------------------------------------------------- */
/*                               Firestore Repo                               */
/* -------------------------------------------------------------------------- */

class FirestoreProjectsRepository implements ProjectsRepository {
  private collection: FirebaseFirestore.CollectionReference;

  constructor() {
    const firestore = getFirestoreDb();
    if (!firestore) {
      throw new Error("Firestore not configured");
    }
    this.collection = firestore.collection("projects");
  }

  private docToEntity(doc: FirebaseFirestore.DocumentSnapshot): ProjectEntity {
    const data = doc.data() as Omit<ProjectEntity, "id"> | undefined;
    if (!data) {
      throw new Error("Invalid Firestore document");
    }

    return {
      id: doc.id,
      ...data,
    };
  }

  async list(orgId: string, params: ListParams = {}): Promise<ProjectEntity[]> {
    let query: FirebaseFirestore.Query = this.collection.where("orgId", "==", orgId);

    if (params.clientId) {
      query = query.where("clientId", "==", params.clientId);
    }

    if (params.status) {
      query = query.where("status", "==", params.status);
    }

    const snapshot = await query.orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => this.docToEntity(doc));
  }

  async findById(orgId: string, id: string): Promise<ProjectEntity | null> {
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
    data: ProjectCreateInput,
    _actorId: string,
  ): Promise<ProjectEntity> {
    const normalized = normalizeCreateInput(data);
    const now = getISODate();

    const docRef = this.collection.doc();
    const record: ProjectEntity = {
      id: docRef.id,
      orgId,
      clientId: normalized.clientId,
      name: normalized.name,
      ownerId: normalized.ownerId ?? null,
      budget: normalized.budget ?? null,
      startDate: normalized.startDate ?? null,
      endDate: normalized.endDate ?? null,
      status: normalized.status ?? "draft",
      notes: normalized.notes ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      integrations: null,
    };

    await docRef.set(record);
    return record;
  }

  async update(
    orgId: string,
    id: string,
    data: ProjectUpdateInput,
    _actorId: string,
  ): Promise<ProjectEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Project not found");
    }

    const next = applyUpdates(current, data);
    await this.collection.doc(id).set(next);
    return next;
  }

  async archive(orgId: string, id: string, _actorId: string): Promise<ProjectEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Project not found");
    }

    const now = getISODate();
    const next: ProjectEntity = {
      ...current,
      status: "completed",
      archivedAt: now,
      updatedAt: now,
    };

    await this.collection.doc(id).set(next);
    return next;
  }
}

/* -------------------------------------------------------------------------- */
/*                              Repository Factory                             */
/* -------------------------------------------------------------------------- */

let repository: ProjectsRepository | null = null;

export function getProjectsRepository(): ProjectsRepository {
  if (!repository) {
    if (firestoreConfigured && getFirestoreDb()) {
      repository = new FirestoreProjectsRepository();
    } else {
      repository = new InMemoryProjectsRepository();
    }
  }
  return repository;
}
