export type AdSpendItem = {
  clientId: string | null;
  clientName: string;
  platform: "google" | "meta";
  accountId: string;
  accountName: string | null;
  isPrepaid: boolean | null;
  balanceAvailable: number | null;
  averageDailySpend: number | null;
  monthToDateSpend: number | null;
  creditLimit: number | null;
  currency: string | null;
};

export type AdSpendResponse = {
  items: AdSpendItem[];
  cachedAt?: string;
};

export type DashboardAlert = {
  id: string;
  title: string;
  description: string;
  href: string;
  actionLabel?: string;
  tone: "info" | "warning";
  timestamp?: string | null;
};

export type DashboardJob = {
  id: string;
  label: string;
  description: string;
  status: "success" | "warning" | "error" | "pending";
  lastRunAt: string | null;
  message?: string | null;
};

export type JobsStatusResponse = {
  jobs: DashboardJob[];
};
