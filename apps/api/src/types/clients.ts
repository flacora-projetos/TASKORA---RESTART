export type ClientStatus = "active" | "archived";

export type ClientPlatform = "google" | "meta" | "pinterest" | "tiktok" | "other";

export type ClientCreateInput = {
  name: string;
  segment?: string | null;
  monthlyBudget?: number | null;
  platforms?: ClientPlatform[];
  driveLink?: string | null;
  whatsappGroup?: string | null;
  status?: ClientStatus;
  googleCustomerIds?: string[] | null;
  metaAccountIds?: string[] | null;
  ga4PropertyIds?: string[] | null;
  pinterestAccountIds?: string[] | null;
  responsibleId?: string | null;
};

export type ClientUpdateInput = Partial<ClientCreateInput>;

export type ClientIntegrationInfo = {
  directoryId?: string;
  directorySnapshot?: Record<string, unknown>;
  googleCustomerIds?: string[];
  metaAccountIds?: string[];
  ga4PropertyIds?: string[];
  pinterest?: {
    accessToken: string;
    refreshToken: string | null;
    tokenType: string | null;
    scope: string | null;
    expiresAt: string | null;
    refreshTokenExpiresAt: string | null;
    linkedAt: string;
  };
  syncedAt: string;
};

export type ClientEntity = {
  id: string;
  orgId: string;
  name: string;
  segment: string | null;
  monthlyBudget: number | null;
  platforms: ClientPlatform[];
  driveLink: string | null;
  whatsappGroup: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  googleCustomerIds: string[];
  metaAccountIds: string[];
  ga4PropertyIds: string[];
  pinterestAccountIds: string[];
  responsibleId: string | null;
  integrations: ClientIntegrationInfo | null;
};
