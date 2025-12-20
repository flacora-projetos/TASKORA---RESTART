export type TimeEntry = {
  id: string;
  projectId: string;
  taskId: string;
  userId: string;
  recordedBy: string;
  date: string;
  reportedMinutes: number;
  notes: string | null;
  createdAt: string;
};

export type TimeEntryPayload = {
  projectId: string;
  taskId: string;
  userId?: string;
  date: string;
  reportedMinutes: number;
  notes?: string | null;
};

export type TimeEntrySummary = {
  totals: Record<string, number>;
};
