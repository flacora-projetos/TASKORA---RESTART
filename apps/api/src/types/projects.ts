export type ProjectStatus = "draft" | "active" | "paused" | "completed";

export type ProjectCreateInput = {
  clientId: string;
  name: string;
  ownerId?: string | null;
  budget?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: ProjectStatus;
  notes?: string | null;
};

export type ProjectUpdateInput = Partial<ProjectCreateInput>;

export type ProjectIntegrationInfo = {
  googleCustomerIds?: string[];
  metaAccountIds?: string[];
  syncedAt?: string;
};

export type ProjectEntity = {
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
  integrations: ProjectIntegrationInfo | null;
};
