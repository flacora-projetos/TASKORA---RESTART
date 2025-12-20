export type ClientTimelineEventType =
  | "note"
  | "meeting"
  | "integration"
  | "task"
  | "hour"
  | "report"
  | "alert";

export type ClientTimelineEvent = {
  id: string;
  orgId: string;
  clientId: string;
  eventType: ClientTimelineEventType;
  title: string;
  description: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
  actorId: string | null;
  actorLabel: string | null;
  source: string | null;
  projectId?: string | null;
  taskId?: string | null;
};

export type ClientTimelineCreateInput = {
  eventType: ClientTimelineEventType;
  title: string;
  description?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown> | null;
  occurredAt?: string;
  source?: string | null;
};

export type ClientTimelineListParams = {
  limit?: number;
  eventType?: ClientTimelineEventType;
  before?: string;
  from?: string;
  to?: string;
};

