"use client";

import { Download, Loader2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { TASK_TYPE_LABELS, TASK_TYPE_OPTIONS } from "../../constants/tasks";
import { apiFetch, API_BASE_URL } from "../../lib/api";
import { getActiveOrgId } from "../../lib/org";
import type { TaskByClientReport, TaskByClientReportMode } from "../../types/reports";
import type { TaskType } from "../../types/tasks";
import { useAuth } from "../auth/AuthProvider";
import { useActiveOrg } from "../org/OrgProvider";

type QuickRange = "this_month" | "last30" | "last7" | "custom";

type ReportFilters = {
  mode: TaskByClientReportMode;
  quickRange: QuickRange;
  from: string;
  to: string;
  selectedTypes: TaskType[];
  useCustomTypes: boolean;
};

const SUMMARY_TYPES: TaskType[] = ["report", "feedback", "billing", "meeting"];

function addUtcDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().slice(0, 10);
}

function resolveRange(filters: ReportFilters): { start: string | null; end: string | null } {
  if (filters.quickRange === "custom") {
    return { start: filters.from || null, end: filters.to || null };
  }

  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  if (filters.quickRange === "this_month") {
    return { start: formatDateInput(startOfUtcMonth(todayUtc)), end: formatDateInput(todayUtc) };
  }
  if (filters.quickRange === "last30") {
    return { start: formatDateInput(addUtcDays(todayUtc, -29)), end: formatDateInput(todayUtc) };
  }
  return { start: formatDateInput(addUtcDays(todayUtc, -6)), end: formatDateInput(todayUtc) };
}

function buildQueryString(query: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value == null) {
      return;
    }
    params.append(key, value);
  });
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function resolveModeLabel(mode: TaskByClientReportMode): string {
  return mode === "summary" ? "resumo" : "todas";
}

export function DeliveriesReportPage(): JSX.Element {
  const { token } = useAuth();
  const { organizations, activeOrgId } = useActiveOrg();
  const [filters, setFilters] = useState<ReportFilters>({
    mode: "summary",
    quickRange: "this_month",
    from: "",
    to: "",
    selectedTypes: SUMMARY_TYPES,
    useCustomTypes: false
  });
  const [report, setReport] = useState<TaskByClientReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeOrgName = useMemo(() => {
    if (!activeOrgId) {
      return null;
    }
    return organizations.find((org) => org.id === activeOrgId)?.name ?? activeOrgId;
  }, [organizations, activeOrgId]);

  const allTypes = useMemo(() => TASK_TYPE_OPTIONS.map((option) => option.value), []);

  const handleModeChange = (mode: TaskByClientReportMode) => {
    const nextTypes = mode === "summary" ? SUMMARY_TYPES : allTypes;
    setFilters((prev) => ({
      ...prev,
      mode,
      selectedTypes: nextTypes,
      useCustomTypes: false
    }));
  };

  const toggleType = (type: TaskType) => {
    setFilters((prev) => {
      const next = new Set(prev.selectedTypes);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return {
        ...prev,
        selectedTypes: Array.from(next),
        useCustomTypes: true
      };
    });
  };

  const applySelectAll = () => {
    setFilters((prev) => ({
      ...prev,
      selectedTypes: allTypes,
      useCustomTypes: true
    }));
  };

  const applyClearAll = () => {
    setFilters((prev) => ({
      ...prev,
      selectedTypes: [],
      useCustomTypes: true
    }));
  };

  const fetchReport = useCallback(async () => {
    if (!token) {
      return;
    }
    setError(null);
    setIsLoading(true);

    try {
      const { start, end } = resolveRange(filters);
      if (!start || !end) {
        setError("Defina o periodo para consultar o relatorio.");
        setReport(null);
        return;
      }

      const query: Record<string, string> = {
        periodStart: start,
        periodEnd: end,
        mode: filters.mode
      };

      if (filters.useCustomTypes) {
        query.types = filters.selectedTypes.join(",");
      }

      const data = await apiFetch<TaskByClientReport>("/reports/tasks-by-client", {
        token,
        query
      });
      setReport(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao carregar o relatorio.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [token, filters]);

  const exportReport = useCallback(
    async (format: "pdf" | "csv") => {
      if (!token) {
        return;
      }
      setError(null);

      try {
        const { start, end } = resolveRange(filters);
        if (!start || !end) {
          setError("Defina o periodo para exportar o relatorio.");
          return;
        }

        const query: Record<string, string | null> = {
          periodStart: start,
          periodEnd: end,
          mode: filters.mode,
          format
        };

        if (filters.useCustomTypes) {
          query.types = filters.selectedTypes.join(",");
        }

        const url = `${API_BASE_URL}/reports/tasks-by-client/export${buildQueryString(query)}`;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`
        };
        const activeOrg = getActiveOrgId();
        if (activeOrg) {
          headers["X-Org-Id"] = activeOrg;
        }

        const response = await fetch(url, {
          method: "GET",
          headers
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message = payload?.message ?? `Erro ao exportar (${response.status}).`;
          throw new Error(message);
        }

        const blob = await response.blob();
        const disposition = response.headers.get("Content-Disposition") ?? "";
        const match = /filename="?([^";]+)"?/i.exec(disposition);
        const filename = match?.[1] ?? `relatorio_entregas.${format}`;

        const urlObject = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = urlObject;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(urlObject);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Falha ao exportar o relatorio.";
        setError(message);
      }
    },
    [token, filters]
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    void fetchReport();
  }, [token, fetchReport]);

  const rangeLabel = useMemo(() => {
    if (filters.quickRange === "custom") {
      return filters.from && filters.to ? `${filters.from} a ${filters.to}` : "Periodo personalizado";
    }
    if (filters.quickRange === "this_month") {
      return "Este mes";
    }
    if (filters.quickRange === "last30") {
      return "Ultimos 30 dias";
    }
    return "Ultimos 7 dias";
  }, [filters]);

  const typeLabel = useMemo(() => {
    if (!filters.useCustomTypes) {
      return filters.mode === "summary" ? "Tipos principais" : "Todos os tipos";
    }
    if (filters.selectedTypes.length === 0) {
      return "Nenhum tipo selecionado";
    }
    return filters.selectedTypes.map((type) => TASK_TYPE_LABELS[type] ?? type).join(", ");
  }, [filters]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="rounded-3xl bg-deepGreen px-6 py-6 text-offWhite shadow-lg shadow-deepGreen/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-100">Relatorios</p>
            <h1 className="mt-2 text-2xl font-semibold">Relatorio de entregas por cliente</h1>
            <p className="mt-2 max-w-3xl text-sm text-emerald-50">
              Agrupa entregas concluidas no periodo e gera CSV/PDF com o resumo por cliente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={fetchReport}
              className="inline-flex items-center gap-2 rounded-xl bg-offWhite px-4 py-2 text-sm font-semibold text-deepGreen shadow shadow-deepGreen/25 transition hover:bg-emerald-100"
            >
              <RefreshCw className="size-4" />
              Atualizar
            </button>
          </div>
        </div>
      </header>

      <section className="sticky top-4 z-10 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Filtros</p>
            <p className="text-sm text-gray-700">
              {activeOrgName ?? "Organizacao"} - {rangeLabel}
            </p>
            <p className="text-xs text-gray-500">Modo {resolveModeLabel(filters.mode)} - {typeLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Total clientes: {report?.totals.clients ?? 0}</span>
            <span>-</span>
            <span>Total entregas: {report?.totals.tasks ?? 0}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">Modo</p>
              <div className="flex flex-wrap gap-2">
                {(["summary", "all"] as TaskByClientReportMode[]).map((mode) => {
                  const active = filters.mode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => handleModeChange(mode)}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
                        active
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {mode === "summary" ? "Resumos" : "Todas"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-gray-500">Periodo</p>
              <div className="flex flex-wrap gap-2">
                {(["this_month", "last30", "last7", "custom"] as QuickRange[]).map((range) => {
                  const active = filters.quickRange === range;
                  return (
                    <button
                      key={range}
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, quickRange: range }))}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
                        active
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {range === "this_month" && "Este mes"}
                      {range === "last30" && "Ultimos 30 dias"}
                      {range === "last7" && "Ultimos 7 dias"}
                      {range === "custom" && "Personalizado"}
                    </button>
                  );
                })}
              </div>
            </div>

            {filters.quickRange === "custom" ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600" htmlFor="report-from">De</label>
                  <input
                    id="report-from"
                    type="date"
                    value={filters.from}
                    onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-600" htmlFor="report-to">Ate</label>
                  <input
                    id="report-to"
                    type="date"
                    value={filters.to}
                    onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Tipos de entrega</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={applySelectAll}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  onClick={applyClearAll}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                >
                  Limpar
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {TASK_TYPE_OPTIONS.map((option) => {
                const active = filters.selectedTypes.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleType(option.value)}
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
                      active
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={fetchReport}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Aplicar filtros
              </button>
              <button
                type="button"
                onClick={() => exportReport("csv")}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Download className="size-3" />
                Exportar CSV
              </button>
              <button
                type="button"
                onClick={() => exportReport("pdf")}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="size-3" />
                Exportar PDF
              </button>
            </div>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm font-semibold text-terracota">{error}</p> : null}
      </section>

      <section className="space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-deepGreen/10 bg-offWhite/80 px-4 py-3 text-sm text-deepGreen/70">
            <Loader2 className="size-4 animate-spin" />
            Carregando relatorio...
          </div>
        ) : null}

        {report?.clients.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-6 text-center text-sm text-deepGreen">
            <p className="text-base font-semibold">Sem entregas no periodo</p>
            <p className="mt-1 text-deepGreen/70">Ajuste os filtros ou tente outro intervalo.</p>
          </div>
        ) : null}

        {report?.clients.map((client) => (
          <article key={client.clientId} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{client.clientName}</h2>
                <p className="text-xs text-gray-500">{client.tasks.length} entregas</p>
              </div>
            </div>

            {client.tasks.length === 0 ? (
              <p className="text-sm text-gray-500">Sem entregas no periodo.</p>
            ) : (
              <div className="space-y-3">
                {client.tasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">
                          {formatDateLabel(task.completedAt)} - {TASK_TYPE_LABELS[task.type] ?? task.type}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                      </div>
                      {task.projectName ? (
                        <span className="text-xs font-medium text-gray-500">Projeto: {task.projectName}</span>
                      ) : null}
                    </div>
                    {task.assignees.length > 0 ? (
                      <p className="mt-2 text-xs text-gray-600">
                        Responsaveis: {task.assignees.map((assignee) => assignee.name).join(", ")}
                      </p>
                    ) : null}
                    {task.description ? (
                      <p className="mt-2 text-xs text-gray-600">{task.description}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
