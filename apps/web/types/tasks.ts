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

export type TaskIntegrationInfo = {
  provider: "google" | "meta" | "other";
  externalId: string | null;
  syncStatus: "disconnected" | "pending" | "synced" | "error";
  lastSyncAt: string | null;
  notes: string | null;
};

export type TaskChecklistItem = {
  id: string;
  label: string;
  done: boolean;
};

export type TaskLogEntry = {
  id: string;
  type: "created" | "status_change" | "assignees_change" | "integration" | "note";
  message: string;
  actorId: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
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

export type TaskPriorityTag = "overdue" | "due_today" | "upcoming" | "no_due_date" | "completed";

export type TaskOverviewAssignee = {
  id: string;
  name: string;
  color: string | null;
  role: string | null;
};

export type TaskOverviewClient = {
  id: string;
  name: string;
  segment: string | null;
  responsibleId: string | null;
};

export type TaskOverviewProject = {
  id: string;
  name: string;
  clientId: string;
};

export type TaskOverviewChecklist = {
  total: number;
  done: number;
};

export type TaskOverviewCard = {
  total: number;
  range: {
    start: string | null;
    end: string | null;
  };
  highlight: {
    id: string;
    title: string;
    dueDate: string | null;
    clientName: string | null;
    assignees: Array<{ id: string; name: string }>;
  } | null;
};

export type TaskOverviewFiltersPayload = {
  assignees: TaskOverviewAssignee[];
  clients: TaskOverviewClient[];
  projects: TaskOverviewProject[];
  platforms: Array<{ value: string; label: string }>;
};

export type TaskOverviewItem = {
  id: string;
  title: string;
  status: TaskStatus;
  type: TaskType;
  dueDate: string | null;
  priority: TaskPriorityTag;
  project: TaskOverviewProject | null;
  client: TaskOverviewClient | null;
  assignees: TaskOverviewAssignee[];
  platforms: string[];
  checklist: TaskOverviewChecklist;
  createdById?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TaskOverviewResponse = {
  metadata: {
    generatedAt: string;
    total: number;
    appliedFilters: {
      status?: TaskStatus;
      type?: TaskType;
      assigneeId?: string;
      clientId?: string;
      projectId?: string;
      platform?: string;
      period?: "today" | "week" | "month" | "last7" | "last30" | "custom";
      from?: string;
      to?: string;
      search: string | null;
      range: { start: string; end: string } | null;
    };
  };
  cards: {
    today: TaskOverviewCard;
    week: TaskOverviewCard;
    overdue: TaskOverviewCard;
  };
  totals: {
    byStatus: Record<TaskStatus, number>;
    byType: Record<TaskType, number>;
  };
  filters: TaskOverviewFiltersPayload;
  items: TaskOverviewItem[];
};
