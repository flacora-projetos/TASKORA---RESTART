"use client";

import { useMemo } from "react";

import { formatMinutesAsClock } from "../../lib/datetime";
import type { MetricsSummary } from "../../types/metrics";
import type { HoursReport } from "../../types/reports";

type SummaryCardsProps = {
  metrics?: MetricsSummary | null;
  metricsStatus?: "idle" | "loading" | "loaded" | "error";
  metricsMessage?: string | null;
  hoursReport?: HoursReport | null;
  hoursStatus?: "idle" | "loading" | "loaded" | "error";
  hoursMessage?: string | null;
};

export type SummaryCardData = {
  label: string;
  value: string;
  helper: string;
};

export function buildSummaryCardData({
  metrics,
  metricsStatus = "idle",
  hoursReport,
  hoursStatus = "idle",
  hoursMessage = null
}: {
  metrics?: MetricsSummary | null;
  metricsStatus?: "idle" | "loading" | "loaded" | "error";
  hoursReport?: HoursReport | null;
  hoursStatus?: "idle" | "loading" | "loaded" | "error";
  hoursMessage?: string | null;
}): SummaryCardData[] {
  const loadingMetrics = metricsStatus === "loading";

  return [
    {
      label: "Clientes ativos",
      value: metrics?.clients.active?.toLocaleString("pt-BR") ?? (loadingMetrics ? "..." : "--"),
      helper:
        metrics && metrics.clients.archived > 0
          ? `${metrics.clients.archived} arquivado(s)`
          : "Pronto para novos onboardings"
    },
    {
      label: "Projetos em andamento",
      value: metrics?.projects.active?.toLocaleString("pt-BR") ?? (loadingMetrics ? "..." : "--"),
      helper:
        metrics && metrics.projects.paused > 0
          ? `${metrics.projects.paused} pausado(s)`
          : "Todos acompanhando o plano"
    },
    {
      label: "Horas registradas (hoje)",
      value:
        hoursReport?.totals.minutes !== undefined
          ? formatMinutesAsClock(hoursReport.totals.minutes)
          : hoursStatus === "loading"
            ? "..."
            : "--",
      helper:
        hoursStatus === "error"
          ? hoursMessage ?? "Reveja o painel de horas."
          : hoursReport && hoursReport.totals.minutes === 0
            ? "Sem lancamentos hoje"
            : "Somatorio das entries do dia"
    }
  ];
}

export function SummaryCards({
  metrics,
  metricsStatus = "idle",
  metricsMessage = null,
  hoursReport,
  hoursStatus = "idle",
  hoursMessage = null
}: SummaryCardsProps): JSX.Element {
  const cards = useMemo(
    () =>
      buildSummaryCardData({
        metrics,
        metricsStatus,
        hoursReport,
        hoursStatus,
        hoursMessage
      }),
    [metrics, metricsStatus, hoursReport, hoursStatus, hoursMessage]
  );

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-lg shadow-black/10 backdrop-blur"
          >
            <p className="text-xs uppercase tracking-wide text-white/70">{card.label}</p>
            <p className="text-3xl font-semibold">{card.value}</p>
            <p className="text-xs text-white/70">{card.helper}</p>
          </div>
        ))}
      </div>
      {metricsStatus === "error" && metricsMessage ? (
        <p className="text-xs font-semibold text-red-200">{metricsMessage}</p>
      ) : null}
      {metricsStatus === "idle" && !metrics ? (
        <p className="text-xs text-white/80">
          Conecte-se no topo da pagina para liberar os indicadores em tempo real.
        </p>
      ) : null}
    </div>
  );
}
