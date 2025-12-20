'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type {
  ClientPipelineStage,
  ClientsDashboardSummary,
  ClientSummaryHighlights
} from "../../types/clients";
import { useAuth } from "../auth/AuthProvider";

type FetchState =
  | { status: "idle"; data: null }
  | { status: "loading"; data: null }
  | { status: "loaded"; data: ClientsDashboardSummary }
  | { status: "error"; data: null; message: string };

const STAGE_STYLE: Record<ClientPipelineStage["id"], string> = {
  contact: "bg-terracota/10 text-terracota border-terracota/30",
  cadastro: "bg-deepGreen/10 text-deepGreen border-deepGreen/20",
  ids: "bg-emerald-50 text-emerald-800 border-emerald-200",
  metrics: "bg-indigo-50 text-indigo-700 border-indigo-200"
};

const formatDateTime = (value: string | null): string => {
  if (!value) {
    return "Sem registro";
  }
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
};

export function ClientOnboardingCard(): JSX.Element {
  const { token, status: authStatus } = useAuth();
  const [state, setState] = useState<FetchState>({ status: "idle", data: null });

  const isAuthenticated = authStatus === "authenticated" && Boolean(token);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setState({ status: "idle", data: null });
      return;
    }
    setState({ status: "loading", data: null });
    apiFetch<ClientsDashboardSummary>("/clients/summary", { token })
      .then((data) => setState({ status: "loaded", data }))
      .catch((error) => {
        const message =
          error instanceof ApiError ? error.message : "Nao foi possivel carregar o funil de clientes.";
        setState({ status: "error", data: null, message });
      });
  }, [token, isAuthenticated]);

  const highlights: ClientSummaryHighlights | null = useMemo(() => {
    return state.status === "loaded" ? state.data.highlights : null;
  }, [state]);

  if (!isAuthenticated) {
    return (
      <section className="card space-y-3 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Pipe de onboarding</p>
        <h2 className="text-xl font-semibold text-deepGreen">Conecte-se para ver os clientes</h2>
        <p className="text-sm text-deepGreen/70">
          Entre no Taskora para desbloquear o funil Contato &rarr; Cadastro &rarr; IDs &rarr; Metricas.
        </p>
      </section>
    );
  }

  const pipeline = state.status === "loaded" ? state.data.pipeline : [];
  const directorySync =
    state.status === "loaded" ? formatDateTime(state.data.metadata.directoryLastSync) : "Sem registro";

  return (
    <section className="card space-y-6 p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Pipe de onboarding</p>
          <h2 className="text-xl font-semibold text-deepGreen">Contato &rarr; Cadastro &rarr; IDs &rarr; Metricas</h2>
          <p className="text-sm text-deepGreen/60">
            Acompanhe quantos clientes ja foram conectados e priorize quem ainda precisa de IDs ou metricas.
          </p>
        </div>
        <div className="text-right text-xs text-deepGreen/60">
          <p>Directory sync</p>
          <p className="font-semibold text-deepGreen">{directorySync}</p>
        </div>
      </header>

      {state.status === "loading" ? (
        <p className="text-sm text-deepGreen/70">Carregando o funil de onboarding...</p>
      ) : null}
      {state.status === "error" ? (
        <p className="text-sm text-red-600">{state.message}</p>
      ) : null}

      {pipeline.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pipeline.map((stage) => (
            <article
              key={stage.id}
              className={`rounded-3xl border px-5 py-4 shadow-inner ${STAGE_STYLE[stage.id]} flex flex-col justify-between min-h-[180px]`}
            >
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/60">{stage.label}</p>
                <p className="text-4xl font-extrabold">{stage.count}</p>
              </div>
              <p className="text-xs text-deepGreen/80">{stage.helper}</p>
            </article>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <HighlightList
          title="IDs pendentes"
          emptyMessage="Todos os clientes ativos possuem IDs conectados."
          items={highlights?.missingIds ?? []}
          renderItem={(item) => (
            <div key={item.id}>
              <p className="text-sm font-semibold text-deepGreen">{item.name}</p>
              <p className="text-xs text-deepGreen/60">
                Falta conectar: {item.missing.map(formatIdentifier).join(", ")}
              </p>
            </div>
          )}
        />
        <HighlightList
          title="Metricas a configurar"
          emptyMessage="Nenhum cliente com IDs aguardando metricas."
          items={highlights?.missingMetrics ?? []}
          renderItem={(item) => (
            <div key={item.id}>
              <p className="text-sm font-semibold text-deepGreen">{item.name}</p>
              {item.statuses.length > 0 ? (
                <p className="text-xs text-deepGreen/60">
                  Status:{" "}
                  {item.statuses
                    .map((status) => `${formatPlatform(status.platform)} (${status.status})`)
                    .join(", ")}
                </p>
              ) : (
                <p className="text-xs text-deepGreen/60">Sem dados sincronizados ainda.</p>
              )}
            </div>
          )}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-deepGreen/10 bg-offWhite/80 px-4 py-3 text-sm text-deepGreen">
        <p className="max-w-2xl">
          Precisa atualizar algo? Abra o módulo de clientes para cadastrar, vincular IDs ou revisar métricas dos
          clientes da agência.
        </p>
        <Link
          href="/clients"
          className="inline-flex items-center justify-center rounded-full border border-deepGreen/20 px-4 py-2 text-xs font-semibold text-deepGreen transition hover:border-deepGreen/50"
        >
          Abrir modulo Clientes
        </Link>
      </div>
    </section>
  );
}

type HighlightListProps<T extends { id: string }> = {
  title: string;
  items: T[];
  emptyMessage: string;
  renderItem: (item: T) => JSX.Element;
};

function HighlightList<T extends { id: string }>({
  title,
  items,
  emptyMessage,
  renderItem
}: HighlightListProps<T>): JSX.Element {
  return (
    <div className="space-y-2 rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-4">
      <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">{title}</p>
      {items.length === 0 ? (
        <p className="text-sm text-deepGreen/60">{emptyMessage}</p>
      ) : (
        <ul className="space-y-2 text-sm text-deepGreen/80">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-deepGreen/10 bg-white/80 px-3 py-2">
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatIdentifier(key: string): string {
  switch (key) {
    case "google":
      return "Google Ads";
    case "meta":
      return "Meta Ads";
    case "ga4":
      return "GA4";
    case "pinterest":
      return "Pinterest Ads";
    default:
      return key.toUpperCase();
  }
}

function formatPlatform(platform: string): string {
  switch (platform) {
    case "google":
      return "Google";
    case "meta":
      return "Meta";
    case "ga4":
      return "GA4";
    default:
      return platform.toUpperCase();
  }
}
