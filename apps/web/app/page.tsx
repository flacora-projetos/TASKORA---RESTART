export const dynamic = "force-dynamic";

import { DashboardShell } from "../components/dashboard/DashboardShell";
import { fetchHealth } from "../lib/health";

async function loadHealthStatus() {
  const health = await fetchHealth();
  if (!health) {
    return {
      status: "error" as const,
      payload: null
    };
  }

  return {
    status: health.status === "ok" ? ("ok" as const) : ("warning" as const),
    payload: health
  };
}

export default async function HomePage() {
  const health = await loadHealthStatus();

  return <DashboardShell health={health} />;
}
