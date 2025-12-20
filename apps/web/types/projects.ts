export type ProjectStatus = "draft" | "active" | "paused" | "completed";

export type ProjectSummary = {
  id: string;
  name: string;
  clientId: string;
  status: ProjectStatus;
  ownerId?: string | null;
  updatedAt: string;
};

export type Project = {
  id: string;
  orgId: string;
  clientId: string;
  name: string;
  ownerId: string | null;
  budget: number | null;
  startDate: string | null;
  endDate: string | null;
  status: ProjectStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};
