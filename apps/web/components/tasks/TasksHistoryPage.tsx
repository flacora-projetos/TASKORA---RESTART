"use client";

import { ArrowUp, Clock3, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch } from "../../lib/api";
import { formatMinutesAsClock } from "../../lib/datetime";
import { formatEventType, formatPlatform, formatSource, formatUserName } from "../../lib/historyFormat";
import { renderTextWithLinks } from "../../lib/text";
import type { ClientTimelineEvent, ClientTimelineEventType } from "../../types/client-timeline";
import type { TaskOverviewResponse } from "../../types/tasks";
import { useAuth } from "../auth/AuthProvider";

type QuickRange = "last7" | "last15" | "last30" | "custom";

type HistoryFilters = {
  clientId: string;
  eventType: ClientTimelineEventType | "all";
  quickRange: QuickRange;
  from: string;
  to: string;
  projectId: string;
  assigneeId: string;
};

type HistoryResponse = {
  items: Array<ClientTimelineEvent & { clientId?: string; orgId?: string }>;
  nextCursor: string | null;
};

const EVENT_TYPE_LABELS: Record<ClientTimelineEventType, string> = {
  task: "Tarefa",
  hour: "Horas",
  note: "Nota",
  meeting: "Reuniao",
  report: "Relatorio",
  integration: "Integracao",
  alert: "Alerta"
};

const PAGE_SIZE = 20;

function formatDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function buildDateRange(current: HistoryFilters) {
  if (current.quickRange === "custom") {
    return { from: current.from || undefined, to: current.to || undefined };
  }
  const end = new Date();
  const start = new Date();
  const days = current.quickRange === "last15" ? 15 : current.quickRange === "last30" ? 30 : 7;
  start.setUTCDate(start.getUTCDate() - days);
  const to = end.toISOString().slice(0, 10);
  const from = start.toISOString().slice(0, 10);
  return { from, to };
}

export function TasksHistoryPage(): JSX.Element {
  const { token } = useAuth();
  const [filters, setFilters] = useState<HistoryFilters>({
    clientId: "all",
    eventType: "all",
    quickRange: "last7",
    from: "",
    to: "",
    projectId: "all",
    assigneeId: "all"
  });
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [assignees, setAssignees] = useState<Array<{ id: string; name: string }>>([]);
  const [items, setItems] = useState<ClientTimelineEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const clientOptions = useMemo(() => [{ id: "all", name: "Todos os clientes" }, ...clients], [clients]);
  const projectOptions = useMemo(() => [{ id: "all", name: "Todos os projetos" }, ...projects], [projects]);
  const assigneeOptions = useMemo(
    () => [{ id: "all", name: "Todos os responsaveis" }, ...assignees],
    [assignees]
  );

  const loadFilters = useCallback(async () => {
    try {
      const overview = await apiFetch<TaskOverviewResponse>("/tasks/overview", {
        token,
        method: "GET"
      });
      setClients(
        overview.filters.clients.map((client) => ({
          id: client.id,
          name: client.name
        }))
      );
      setProjects(
        overview.filters.projects.map((project) => ({
          id: project.id,
          name: project.name
        }))
      );
      setAssignees(
        overview.filters.assignees.map((assignee) => ({
          id: assignee.id,
          name: assignee.name ?? assignee.id
        }))
      );
    } catch (err) {
      console.warn("Falha ao carregar filtros de clientes", err);
    }
  }, [token]);

  const fetchHistory = useCallback(
    async (reset = false) => {
      if (!token) return;
      setError(null);
      if (reset) {
        setIsLoading(true);
        setItems([]);
      } else {
        setIsLoadingMore(true);
      }

      try {
        const query: Record<string, string> = { limit: String(PAGE_SIZE) };
        if (filters.clientId !== "all") query.clientId = filters.clientId;
        if (filters.eventType !== "all") query.eventType = filters.eventType;
        if (filters.projectId !== "all") query.projectId = filters.projectId;
        if (filters.assigneeId !== "all") query.assigneeId = filters.assigneeId;
        const { from, to } = buildDateRange(filters);
        if (from) query.from = from;
        if (to) query.to = to;
        if (!reset && nextCursor) query.before = nextCursor;

        const response = await apiFetch<HistoryResponse>("/tasks/history", {
          token,
          method: "GET",
          query
        });

        setItems((prev) => (reset ? response.items : [...prev, ...response.items]));
        setNextCursor(response.nextCursor);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nao foi possivel carregar o historico.");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [token, filters, nextCursor]
  );

  useEffect(() => {
    if (!token) return;
    void loadFilters();
    void fetchHistory(true);
  }, [token, loadFilters, fetchHistory]);

  const filteredLabel =
    filters.clientId !== "all" || filters.eventType !== "all" || filters.projectId !== "all" || filters.assigneeId !== "all"
      ? "Resultados filtrados"
      : "Todos os eventos recentes";

  const exportCsv = useCallback(() => {
    if (!items.length) return;
    const header = ["Data", "Tipo", "Titulo", "Descricao", "Cliente", "Projeto", "Tarefa", "Usuario"].join(",");
    const rows = items.map((event) => {
      const metadata = event.metadata ?? {};
      const clientName = metadata["clientName"] ?? "";
      const projectName = metadata["projectName"] ?? "";
      const taskTitle = metadata["taskTitle"] ?? metadata["taskName"] ?? "";
      const actor = formatUserName(event.actorLabel) ?? "";
      const values = [
        event.occurredAt,
        formatEventType(event.eventType),
        event.title ?? "",
        event.description ?? "",
        String(clientName),
        String(projectName),
        String(taskTitle),
        actor
      ];
      return values
        .map((value) => {
          const safe = String(value ?? "");
          if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
            return `"${safe.replace(/"/g, '""')}"`;
          }
          return safe;
        })
        .join(",");
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "historico-tarefas.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [items]);

  const exportPdf = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="rounded-3xl bg-deepGreen px-6 py-6 text-offWhite shadow-lg shadow-deepGreen/25">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-100">Historico</p>
            <h1 className="mt-2 text-2xl font-semibold">Historico e execucao</h1>
            <p className="mt-2 max-w-3xl text-sm text-emerald-50">
              Consulte os eventos recentes (status, prazos, notas, horas e integracoes) por cliente ou tipo.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fetchHistory(true)}
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
            <p className="text-sm text-gray-700">{filteredLabel}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Sparkles className="size-4" />
            Eventos mais recentes primeiro
          </div>
        </div>

        <div className="mt-4">
          <div className="grid items-start gap-4 md:grid-cols-3">
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="history-client">
                  Cliente
                </label>
                <div className="relative">
                  <select
                    id="history-client"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    value={filters.clientId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, clientId: event.target.value }))}
                  >
                    {clientOptions.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <Search className="pointer-events-none absolute right-3 top-2.5 size-4 text-gray-400" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="history-project">
                  Projeto
                </label>
                <select
                  id="history-project"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={filters.projectId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, projectId: event.target.value }))}
                >
                  {projectOptions.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="mb-1 block text-xs font-medium text-gray-500" htmlFor="history-assignee">
                  Responsavel
                </label>
                <select
                  id="history-assignee"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  value={filters.assigneeId}
                  onChange={(event) => setFilters((prev) => ({ ...prev, assigneeId: event.target.value }))}
                >
                  {assigneeOptions.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <p className="mb-1 text-xs font-medium text-gray-500">Tipo de evento</p>
              <div className="flex flex-wrap gap-2">
                {(["task", "hour", "note", "meeting", "report", "integration", "alert", "all"] as const).map((type) => {
                  const active = filters.eventType === type || (type === "all" && filters.eventType === "all");
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, eventType: type === "all" ? "all" : (type as ClientTimelineEventType) }))}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
                        active ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {type === "all" ? "Todos" : EVENT_TYPE_LABELS[type as ClientTimelineEventType]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex flex-col gap-2">
              <p className="mb-1 text-xs font-medium text-gray-500">Periodo</p>
                <div className="flex flex-wrap gap-2">
                  {(["last7", "last15", "last30", "custom"] as const).map((range) => {
                    const active = filters.quickRange === range;
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, quickRange: range }))}
                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium ${
                          active ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {range === "last7" && "Ultimos 7 dias"}
                        {range === "last15" && "Ultimos 15 dias"}
                        {range === "last30" && "Ultimos 30 dias"}
                        {range === "custom" && "Personalizado"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {filters.quickRange === "custom" ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600" htmlFor="history-from">
                      De
                    </label>
                    <input
                      id="history-from"
                      type="date"
                      value={filters.from}
                      onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-600" htmlFor="history-to">
                      Ate
                    </label>
                    <input
                      id="history-to"
                      type="date"
                      value={filters.to}
                      onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={() => fetchHistory(true)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Aplicar filtros
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters({
                      clientId: "all",
                      eventType: "all",
                      quickRange: "last7",
                      from: "",
                      to: "",
                      projectId: "all",
                      assigneeId: "all"
                    });
                    void fetchHistory(true);
                  }}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                >
                  Exportar CSV
                </button>
                <button
                  type="button"
                  onClick={exportPdf}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Exportar PDF
                </button>
              </div>
            </div>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm font-semibold text-terracota">{error}</p> : null}
      </section>

      <section className="space-y-6" ref={listRef}>
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-deepGreen/10 bg-offWhite/80 px-4 py-3 text-sm text-deepGreen/70">
            <Loader2 className="size-4 animate-spin" />
            Carregando historico...
          </div>
        ) : null}

        {items.length === 0 && !isLoading ? (
          <div className="rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-6 text-center text-sm text-deepGreen">
            <p className="text-base font-semibold">Nenhum evento por aqui</p>
            <p className="mt-1 text-deepGreen/70">Ajuste os filtros ou tente novamente mais tarde.</p>
          </div>
        ) : null}

        {items.map((event, index) => {
          const formattedType = formatEventType(event.eventType);
          const actor = formatUserName(event.actorLabel);
          const tags: string[] = [];
          const taskName = event.metadata?.["taskTitle"] ?? event.metadata?.["taskName"];
          const projectName = event.metadata?.["projectName"] ?? event.metadata?.["projectTitle"];
          const clientName = event.metadata?.["clientName"];
          if (clientName) tags.push(`Cliente: ${String(clientName)}`);
          if (projectName) tags.push(`Projeto: ${String(projectName)}`);
          if (taskName) tags.push(`Tarefa: ${String(taskName)}`);
          if (event.metadata?.["platform"]) {
            const platform = formatPlatform(String(event.metadata["platform"]));
            if (platform) tags.push(`Plataforma: ${platform}`);
          }
          if (event.metadata?.["minutes"]) {
            tags.push(`Horas: ${formatMinutesAsClock(Number(event.metadata["minutes"]))}`);
          }
          const sourceLabel = formatSource(event.source);
          const isLast = index === items.length - 1;

          return (
            <div key={`${event.id}-${event.occurredAt}`} className="flex items-start gap-4">
              <div className="flex flex-col items-center pt-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                {!isLast ? <div className="mt-1 h-full w-px flex-1 bg-gray-200" /> : null}
              </div>
              <article className="flex-1 space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{formattedType}</p>
                    <p className="mt-1 text-sm text-gray-700">{event.title}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3" />
                      {formatDate(event.occurredAt)}
                    </span>
                  </p>
                </div>
                {event.description ? (
                  <p className="text-sm text-gray-700">{renderTextWithLinks(event.description)}</p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {tag}
                    </span>
                  ))}
                  {sourceLabel ? (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      Origem: {sourceLabel}
                    </span>
                  ) : null}
                </div>
                {actor ? <p className="text-[11px] text-gray-500">Por {actor}</p> : null}
              </article>
            </div>
          );
        })}

        {nextCursor ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => fetchHistory(false)}
              className="inline-flex items-center gap-2 rounded-full bg-deepGreen px-5 py-2 text-sm font-semibold text-offWhite shadow shadow-deepGreen/30 transition hover:bg-deepGreen/90 disabled:opacity-60"
              disabled={isLoadingMore}
            >
              {isLoadingMore ? <Loader2 className="size-4 animate-spin" /> : null}
              Carregar mais
            </button>
          </div>
        ) : null}
      </section>

      {showBackToTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full bg-deepGreen px-4 py-3 text-sm font-semibold text-offWhite shadow-lg shadow-deepGreen/40 transition hover:bg-deepGreen/90"
        >
          <ArrowUp className="size-4" />
          Topo
        </button>
      ) : null}
    </div>
  );
}
