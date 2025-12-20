export type ClientTimelineEventType = "note" | "meeting" | "integration" | "task" | "hour" | "report" | "alert";

export type ClientTimelineEvent = {
  id: string;
  eventType: ClientTimelineEventType;
  title: string;
  description: string | null;
  tags: string[];
  metadata: Record<string, unknown> | null;
  occurredAt: string;
  createdAt: string;
  actorLabel: string | null;
  actorId?: string | null;
  source: string | null;
};
