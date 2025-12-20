export type TimeEntryCreateInput = {
  projectId: string;
  taskId: string;
  userId?: string | null;
  date: string;
  reportedMinutes: number;
  notes?: string | null;
};

export type TimeEntryUpdateInput = Partial<TimeEntryCreateInput>;

export type TimeEntryEntity = {
  id: string;
  orgId: string;
  projectId: string;
  taskId: string;
  userId: string;
  recordedBy: string;
  date: string;
  reportedMinutes: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
