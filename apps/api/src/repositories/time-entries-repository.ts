import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type {
  TimeEntryCreateInput,
  TimeEntryEntity,
  TimeEntryUpdateInput
} from "../types/time-entries.js";

type ListParams = {
  projectId?: string;
  taskId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
};

export interface TimeEntriesRepository {
  list(orgId: string, params?: ListParams): Promise<TimeEntryEntity[]>; 
  findById(orgId: string, id: string): Promise<TimeEntryEntity | null>; 
  create(orgId: string, data: TimeEntryCreateInput, actorId: string): Promise<TimeEntryEntity>; 
  update(orgId: string, id: string, data: TimeEntryUpdateInput, actorId: string): Promise<TimeEntryEntity>; 
  delete(orgId: string, id: string): Promise<void>; 
  summarizeByProject(orgId: string, projectId: string): Promise<Record<string, number>>; 
  reassignProject(orgId: string, taskId: string, projectId: string): Promise<void>;
}

function getISODate(): string {
  return new Date().toISOString();
}

function normalizeInput(data: TimeEntryCreateInput, actorId: string) {
  return {
    projectId: data.projectId,
    taskId: data.taskId,
    userId: data.userId?.trim() || actorId,
    date: new Date(data.date).toISOString(),
    reportedMinutes: Number(data.reportedMinutes),
    notes: data.notes ?? null
  };
}

function applyFilters(entries: TimeEntryEntity[], params: ListParams = {}): TimeEntryEntity[] {
  let results = entries;

  if (params.projectId) {
    results = results.filter((entry) => entry.projectId === params.projectId);
  }
  if (params.taskId) {
    results = results.filter((entry) => entry.taskId === params.taskId);
  }
  if (params.userId) {
    results = results.filter((entry) => entry.userId === params.userId);
  }

  if (params.startDate) {
    const start = new Date(params.startDate).toISOString();
    results = results.filter((entry) => entry.date >= start);
  }

  if (params.endDate) {
    const end = new Date(params.endDate).toISOString();
    results = results.filter((entry) => entry.date <= end);
  }

  results = results.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const limit = params.limit ?? 20;
  return results.slice(0, limit);
}

class InMemoryTimeEntriesRepository implements TimeEntriesRepository {
  private store = new Map<string, TimeEntryEntity>();

  async list(orgId: string, params: ListParams = {}): Promise<TimeEntryEntity[]> {
    const items = Array.from(this.store.values()).filter((entry) => entry.orgId === orgId);
    return applyFilters(items, params);
  }

  async findById(orgId: string, id: string): Promise<TimeEntryEntity | null> {
    const entry = this.store.get(id);
    if (!entry || entry.orgId !== orgId) {
      return null;
    }
    return entry;
  }

  async create(orgId: string, data: TimeEntryCreateInput, actorId: string): Promise<TimeEntryEntity> {
    const normalized = normalizeInput(data, actorId);
    const now = getISODate();
    const id = crypto.randomUUID();

    const record: TimeEntryEntity = {
      id,
      orgId,
      projectId: normalized.projectId,
      taskId: normalized.taskId,
      userId: normalized.userId,
      recordedBy: actorId,
      date: normalized.date,
      reportedMinutes: normalized.reportedMinutes,
      notes: normalized.notes,
      createdAt: now,
      updatedAt: now
    };

    this.store.set(id, record);
    return record;
  }

  async update(orgId: string, id: string, data: TimeEntryUpdateInput, actorId: string): Promise<TimeEntryEntity> {
    const current = this.store.get(id);
    if (!current || current.orgId !== orgId) {
      throw new Error("Time entry not found");
    }

    const next: TimeEntryEntity = {
      ...current,
      projectId: data.projectId ?? current.projectId,
      taskId: data.taskId ?? current.taskId,
      userId: data.userId?.trim() || current.userId,
      date: data.date ? new Date(data.date).toISOString() : current.date,
      reportedMinutes: data.reportedMinutes !== undefined ? Number(data.reportedMinutes) : current.reportedMinutes,
      notes: data.notes !== undefined ? data.notes ?? null : current.notes,
      updatedAt: getISODate(),
      recordedBy: actorId
    };

    this.store.set(id, next);
    return next;
  }

  async delete(orgId: string, id: string): Promise<void> {
    const current = this.store.get(id);
    if (!current || current.orgId !== orgId) {
      throw new Error("Time entry not found");
    }
    this.store.delete(id);
  }

  async summarizeByProject(orgId: string, projectId: string): Promise<Record<string, number>> {
    const totals: Record<string, number> = {};
    for (const entry of this.store.values()) {
      if (entry.orgId !== orgId || entry.projectId !== projectId) {
        continue;
      }
      totals[entry.taskId] = (totals[entry.taskId] ?? 0) + entry.reportedMinutes;
    }
    return totals;
  }

  async reassignProject(orgId: string, taskId: string, projectId: string): Promise<void> {
    for (const entry of this.store.values()) {
      if (entry.orgId === orgId && entry.taskId === taskId) {
        entry.projectId = projectId;
        entry.updatedAt = getISODate();
      }
    }
  }
}

class FirestoreTimeEntriesRepository implements TimeEntriesRepository {
  private collection: FirebaseFirestore.CollectionReference;

  constructor() {
    const firestore = getFirestoreDb();
    if (!firestore) {
      throw new Error("Firestore not configured");
    }
    this.collection = firestore.collection("time_entries");
  }

  private docToEntity(doc: FirebaseFirestore.DocumentSnapshot): TimeEntryEntity {
    const data = doc.data() as Omit<TimeEntryEntity, "id"> | undefined;
    if (!data) {
      throw new Error("Invalid Firestore document");
    }
    return { id: doc.id, ...data };
  }

  async list(orgId: string, params: ListParams = {}): Promise<TimeEntryEntity[]> {
    let query: FirebaseFirestore.Query = this.collection.where("orgId", "==", orgId);

    if (params.projectId) {
      query = query.where("projectId", "==", params.projectId);
    }
    if (params.taskId) {
      query = query.where("taskId", "==", params.taskId);
    }
    if (params.userId) {
      query = query.where("userId", "==", params.userId);
    }
    if (params.startDate) {
      query = query.where("date", ">=", new Date(params.startDate).toISOString());
    }
    if (params.endDate) {
      query = query.where("date", "<=", new Date(params.endDate).toISOString());
    }

    const snapshot = await query
      .orderBy("date", "desc")
      .orderBy("createdAt", "desc")
      .limit(params.limit ?? 20)
      .get();
    return snapshot.docs.map((doc) => this.docToEntity(doc));
  }

  async findById(orgId: string, id: string): Promise<TimeEntryEntity | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const entry = this.docToEntity(doc);
    if (entry.orgId !== orgId) {
      return null;
    }
    return entry;
  }

  async create(orgId: string, data: TimeEntryCreateInput, actorId: string): Promise<TimeEntryEntity> {
    const normalized = normalizeInput(data, actorId);
    const now = getISODate();
    const docRef = this.collection.doc();

    const record: TimeEntryEntity = {
      id: docRef.id,
      orgId,
      projectId: normalized.projectId,
      taskId: normalized.taskId,
      userId: normalized.userId,
      recordedBy: actorId,
      date: normalized.date,
      reportedMinutes: normalized.reportedMinutes,
      notes: normalized.notes,
      createdAt: now,
      updatedAt: now
    };

    await docRef.set(record);
    return record;
  }

  async update(orgId: string, id: string, data: TimeEntryUpdateInput, actorId: string): Promise<TimeEntryEntity> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Time entry not found");
    }

    const next: TimeEntryEntity = {
      ...current,
      projectId: data.projectId ?? current.projectId,
      taskId: data.taskId ?? current.taskId,
      userId: data.userId?.trim() || current.userId,
      date: data.date ? new Date(data.date).toISOString() : current.date,
      recordedBy: actorId,
      reportedMinutes: data.reportedMinutes !== undefined ? Number(data.reportedMinutes) : current.reportedMinutes,
      notes: data.notes !== undefined ? data.notes ?? null : current.notes,
      updatedAt: getISODate()
    };

    await this.collection.doc(id).set(next);
    return next;
  }

  async delete(orgId: string, id: string): Promise<void> {
    const current = await this.findById(orgId, id);
    if (!current) {
      throw new Error("Time entry not found");
    }
    await this.collection.doc(id).delete();
  }

  async summarizeByProject(orgId: string, projectId: string): Promise<Record<string, number>> {
    const snapshot = await this.collection
      .where("orgId", "==", orgId)
      .where("projectId", "==", projectId)
      .get();
    const totals: Record<string, number> = {};
    snapshot.docs.forEach((doc) => {
      const entry = this.docToEntity(doc);
      totals[entry.taskId] = (totals[entry.taskId] ?? 0) + entry.reportedMinutes;
    });
    return totals;
  }

  async reassignProject(orgId: string, taskId: string, projectId: string): Promise<void> {
    const snapshot = await this.collection
      .where("orgId", "==", orgId)
      .where("taskId", "==", taskId)
      .get();

    if (snapshot.empty) {
      return;
    }

    const firestore = this.collection.firestore;
    const batch = firestore.batch();
    const updatedAt = getISODate();
    snapshot.docs.forEach((doc) => {
      batch.update(doc.ref, { projectId, updatedAt });
    });
    await batch.commit();
  }
}

let repository: TimeEntriesRepository | null = null;

export function getTimeEntriesRepository(): TimeEntriesRepository {
  if (!repository) {
    if (firestoreConfigured && getFirestoreDb()) {
      repository = new FirestoreTimeEntriesRepository();
    } else {
      repository = new InMemoryTimeEntriesRepository();
    }
  }
  return repository;
}
