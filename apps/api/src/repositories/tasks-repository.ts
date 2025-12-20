import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type {
  TaskChecklistItem,
  TaskChecklistItemInput,
  TaskCreateInput,
  TaskEntity,
  TaskIntegrationInfo,
  TaskLogEntry,
  TaskStatus,
  TaskUpdateInput
} from "../types/tasks.js";

type ListParams = {
  status?: TaskStatus;
  assignee?: string;
  search?: string;
};

export interface TasksRepository {
  list(orgId: string, projectId: string, params?: ListParams): Promise<TaskEntity[]>;
  findById(orgId: string, projectId: string, id: string): Promise<TaskEntity | null>;
  create(orgId: string, projectId: string, data: TaskCreateInput, actorId: string): Promise<TaskEntity>;
  update(
    orgId: string,
    projectId: string,
    id: string,
    data: TaskUpdateInput,
    actorId: string
  ): Promise<TaskEntity>;
  archive(orgId: string, projectId: string, id: string, actorId: string): Promise<TaskEntity>;
  listAll(orgId: string): Promise<TaskEntity[]>;
}

function getISODate(): string {
  return new Date().toISOString();
}

function dedupeAssignees(assignees?: string[]): string[] {
  if (!assignees || assignees.length === 0) {
    return [];
  }

  const trimmed = assignees
    .map((item) => item.trim())
    .filter((value) => Boolean(value));

  return Array.from(new Set(trimmed));
}

function normalizeChecklist(items?: TaskChecklistItemInput[]): TaskChecklistItem[] {
  if (!items) {
    return [];
  }

  return items
    .filter((item) => Boolean(item.label))
    .map((item) => ({
      id: item.id && item.id.trim().length > 0 ? item.id : crypto.randomUUID(),
      label: item.label,
      done: Boolean(item.done)
    }));
}

function normalizeIntegration(input?: Partial<TaskIntegrationInfo> | null): TaskIntegrationInfo | null {
  if (!input) {
    return null;
  }

  return {
    provider: input.provider ?? "other",
    externalId: input.externalId ?? null,
    syncStatus: input.syncStatus ?? "pending",
    lastSyncAt: input.lastSyncAt ?? null,
    notes: input.notes ?? null
  };
}

function createLogEntry(
  type: TaskLogEntry["type"],
  message: string,
  actorId: string,
  metadata?: Record<string, unknown> | null
): TaskLogEntry {
  return {
    id: crypto.randomUUID(),
    type,
    message,
    actorId,
    createdAt: getISODate(),
    metadata: metadata ?? null
  };
}

function appendLog(logs: TaskLogEntry[], entry: TaskLogEntry): TaskLogEntry[] {
  const combined = [...logs, entry];
  const overflow = 50;
  if (combined.length > overflow) {
    return combined.slice(combined.length - overflow);
  }
  return combined;
}

function areAssigneesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function isSameIntegration(a: TaskIntegrationInfo | null, b: TaskIntegrationInfo | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function applyTaskUpdates(
  current: TaskEntity,
  data: TaskUpdateInput,
  actorId: string
): TaskEntity {
  let logs = current.activityLog;
  const next: TaskEntity = {
    ...current,
    title: data.title ?? current.title,
    description: data.description !== undefined ? data.description ?? null : current.description,
    type: data.type ?? current.type,
    dueDate: data.dueDate !== undefined ? data.dueDate ?? null : current.dueDate,
    checklist: current.checklist
  };

  if (data.projectId && data.projectId !== current.projectId) {
    logs = appendLog(
      logs,
      createLogEntry("note", "Projeto atualizado para a tarefa", actorId, {
        from: current.projectId,
        to: data.projectId
      })
    );
    next.projectId = data.projectId;
  }

  if (data.checklist !== undefined) {
    next.checklist = normalizeChecklist(data.checklist);
  }

  if (data.assignees) {
    const normalized = dedupeAssignees(data.assignees);
    if (!areAssigneesEqual(normalized, current.assignees)) {
      logs = appendLog(
        logs,
        createLogEntry("assignees_change", "Responsaveis atualizados", actorId, {
          from: current.assignees,
          to: normalized
        })
      );
    }
    next.assignees = normalized;
  }

  if (data.status && data.status !== current.status) {
    logs = appendLog(
      logs,
      createLogEntry("status_change", `Status alterado de ${current.status} para ${data.status}`, actorId, {
        from: current.status,
        to: data.status
      })
    );
    next.status = data.status;
  } else if (data.status) {
    next.status = data.status;
  }

  if (data.integration !== undefined) {
    const normalized = normalizeIntegration(data.integration);
    if (!isSameIntegration(current.integration, normalized)) {
      logs = appendLog(
        logs,
        createLogEntry("integration", "Informacoes de integracao atualizadas", actorId, {
          from: current.integration,
          to: normalized
        })
      );
    }
    next.integration = normalized;
  }

  next.activityLog = logs;
  next.updatedAt = getISODate();
  return next;
}

function filterTasks(tasks: TaskEntity[], params: ListParams = {}): TaskEntity[] {
  let filtered = tasks;

  if (params.status) {
    filtered = filtered.filter((task) => task.status === params.status);
  }

  if (params.assignee) {
    filtered = filtered.filter((task) => task.assignees.includes(params.assignee!));
  }

  if (params.search) {
    const query = params.search.toLowerCase();
    filtered = filtered.filter((task) =>
      task.title.toLowerCase().includes(query) ||
      (task.description ?? "").toLowerCase().includes(query)
    );
  }

  return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

class InMemoryTasksRepository implements TasksRepository {
  private store = new Map<string, TaskEntity>();

  async list(orgId: string, projectId: string, params: ListParams = {}): Promise<TaskEntity[]> {
    const tasks = Array.from(this.store.values()).filter(
      (item) => item.orgId === orgId && item.projectId === projectId && !item.archivedAt
    );
    return filterTasks(tasks, params);
  }

  async listAll(orgId: string): Promise<TaskEntity[]> {
    return Array.from(this.store.values())
      .filter((item) => item.orgId === orgId && !item.archivedAt)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(orgId: string, projectId: string, id: string): Promise<TaskEntity | null> {
    const item = this.store.get(id);
    if (!item || item.orgId !== orgId || item.projectId !== projectId) {
      return null;
    }
    return item;
  }

  async create(
    orgId: string,
    projectId: string,
    data: TaskCreateInput,
    actorId: string
  ): Promise<TaskEntity> {
    const now = getISODate();
    const id = crypto.randomUUID();

    const record: TaskEntity = {
      id,
      orgId,
      projectId,
      title: data.title,
      description: data.description ?? null,
      type: data.type ?? "other",
      status: data.status ?? "backlog",
      assignees: dedupeAssignees(data.assignees),
      dueDate: data.dueDate ?? null,
      checklist: normalizeChecklist(data.checklist),
      integration: normalizeIntegration(data.integration),
      activityLog: [createLogEntry("created", "Tarefa criada", actorId)],
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };

    this.store.set(id, record);
    return record;
  }

  async update(
    orgId: string,
    projectId: string,
    id: string,
    data: TaskUpdateInput,
    actorId: string
  ): Promise<TaskEntity> {
    const current = await this.findById(orgId, projectId, id);
    if (!current) {
      throw new Error("Task not found");
    }

    const next = applyTaskUpdates(current, data, actorId);
    this.store.set(id, next);
    return next;
  }

  async archive(orgId: string, projectId: string, id: string, actorId: string): Promise<TaskEntity> {
    const current = await this.findById(orgId, projectId, id);
    if (!current) {
      throw new Error("Task not found");
    }

    const now = getISODate();
    const archived: TaskEntity = {
      ...current,
      status: current.status === "done" ? current.status : "done",
      archivedAt: now,
      updatedAt: now,
      activityLog: appendLog(
        current.activityLog,
        createLogEntry("note", "Tarefa arquivada", actorId)
      )
    };

    this.store.set(id, archived);
    return archived;
  }
}

class FirestoreTasksRepository implements TasksRepository {
  private collection: FirebaseFirestore.CollectionReference;

  constructor() {
    const firestore = getFirestoreDb();
    if (!firestore) {
      throw new Error("Firestore not configured");
    }
    this.collection = firestore.collection("tasks");
  }

  private docToEntity(doc: FirebaseFirestore.DocumentSnapshot): TaskEntity {
    const data = doc.data() as Omit<TaskEntity, "id"> | undefined;
    if (!data) {
      throw new Error("Invalid Firestore document");
    }

    return {
      id: doc.id,
      ...data
    };
  }

  async list(orgId: string, projectId: string, params: ListParams = {}): Promise<TaskEntity[]> {
    const snapshot = await this.collection
      .where("orgId", "==", orgId)
      .where("projectId", "==", projectId)
      .get();

    const tasks = snapshot.docs.map((doc) => this.docToEntity(doc)).filter((task) => !task.archivedAt);
    return filterTasks(tasks, params);
  }

  async listAll(orgId: string): Promise<TaskEntity[]> {
    const snapshot = await this.collection.where("orgId", "==", orgId).get();
    return snapshot.docs
      .map((doc) => this.docToEntity(doc))
      .filter((task) => !task.archivedAt);
  }

  async findById(orgId: string, projectId: string, id: string): Promise<TaskEntity | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const entity = this.docToEntity(doc);
    if (entity.orgId !== orgId || entity.projectId !== projectId) {
      return null;
    }
    return entity;
  }

  async create(
    orgId: string,
    projectId: string,
    data: TaskCreateInput,
    actorId: string
  ): Promise<TaskEntity> {
    const now = getISODate();
    const docRef = this.collection.doc();

    const record: TaskEntity = {
      id: docRef.id,
      orgId,
      projectId,
      title: data.title,
      description: data.description ?? null,
      type: data.type ?? "other",
      status: data.status ?? "backlog",
      assignees: dedupeAssignees(data.assignees),
      dueDate: data.dueDate ?? null,
      checklist: normalizeChecklist(data.checklist),
      integration: normalizeIntegration(data.integration),
      activityLog: [createLogEntry("created", "Tarefa criada", actorId)],
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };

    await docRef.set(record);
    return record;
  }

  async update(
    orgId: string,
    projectId: string,
    id: string,
    data: TaskUpdateInput,
    actorId: string
  ): Promise<TaskEntity> {
    const current = await this.findById(orgId, projectId, id);
    if (!current) {
      throw new Error("Task not found");
    }

    const next = applyTaskUpdates(current, data, actorId);
    await this.collection.doc(id).set(next);
    return next;
  }

  async archive(orgId: string, projectId: string, id: string, actorId: string): Promise<TaskEntity> {
    const current = await this.findById(orgId, projectId, id);
    if (!current) {
      throw new Error("Task not found");
    }

    const now = getISODate();
    const archived: TaskEntity = {
      ...current,
      status: current.status === "done" ? current.status : "done",
      archivedAt: now,
      updatedAt: now,
      activityLog: appendLog(
        current.activityLog,
        createLogEntry("note", "Tarefa arquivada", actorId)
      )
    };

    await this.collection.doc(id).set(archived);
    return archived;
  }
}

let repository: TasksRepository | null = null;

export function getTasksRepository(): TasksRepository {
  if (!repository) {
    if (firestoreConfigured && getFirestoreDb()) {
      repository = new FirestoreTasksRepository();
    } else {
      repository = new InMemoryTasksRepository();
    }
  }

  return repository;
}
