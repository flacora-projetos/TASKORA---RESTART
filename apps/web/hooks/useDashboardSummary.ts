import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "../lib/api";
import type { IntegrationStatusResponse } from "../types/client-metrics";
import type { DashboardAlert, DashboardJob, JobsStatusResponse } from "../types/dashboard";
import type { MetricsSummary } from "../types/metrics";
import type { HoursReport } from "../types/reports";

type SummaryStatus = "idle" | "loading" | "loaded" | "error";

type DashboardSummaryState = {
  metrics: MetricsSummary | null;
  metricsStatus: SummaryStatus;
  metricsMessage: string | null;
  hours: HoursReport | null;
  hoursStatus: SummaryStatus;
  hoursMessage: string | null;
  alerts: DashboardAlert[];
  jobs: DashboardJob[];
  jobsStatus: SummaryStatus;
  jobsMessage: string | null;
};

const INITIAL_STATE: DashboardSummaryState = {
  metrics: null,
  metricsStatus: "idle",
  metricsMessage: null,
  hours: null,
  hoursStatus: "idle",
  hoursMessage: null,
  alerts: [],
  jobs: [],
  jobsStatus: "idle",
  jobsMessage: null
};

const PLATFORM_LABELS: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  ga4: "GA4"
};

const STATUS_COPY: Record<string, string> = {
  connected: "Dados atualizados",
  pending: "Aguardando dados",
  error: "Falha ao sincronizar",
  missing: "Integração ausente"
};

export function useDashboardSummary(token?: string | null): DashboardSummaryState {
  const [state, setState] = useState<DashboardSummaryState>(INITIAL_STATE);

  useEffect(() => {
    if (!token) {
      setState(INITIAL_STATE);
      return;
    }

    let isActive = true;
    setState({
      metrics: null,
      metricsStatus: "loading",
      metricsMessage: null,
      hours: null,
      hoursStatus: "loading",
      hoursMessage: null,
      alerts: [],
      jobs: [],
      jobsStatus: "loading",
      jobsMessage: null
    });

    const today = new Date().toISOString().slice(0, 10);

    const metricsPromise = apiFetch<MetricsSummary>("/metrics/summary", { token });
    const hoursPromise = apiFetch<HoursReport>("/reports/hours", {
      token,
      query: { startDate: today, endDate: today }
    });
    const integrationsPromise = apiFetch<IntegrationStatusResponse>("/metrics/integrations/status", {
      token
    });
    const jobsPromise = apiFetch<JobsStatusResponse>("/maintenance/jobs/status", {
      token
    });

    Promise.allSettled([metricsPromise, hoursPromise, integrationsPromise, jobsPromise]).then((results) => {
      if (!isActive) {
        return;
      }

      const [metricsResult, hoursResult, integrationsResult, jobsResult] = results;

      let metrics: MetricsSummary | null = null;
      let metricsStatus: SummaryStatus = "idle";
      let metricsMessage: string | null = null;

      if (metricsResult.status === "fulfilled") {
        metrics = metricsResult.value;
        metricsStatus = "loaded";
      } else {
        metricsStatus = "error";
        metricsMessage =
          metricsResult.reason instanceof ApiError
            ? metricsResult.reason.message
            : "Não foi possível carregar os indicadores.";
      }

      let hours: HoursReport | null = null;
      let hoursStatus: SummaryStatus = "idle";
      let hoursMessage: string | null = null;

      if (hoursResult.status === "fulfilled") {
        hours = hoursResult.value;
        hoursStatus = "loaded";
      } else {
        hoursStatus = "error";
        hoursMessage =
          hoursResult.reason instanceof ApiError
            ? hoursResult.reason.message
            : "Não foi possível carregar as horas.";
      }

      let alerts: DashboardAlert[] = [];
      if (integrationsResult.status === "fulfilled") {
        const integrationData = integrationsResult.value;
        alerts = (integrationData.alerts ?? []).slice(0, 3).map((alert) => ({
          id: `${alert.clientId}-${alert.platform}`,
          title: alert.clientName,
          description: `${PLATFORM_LABELS[alert.platform] ?? alert.platform}: ${
            STATUS_COPY[alert.status] ?? alert.status
          }`,
          href: `/clients/${alert.clientId}`,
          actionLabel: "Abrir ficha",
          tone: alert.status === "error" ? "warning" : "info",
          timestamp: alert.updatedAt
        }));
      }

      let jobs: DashboardJob[] = [];
      let jobsStatus: SummaryStatus = "idle";
      let jobsMessage: string | null = null;

      if (jobsResult.status === "fulfilled") {
        jobs = jobsResult.value.jobs ?? [];
        jobsStatus = "loaded";
      } else {
        jobsStatus = "error";
        jobsMessage =
          "Não foi possível consultar os jobs agora. Confirme se a API /maintenance/jobs/status está publicada.";
      }

      setState({
        metrics,
        metricsStatus,
        metricsMessage,
        hours,
        hoursStatus,
        hoursMessage,
        alerts,
        jobs,
        jobsStatus,
        jobsMessage
      });
    });

    return () => {
      isActive = false;
    };
  }, [token]);

  return state;
}
