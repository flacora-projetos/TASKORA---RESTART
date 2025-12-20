export type ClientMetricsRange = "LAST_7_DAYS" | "LAST_30_DAYS" | "THIS_MONTH" | "LAST_MONTH";

export type ClientPlatformKey = "google" | "meta" | "ga4";

export type ClientPlatformTotals = {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  cpc: number | null;
  ctr: number | null;
  revenue: number | null;
};

export type ClientPlatformKpiFormat = "currency" | "number" | "percent";

export type ClientPlatformKpi = {
  key: string;
  label: string;
  value: number | null;
  format?: ClientPlatformKpiFormat;
  precision?: number;
};

export type ClientPlatformSummary = {
  platform: ClientPlatformKey;
  status: ClientPlatformStatus;
  message?: string;
  totals: ClientPlatformTotals;
  lastSynced: string | null;
  raw?: unknown;
  kpis?: ClientPlatformKpi[];
};

export type ClientMetricsSummary = {
  range: ClientMetricsRange;
  generatedAt: string;
  platforms: ClientPlatformSummary[];
};

export type IntegrationStatusResponse = {
  platforms: Array<{
    platform: ClientPlatformKey;
    statusCounts: Record<ClientPlatformStatus, number>;
  }>;
  alerts: Array<{
    clientId: string;
    clientName: string;
    platform: ClientPlatformKey;
    status: ClientPlatformStatus;
    updatedAt: string;
  }>;
};

export type ClientPlatformStatus = "connected" | "missing" | "pending" | "error";
