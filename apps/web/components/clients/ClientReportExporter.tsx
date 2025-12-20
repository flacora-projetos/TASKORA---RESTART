'use client';

import { useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import {
  CLIENT_METRICS_RANGE_OPTIONS,
  buildClientReportCsv,
  getRangeLabel,
  resolveMetricsRangeDates,
  summarizeHoursReports
} from "../../lib/client-report";
import type { ClientMetricsRange, ClientMetricsSummary } from "../../types/client-metrics";
import type { Client } from "../../types/clients";
import type { ProjectSummary } from "../../types/projects";
import type { HoursReport } from "../../types/reports";

type Props = {
  client: Client;
  token: string;
};

type ExportState =
  | { status: "idle"; message: string | null }
  | { status: "loading"; message: string | null }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function ClientReportExporter({ client, token }: Props): JSX.Element {
  const [range, setRange] = useState<ClientMetricsRange>("LAST_7_DAYS");
  const [state, setState] = useState<ExportState>({ status: "idle", message: null });

  async function fetchHours(
    projects: ProjectSummary[],
    startDate: string,
    endDate: string
  ): Promise<Array<{ project: ProjectSummary; report: HoursReport }>> {
    if (projects.length === 0) {
      return [];
    }
    return Promise.all(
      projects.map(async (project) => {
        const report = await apiFetch<HoursReport>("/reports/hours", {
          token,
          query: {
            projectId: project.id,
            startDate,
            endDate
          }
        });
        return { project, report };
      })
    );
  }

  const triggerDownload = (csv: string) => {
    const filename = `relatorio_cliente_${client.id}_${range.toLowerCase()}_${new Date()
      .toISOString()
      .replace(/[:.]/g, "-")}.csv`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExport = async () => {
    if (!token) {
      return;
    }
    setState({ status: "loading", message: "Gerando relatório..." });

    try {
      const [metrics, projects] = await Promise.all([
        apiFetch<ClientMetricsSummary>(`/clients/${client.id}/metrics/summary`, {
          token,
          query: { range }
        }),
        apiFetch<{ items: ProjectSummary[] }>("/projects", {
          token,
          query: { clientId: client.id }
        })
      ]);

      const period = resolveMetricsRangeDates(range);
      const hoursEntries = await fetchHours(projects.items, period.startDate, period.endDate);
      const hoursTotals = summarizeHoursReports(hoursEntries);
      const csv = buildClientReportCsv({
        client,
        rangeLabel: getRangeLabel(range),
        period,
        metrics,
        hours: hoursTotals
      });

      triggerDownload(csv);
      setState({ status: "success", message: "Relatório exportado com sucesso." });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Não foi possível gerar o relatório.";
      setState({ status: "error", message });
    }
  };

  const isLoading = state.status === "loading";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">Relatórios exportáveis</p>
          <h2 className="text-lg font-semibold text-gray-900">Resumo semanal/mensal</h2>
          <p className="text-sm text-gray-600">
            Gera um CSV consolidando métricas (Google/Meta/GA4) e horas lançadas por projeto/colaborador para o período
            selecionado.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as ClientMetricsRange)}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40 disabled:opacity-50"
          >
            {CLIENT_METRICS_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleExport}
            disabled={isLoading}
            className="inline-flex items-center rounded-full bg-terracota px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-terracota/90 disabled:opacity-60"
          >
            {isLoading ? "Gerando..." : "Exportar CSV"}
          </button>
        </div>
      </header>

      {state.status === "success" ? (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.message}</p>
      ) : null}
      {state.status === "error" ? (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message}</p>
      ) : null}
      {state.status === "loading" ? (
        <p className="mt-4 text-sm text-gray-500">Consultando m?tricas e horas para montar o arquivo...</p>
      ) : null}
    </section>
  );
}