export type TaskStatus = "backlog" | "todo" | "in_progress" | "blocked" | "review" | "done";

export type TaskType =
  | "optimization"
  | "report"
  | "creative"
  | "meeting"
  | "feedback"
  | "campaign"
  | "billing"
  | "note"
  | "other";

export type TaskChecklistItemInput = {
  id?: string;
  label: string;
  done?: boolean;
};

export type TaskChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type TaskIntegrationInfo = {
  provider: "google" | "meta" | "other";
  externalId: string | null;
  syncStatus: "disconnected" | "pending" | "synced" | "error";
  lastSyncAt: string | null;
  notes: string | null;
};

export type TaskLogEntry = {
  id: string;
  type: "created" | "status_change" | "assignees_change" | "integration" | "note";
  message: string;
  actorId: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
};

export type TaskCreateInput = {
  title: string;
  description?: string | null;
  type?: TaskType;
  status?: TaskStatus;
  assignees?: string[];
  dueDate?: string | null;
  checklist?: TaskChecklistItemInput[];
  integration?: Partial<TaskIntegrationInfo> | null;
};

export type TaskUpdateInput = Partial<TaskCreateInput> & {
  projectId?: string;
};

export type TaskEntity = {
  id: string;
  orgId: string;
  projectId: string;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  assignees: string[];
  dueDate: string | null;
  checklist: TaskChecklistItem[];
  integration: TaskIntegrationInfo | null;
  activityLog: TaskLogEntry[];
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
