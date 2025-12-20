'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { TASK_STATUS_LABELS } from "../../constants/tasks";
import { apiFetch, ApiError } from "../../lib/api";
import { renderTextWithLinks } from "../../lib/text";
import type { ClientTimelineEvent, ClientTimelineEventType } from "../../types/client-timeline";
import type { TaskStatus } from "../../types/tasks";

const EVENT_TYPE_LABELS: Record<ClientTimelineEventType, string> = {
  note: "Nota",
  meeting: "Reuniao",
  integration: "Integracao",
  task: "Tarefa",
  hour: "Horas",
  report: "Relatorio",
  alert: "Alerta"
};

const EVENT_TYPE_OPTIONS: ClientTimelineEventType[] = ["note", "meeting", "task", "integration", "hour", "report", "alert"];

type TimelineState =
  | { status: "idle"; items: ClientTimelineEvent[] }
  | { status: "loading"; items: ClientTimelineEvent[] }
  | { status: "loaded"; items: ClientTimelineEvent[] }
  | { status: "error"; items: ClientTimelineEvent[]; message: string };

type FilterValue = "all" | ClientTimelineEventType;

const FILTER_OPTIONS: Array<{ value: FilterValue; label: string }> = [
  { value: "all", label: "Todos" },
  ...Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => ({ value: value as ClientTimelineEventType, label }))
];

const PAGE_SIZE = 20;

const STATUS_KEYS = new Set(["statusBefore", "statusAfter"]);
const DATE_KEYS = new Set(["dueDateBefore", "dueDateAfter", "deadline", "occurredAt"]);
const HIDDEN_KEYS = new Set(["taskId", "projectId", "actorId", "projectSlug", "taskSlug"]);

const METADATA_LABELS: Record<string, string> = {
  projectName: "Projeto",
  taskTitle: "Tarefa",
  dueDateBefore: "Prazo anterior",
  dueDateAfter: "Novo prazo",
  priorityBefore: "Prioridade anterior",
  priorityAfter: "Nova prioridade",
  assignees: "Responsaveis",
  hours: "Horas registradas",
  reportName: "Relatorio",
  integrationName: "Integracao",
  integrationStatus: "Resultado",
  integrationNotes: "Notas da integracao",
  alertType: "Tipo de alerta",
  alertStatus: "Status do alerta",
  clientContact: "Contato do cliente"
};

type MetadataSummaryItem = { label: string; value: string };

const formatLabel = (key: string): string =>
  METADATA_LABELS[key] ??
  key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/^./, (character) => character.toUpperCase());

const formatDateValue = (value: unknown): string | null => {
  if (typeof value !== "string" || !value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const formatStatusValue = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  return TASK_STATUS_LABELS[value as TaskStatus] ?? value;
};

const formatMetadataValue = (key: string, value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (STATUS_KEYS.has(key)) {
    return formatStatusValue(value);
  }
  if (DATE_KEYS.has(key)) {
    return formatDateValue(value);
  }
  if (typeof value === "number") {
    if (key === "hours") {
      return value === 1 ? "1 hora" : `${value} horas`;
    }
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  if (typeof value === "string") {
    return value;
  }
  return null;
};

const buildMetadataSummary = (metadata: ClientTimelineEvent["metadata"]): MetadataSummaryItem[] => {
  if (!metadata || typeof metadata !== "object") {
    return [];
  }
  const summary: MetadataSummaryItem[] = [];
  const meta = metadata as Record<string, unknown>;
  const usedKeys = new Set<string>();

  if ("statusBefore" in meta || "statusAfter" in meta) {
    const before = formatStatusValue(meta.statusBefore);
    const after = formatStatusValue(meta.statusAfter);
    summary.push({
      label: "Status atualizado",
      value: `${before ?? "-"} -> ${after ?? "-"}`
    });
    usedKeys.add("statusBefore");
    usedKeys.add("statusAfter");
  }

  if ("priorityBefore" in meta || "priorityAfter" in meta) {
    const before = typeof meta.priorityBefore === "string" ? meta.priorityBefore : null;
    const after = typeof meta.priorityAfter === "string" ? meta.priorityAfter : null;
    summary.push({
      label: "Prioridade",
      value: `${before ?? "-"} -> ${after ?? "-"}`
    });
    usedKeys.add("priorityBefore");
    usedKeys.add("priorityAfter");
  }

  if ("dueDateBefore" in meta || "dueDateAfter" in meta) {
    const before = formatDateValue(meta.dueDateBefore);
    const after = formatDateValue(meta.dueDateAfter);
    summary.push({
      label: "Prazo ajustado",
      value: `${before ?? "-"} -> ${after ?? "-"}`
    });
    usedKeys.add("dueDateBefore");
    usedKeys.add("dueDateAfter");
  }

  Object.entries(meta).forEach(([key, value]) => {
    if (usedKeys.has(key) || HIDDEN_KEYS.has(key)) {
      return;
    }
    const formattedValue = formatMetadataValue(key, value);
    if (!formattedValue) {
      return;
    }
    summary.push({
      label: formatLabel(key),
      value: formattedValue
    });
  });

  return summary;
};

const buildEventHighlight = (event: ClientTimelineEvent): string | null => {
  const metadata = event.metadata && typeof event.metadata === "object" ? (event.metadata as Record<string, unknown>) : null;
  if (!metadata) {
    return null;
  }
  if (event.eventType === "integration") {
    const integrationName = typeof metadata.integrationName === "string" ? metadata.integrationName : metadata.platform;
    const integrationStatus = typeof metadata.integrationStatus === "string" ? metadata.integrationStatus : null;
    if (integrationName || integrationStatus) {
      return `${integrationName ?? "Integracao"} ${integrationStatus ?? "processada"}`.trim();
    }
  }
  if (event.eventType === "task") {
    const taskTitle = typeof metadata.taskTitle === "string" ? metadata.taskTitle : null;
    const statusAfter = formatStatusValue(metadata.statusAfter);
    if (taskTitle && statusAfter) {
      return `Tarefa "${taskTitle}" agora esta ${statusAfter.toLowerCase()}.`;
    }
  }
  if (event.eventType === "hour" && typeof metadata.hours === "number") {
    return metadata.hours === 1 ? "Registrada 1 hora no cliente." : `Registradas ${metadata.hours} horas no cliente.`;
  }
  if (event.eventType === "report" && typeof metadata.reportName === "string") {
    return `Relatorio "${metadata.reportName}" enviado ou atualizado.`;
  }
  return null;
};

type Props = {
  clientId: string;
  token: string;
};

export function ClientTimelineCard({ clientId, token }: Props): JSX.Element {
  const [state, setState] = useState<TimelineState>({ status: "idle", items: [] });
  const [filter, setFilter] = useState<FilterValue>("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [eventType, setEventType] = useState<ClientTimelineEventType>("note");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadTimeline = useCallback(
    async (currentToken: string, options?: { append?: boolean; before?: string | null }) => {
      const append = options?.append ?? false;
      const before = options?.before ?? null;

      if (append) {
        setIsLoadingMore(true);
      } else {
        setState((prev) => ({ ...prev, status: "loading" }));
      }

      try {
        const response = await apiFetch<{ items: ClientTimelineEvent[] }>(`/clients/${clientId}/timeline`, {
          token: currentToken,
          query: {
            limit: PAGE_SIZE,
            eventType: filter === "all" ? undefined : filter,
            before: before ?? undefined
          }
        });

        setHasMore(response.items.length === PAGE_SIZE);
        setCursor(response.items.length ? response.items[response.items.length - 1].occurredAt : null);
        setState((prev) => ({
          status: "loaded",
          items: append ? [...prev.items, ...response.items] : response.items
        }));
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Nao foi possivel carregar a timeline.";
        setState({ status: "error", items: [], message });
      } finally {
        setIsLoadingMore(false);
      }
    },
    [clientId, filter]
  );

  useEffect(() => {
    if (!token) {
      setState({ status: "idle", items: [] });
      return;
    }
    void loadTimeline(token);
  }, [clientId, filter, loadTimeline, token]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!title.trim()) {
        setFeedback("Preencha o titulo para registrar o evento.");
        return;
      }

      setIsSubmitting(true);
      setFeedback(null);

      try {
        await apiFetch(`/clients/${clientId}/timeline`, {
          token,
          method: "POST",
          body: {
            title: title.trim(),
            description: description.trim() || undefined,
            eventType
          }
        });
        setTitle("");
        setDescription("");
        setEventType("note");
        setFeedback("Evento registrado.");
        await loadTimeline(token);
      } catch (error) {
        setFeedback(error instanceof ApiError ? error.message : "Nao foi possivel registrar o evento.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [clientId, description, eventType, loadTimeline, title, token]
  );

  const timelineItems = useMemo(() => state.items, [state.items]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">Historico</p>
          <h2 className="text-lg font-semibold text-gray-900">Linha do tempo do cliente</h2>
          <p className="text-sm text-gray-600">
            Centralize notas internas, reunioes e alertas automaticos em um unico lugar.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as FilterValue)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => token && loadTimeline(token)}
            className="rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:border-gray-500"
            disabled={state.status === "loading"}
          >
            Atualizar
          </button>
        </div>
      </header>

      {state.status === "error" ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message}</p>
      ) : null}

      {state.status === "loading" && timelineItems.length === 0 ? (
        <p className="text-sm text-gray-500">Buscando eventos...</p>
      ) : null}

      {timelineItems.length === 0 && state.status === "loaded" ? (
        <p className="rounded-lg border border-dashed border-gray-200 px-4 py-4 text-sm text-gray-500">
          Ainda nao existem registros nesta linha do tempo.
        </p>
      ) : null}

      {timelineItems.length > 0 ? (
        <ul className="space-y-4">
          {timelineItems.map((item) => {
            const metadataSummary = buildMetadataSummary(item.metadata);
            const highlight = buildEventHighlight(item);
            const hasMetadata = Boolean(item.metadata && Object.keys(item.metadata).length);

            return (
              <li key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-800 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-gray-200 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-gray-600">
                      {EVENT_TYPE_LABELS[item.eventType]}
                    </span>
                    {Array.isArray(item.tags) && item.tags.length ? (
                      <div className="flex flex-wrap gap-1 text-[11px] text-gray-500">
                        {item.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-white/70 px-2 py-0.5">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(item.occurredAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                <p className="mt-2 font-semibold text-gray-800">{item.title}</p>
                {highlight ? <p className="mt-1 text-gray-700">{highlight}</p> : null}
                {item.description ? (
                  <p className="mt-1 text-gray-600">{renderTextWithLinks(item.description)}</p>
                ) : null}
                {metadataSummary.length ? (
                  <ul className="mt-2 space-y-1 text-xs text-gray-600">
                    {metadataSummary.map((detail, index) => (
                      <li key={`${item.id}-detail-${index}`}>
                        <span className="font-semibold">{detail.label}:</span> {detail.value}
                      </li>
                    ))}
                  </ul>
                ) : hasMetadata ? (
                  <p className="mt-2 text-xs text-gray-500">Detalhes tecnicos registrados no historico.</p>
                ) : null}
                <p className="mt-2 text-[11px] text-gray-500">
                  Registrado por {item.actorLabel ?? "sistema"} | origem: {item.source ?? "-"}
                </p>
              </li>
            );
          })}
        </ul>
      ) : null}

      {hasMore ? (
        <button
          type="button"
          onClick={() => token && loadTimeline(token, { append: true, before: cursor })}
          disabled={isLoadingMore}
          className="w-full rounded-full border border-deepGreen/20 px-4 py-2 text-sm font-semibold text-gray-800 hover:border-deepGreen/40 disabled:opacity-60"
        >
          {isLoadingMore ? "Carregando..." : "Carregar mais"}
        </button>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-800">Registrar novo evento</h3>
        {feedback ? <p className="text-xs text-gray-600">{feedback}</p> : null}
        <div className="flex flex-wrap gap-2">
          <select
            value={eventType}
            onChange={(event) => setEventType(event.target.value as ClientTimelineEventType)}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"
          >
            {EVENT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {EVENT_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titulo do evento"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"
          />
        </div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Detalhes adicionais (opcional)"
          rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center rounded-full bg-deepGreen px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-deepGreen/90 disabled:opacity-60"
        >
          {isSubmitting ? "Enviando..." : "Adicionar evento"}
        </button>
      </form>
    </section>
  );
}
