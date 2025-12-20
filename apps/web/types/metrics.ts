export type MetricsSummary = {
  clients: {
    total: number;
    active: number;
    archived: number;
  };
  projects: {
    total: number;
    active: number;
    paused: number;
  };
  onboarding?: {
    pendingDirectory: number;
    pendingIds: number;
    ready: number;
  };
};
