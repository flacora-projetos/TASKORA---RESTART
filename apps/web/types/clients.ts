import type { ClientPlatformKey, ClientPlatformStatus } from "./client-metrics";

export type ClientStatus = "active" | "archived";

export type ClientPlatform = "google" | "meta" | "pinterest" | "tiktok" | "other";

export type ClientSummary = {
  id: string;
  name: string;
  segment: string | null;
  status: ClientStatus;
  monthlyBudget: number | null;
  updatedAt: string;
};

export type ClientIntegrationInfo = {
  directoryId?: string;
  directorySnapshot?: Record<string, unknown> | null;
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
  } | null;
  syncedAt?: string;
};

export type Client = {
  id: string;
  name: string;
  segment: string | null;
  monthlyBudget: number | null;
  platforms: ClientPlatform[];
  driveLink: string | null;
  whatsappGroup: string | null;
  status: ClientStatus;
  createdAt: string;
  updatedAt: string;
  googleCustomerIds: string[];
  metaAccountIds: string[];
  ga4PropertyIds: string[];
  pinterestAccountIds: string[];
  responsibleId: string | null;
  integrations: ClientIntegrationInfo | null;
};

export type ClientPayload = {
  name: string;
  segment?: string | null;
  monthlyBudget?: number | null;
  platforms?: ClientPlatform[];
  driveLink?: string | null;
  whatsappGroup?: string | null;
  status?: ClientStatus;
  googleCustomerIds?: string[];
  metaAccountIds?: string[];
  ga4PropertyIds?: string[];
  pinterestAccountIds?: string[];
  responsibleId?: string | null;
};

export type DirectoryClientSummary = {
  id: string;
  name: string;
  platform: string;
  accountId?: string | null;
  metadata?: {
    aliases?: string[];
    platforms?: string[];
    googleCustomerIds?: string[];
    metaAccountIds?: string[];
    ga4PropertyIds?: string[];
  } | null;
};

export type DirectorySearchResponse = {
  items: DirectoryClientSummary[];
  cache?: {
    total: number;
    lastSyncedAt: string | null;
    stale: boolean;
  };
};

export type ClientPipelineStage = {
  id: "contact" | "cadastro" | "ids" | "metrics";
  label: string;
  count: number;
  helper: string;
};

export type ClientSummaryHighlights = {
  missingIds: Array<{
    id: string;
    name: string;
    missing: Array<"google" | "meta" | "ga4" | "pinterest">;
  }>;
  missingMetrics: Array<{
    id: string;
    name: string;
    statuses: Array<{
      platform: ClientPlatformKey;
      status: ClientPlatformStatus;
      updatedAt: string;
    }>;
  }>;
};

export type ClientsDashboardSummary = {
  totals: {
    contacts: number;
    leadsPending: number;
    active: number;
    archived: number;
    withIds: number;
    withoutIds: number;
    withMetrics: number;
    withoutMetrics: number;
  };
  pipeline: ClientPipelineStage[];
  highlights: ClientSummaryHighlights;
  metadata: {
    directoryLastSync: string | null;
  };
};
