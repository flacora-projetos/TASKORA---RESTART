'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import { CLIENT_METRICS_RANGE_OPTIONS } from "../../lib/client-report";
import type {
  ClientMetricsRange,
  ClientMetricsSummary,
  ClientPlatformSummary,
  ClientPlatformKpi
} from "../../types/client-metrics";

const PLATFORM_LABELS: Record<ClientPlatformSummary["platform"], string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  ga4: "Google Analytics 4"
};

const STATUS_STYLES: Record<ClientPlatformSummary["status"], string> = {
  connected: "bg-emerald-50 text-emerald-800 border-emerald-100",
  missing: "bg-slate-100 text-slate-600 border-slate-200",
  pending: "bg-amber-50 text-amber-800 border-amber-100",
  error: "bg-red-50 text-red-800 border-red-100"
};

type MetricsState =
  | { status: "idle"; data: ClientMetricsSummary | null }
  | { status: "loading"; data: ClientMetricsSummary | null }
  | { status: "loaded"; data: ClientMetricsSummary }
  | { status: "error"; data: ClientMetricsSummary | null; message: string };

type Props = {
  clientId: string;
  token: string;
  sectionId?: string;
  setupHref?: string;
};

function formatCurrency(value: number | null, decimals = 0): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatPercent(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(2).replace(".", ",")}%`;
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("pt-BR");
}

function formatKpiValue(value: number | null, format: ClientPlatformKpi["format"], precision?: number): string {
  switch (format) {
    case "currency":
      return formatCurrency(value, precision ?? 0);
    case "percent":
      return formatPercent(value);
    case "number":
    default:
      return formatNumber(value);
  }
}

function buildDefaultKpis(summary: ClientPlatformSummary): ClientPlatformKpi[] {
  return [
    { key: "spend", label: "Investimento", value: summary.totals.spend, format: "currency" },
    { key: "clicks", label: "Cliques", value: summary.totals.clicks, format: "number" },
    { key: "impressions", label: "Impressoes", value: summary.totals.impressions, format: "number" },
    { key: "conversions", label: "Conversoes", value: summary.totals.conversions, format: "number" },
    { key: "cpc", label: "CPC medio", value: summary.totals.cpc, format: "currency", precision: 2 },
    { key: "ctr", label: "CTR", value: summary.totals.ctr, format: "percent" }
  ];
}

export function ClientMetricsCard({ clientId, token, sectionId, setupHref }: Props): JSX.Element {
  const [range, setRange] = useState<ClientMetricsRange>("LAST_7_DAYS");
  const [state, setState] = useState<MetricsState>({ status: "idle", data: null });

  const loadMetrics = useCallback(
    async (currentToken: string, nextRange: ClientMetricsRange) => {
      setState((prev) => ({ ...prev, status: "loading" }));
      const summary = await apiFetch<ClientMetricsSummary>(`/clients/${clientId}/metrics/summary`, {
        token: currentToken,
        query: { range: nextRange }
      });
      setState({ status: "loaded", data: summary });
    },
    [clientId]
  );

  const refreshMetrics = useCallback(
    async (currentToken: string, currentRange: ClientMetricsRange) => {
      setState((prev) => ({ ...prev, status: "loading" }));
      const summary = await apiFetch<ClientMetricsSummary>(`/clients/${clientId}/metrics/refresh`, {
        token: currentToken,
        method: "POST",
        query: { range: currentRange }
      });
      setState({ status: "loaded", data: summary });
    },
    [clientId]
  );

  useEffect(() => {
    if (!token) {
      setState({ status: "idle", data: null });
      return;
    }
    loadMetrics(token, range).catch((error) => {
      const message = error instanceof ApiError ? error.message : "Nao foi possivel carregar as metricas agora.";
      setState({ status: "error", data: null, message });
    });
  }, [clientId, loadMetrics, range, token]);

  const hasData = Boolean(state.data);
  const platforms = useMemo(() => state.data?.platforms ?? [], [state.data]);

  return (
    <section id={sectionId} className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">Visao de desempenho</p>
          <h2 className="text-lg font-semibold text-gray-900">Resultados por plataforma</h2>
          <p className="text-sm text-gray-600">
            Atualizamos estes numeros diariamente. Ajuste o periodo ou sincronize para trazer o snapshot mais recente.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={range}
            onChange={(event) => setRange(event.target.value as ClientMetricsRange)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"
          >
            {CLIENT_METRICS_RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => token && refreshMetrics(token, range)}
            disabled={state.status === "loading"}
            className="inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:border-gray-500 disabled:opacity-50"
          >
            Sincronizar agora
          </button>
        </div>
      </div>

      {state.status === "error" ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message}</p>
      ) : null}

      {state.status === "loading" && !hasData ? (
        <p className="text-sm text-gray-500">Buscando informacoes nas plataformas...</p>
      ) : null}

      {hasData ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {platforms.map((platform) => (
            <PlatformCard key={platform.platform} summary={platform} />
          ))}
        </div>
      ) : null}

      {!hasData && state.status !== "loading" ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-sm text-gray-600">
          <p>Preencha pelo menos um ID oficial no cadastro do cliente para liberar este painel.</p>
          {setupHref ? (
            <a
              href={setupHref}
              className="mt-3 inline-flex text-xs font-semibold text-terracota underline-offset-4 hover:underline"
            >
              Abrir ficha do cliente
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

type PlatformCardProps = {
  summary: ClientPlatformSummary;
};

function PlatformCard({ summary }: PlatformCardProps): JSX.Element {
  const kpis = summary.kpis ?? buildDefaultKpis(summary);
  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">{PLATFORM_LABELS[summary.platform]}</p>
        <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${STATUS_STYLES[summary.status]}`}>
          {summary.status === "connected" && "Dados atualizados"}
          {summary.status === "missing" && "Nao se aplica"}
          {summary.status === "pending" && "Configuracao pendente"}
          {summary.status === "error" && "Nao foi possivel atualizar"}
        </span>
      </div>

      {summary.message ? <p className="text-xs text-gray-600">{summary.message}</p> : null}

      <dl className="grid grid-cols-2 gap-3 text-sm text-gray-700">
        {kpis.map((kpi) => (
          <div key={kpi.key}>
            <dt className="text-[10px] font-semibold uppercase tracking-[0.3em] text-gray-400">{kpi.label}</dt>
            <dd className="font-semibold text-gray-900">{formatKpiValue(kpi.value, kpi.format, kpi.precision)}</dd>
          </div>
        ))}
      </dl>

      <p className="text-[11px] text-gray-500">
        Ultima atualizacao: {summary.lastSynced ? new Date(summary.lastSynced).toLocaleString("pt-BR") : "-"}
      </p>
    </div>
  );
}
