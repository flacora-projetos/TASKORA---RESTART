import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type {
  TeamMemberCreateInput,
  TeamMemberEntity,
  TeamMemberStatus,
  TeamMemberUpdateInput
} from "../types/team-members.js";

type ListParams = {
  status?: TeamMemberStatus;
};

export interface TeamMembersRepository {
  list(orgId: string, params?: ListParams): Promise<TeamMemberEntity[]>;
  findById(orgId: string, id: string): Promise<TeamMemberEntity | null>;
  create(orgId: string, data: TeamMemberCreateInput, actorId: string): Promise<TeamMemberEntity>;
  update(orgId: string, id: string, data: TeamMemberUpdateInput, actorId: string): Promise<TeamMemberEntity>;
  archive(orgId: string, id: string, actorId: string): Promise<TeamMemberEntity>;
  hardDelete(orgId: string, id: string, actorId: string): Promise<void>;
}

function getISODate(): string {
  return new Date().toISOString();
}

function normalizeCreateInput(data: TeamMemberCreateInput): TeamMemberCreateInput {
  const normalizedEmail = data.email?.trim().toLowerCase();
  return {
    ...data,
    email: normalizedEmail ?? null,
    phone: data.phone?.trim() ?? null,
    color: data.color?.trim() ?? null,
    weeklyCapacityMinutes:
      typeof data.weeklyCapacityMinutes === "number" ? Number(data.weeklyCapacityMinutes) : null,
    userId: data.userId?.trim() ?? null,
    role: data.role ?? "analista",
    accessRole: data.accessRole ?? "member",
    status: data.status ?? "active"
  };
}

function applyUpdates(current: TeamMemberEntity, data: TeamMemberUpdateInput): TeamMemberEntity {
  const normalizedEmail =
    data.email !== undefined && data.email !== null ? data.email.trim().toLowerCase() : data.email;
  return {
    ...current,
    name: data.name ?? current.name,
    email: normalizedEmail !== undefined ? normalizedEmail ?? null : current.email,
    phone: data.phone !== undefined ? data.phone?.trim() ?? null : current.phone,
    color: data.color !== undefined ? data.color?.trim() ?? null : current.color,
    weeklyCapacityMinutes:
      data.weeklyCapacityMinutes !== undefined
        ? data.weeklyCapacityMinutes === null
          ? null
          : Number(data.weeklyCapacityMinutes)
        : current.weeklyCapacityMinutes,
    userId: data.userId !== undefined ? data.userId?.trim() ?? null : current.userId,
    role: data.role ?? current.role,
    accessRole: data.accessRole ?? current.accessRole,
    status: data.status ?? current.status,
    updatedAt: getISODate()
  };
}

class InMemoryTeamMembersRepository implements TeamMembersRepository {
  private store = new Map<string, TeamMemberEntity>();

  async list(orgId: string, params: ListParams = {}): Promise<TeamMemberEntity[]> {
    let items = Array.from(this.store.values()).filter((item) => item.orgId === orgId);
    if (params.status) {
      items = items.filter((item) => item.status === params.status);
    }
    return items.sort((a, b) => a.name.localeCompare(b.name));
  }

  async findById(orgId: string, id: string): Promise<TeamMemberEntity | null> {
    const item = this.store.get(id);
    if (!item || item.orgId !== orgId) {
      return null;
    }
    return item;
  }

  async create(orgId: string, data: TeamMemberCreateInput, _actorId: string): Promise<TeamMemberEntity> {
    const normalized = normalizeCreateInput(data);
    const now = getISODate();
    const id = crypto.randomUUID();
    const record: TeamMemberEntity = {
      id,
      orgId,
      name: normalized.name,
      email: normalized.email ?? null,
      phone: normalized.phone ?? null,
      color: normalized.color ?? null,
      weeklyCapacityMinutes: normalized.weeklyCapacityMinutes ?? null,
      userId: normalized.userId ?? null,
      role: normalized.role ?? "analista",
      accessRole: normalized.accessRole ?? "member",
      status: normalized.status ?? "active",
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    this.store.set(id, record);
    return record;
  }

  async update(orgId: string, id: string, data: TeamMemberUpdateInput, _actorId: string): Promise<TeamMemberEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Team member not found");
    }
    const next = applyUpdates(current, data);
    this.store.set(id, next);
    return next;
  }

  async archive(orgId: string, id: string, _actorId: string): Promise<TeamMemberEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Team member not found");
    }
    const now = getISODate();
    const next: TeamMemberEntity = {
      ...current,
      status: "inactive",
      archivedAt: now,
      updatedAt: now
    };
    this.store.set(id, next);
    return next;
  }

  async hardDelete(orgId: string, id: string, _actorId: string): Promise<void> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Team member not found");
    }
    this.store.delete(id);
  }
}

class FirestoreTeamMembersRepository implements TeamMembersRepository {
  private collection: FirebaseFirestore.CollectionReference<TeamMemberEntity>;

  constructor() {
    const firestore = getFirestoreDb();
    if (!firestore) {
      throw new Error("Firestore not configured");
    }
    this.collection = firestore.collection("team_members") as FirebaseFirestore.CollectionReference<TeamMemberEntity>;
  }

  private docToEntity(doc: FirebaseFirestore.DocumentSnapshot<TeamMemberEntity>): TeamMemberEntity {
    const data = doc.data();
    if (!data) {
      throw new Error("Invalid document");
    }
    const { id: _ignoredId, ...rest } = data;
    return { ...rest, id: doc.id, accessRole: rest.accessRole ?? "member" };
  }

  async list(orgId: string, params: ListParams = {}): Promise<TeamMemberEntity[]> {
    let query: FirebaseFirestore.Query<TeamMemberEntity> = this.collection.where("orgId", "==", orgId);
    if (params.status) {
      query = query.where("status", "==", params.status);
    }
    const snapshot = await query.orderBy("name").get();
    return snapshot.docs.map((doc) => this.docToEntity(doc));
  }

  async findById(orgId: string, id: string): Promise<TeamMemberEntity | null> {
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

  async create(orgId: string, data: TeamMemberCreateInput, _actorId: string): Promise<TeamMemberEntity> {
    const normalized = normalizeCreateInput(data);
    const now = getISODate();
    const ref = this.collection.doc();
    const record: TeamMemberEntity = {
      id: ref.id,
      orgId,
      name: normalized.name,
      email: normalized.email ?? null,
      phone: normalized.phone ?? null,
      color: normalized.color ?? null,
      weeklyCapacityMinutes: normalized.weeklyCapacityMinutes ?? null,
      userId: normalized.userId ?? null,
      role: normalized.role ?? "analista",
      accessRole: normalized.accessRole ?? "member",
      status: normalized.status ?? "active",
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    await ref.set(record);
    return record;
  }

  async update(orgId: string, id: string, data: TeamMemberUpdateInput, _actorId: string): Promise<TeamMemberEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Team member not found");
    }
    const next = applyUpdates(current, data);
    await this.collection.doc(id).set(next);
    return next;
  }

  async archive(orgId: string, id: string, _actorId: string): Promise<TeamMemberEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Team member not found");
    }
    const now = getISODate();
    const next: TeamMemberEntity = {
      ...current,
      status: "inactive",
      archivedAt: now,
      updatedAt: now
    };
    await this.collection.doc(id).set(next);
    return next;
  }

  async hardDelete(orgId: string, id: string, _actorId: string): Promise<void> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Team member not found");
    }
    await this.collection.doc(id).delete();
  }
}

let repository: TeamMembersRepository | null = null;

export function getTeamMembersRepository(): TeamMembersRepository {
  if (!repository) {
    if (firestoreConfigured && getFirestoreDb()) {
      repository = new FirestoreTeamMembersRepository();
    } else {
      repository = new InMemoryTeamMembersRepository();
    }
  }
  return repository;
}
