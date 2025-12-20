'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type { IntegrationStatusResponse } from "../../types/client-metrics";
import { useAuth } from "../auth/AuthProvider";

type StatusState =
  | { status: "idle"; data: IntegrationStatusResponse | null }
  | { status: "loading"; data: IntegrationStatusResponse | null }
  | { status: "loaded"; data: IntegrationStatusResponse }
  | { status: "error"; data: IntegrationStatusResponse | null; message: string };

const PLATFORM_LABELS: Record<string, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  ga4: "GA4"
};

const STATUS_BADGE: Record<string, string> = {
  connected: "bg-emerald-50 text-emerald-800 border-emerald-200",
  pending: "bg-amber-50 text-amber-800 border-amber-200",
  error: "bg-red-50 text-red-800 border-red-200",
  missing: "bg-slate-50 text-slate-700 border-slate-200"
};

const STATUS_COPY: Record<string, { label: string; helper: string }> = {
  connected: {
    label: "Dados atualizados",
    helper: "Integracao saudavel, nenhuma acao pendente."
  },
  pending: {
    label: "Aguardando dados",
    helper: "Abra a ficha do cliente e clique em Recarregar cache para tentar de novo."
  },
  error: {
    label: "Falha ao atualizar",
    helper: "Revise os IDs oficiais e, se preciso, rode o comando metrics:sync."
  },
  missing: {
    label: "Nao se aplica",
    helper: "Quando o cliente habilitar essa plataforma, preencha os IDs para liberar os dados."
  }
};

type IntegrationAlertsCardProps = {
  variant?: "default" | "compact";
};

export function IntegrationAlertsCard({ variant = "default" }: IntegrationAlertsCardProps): JSX.Element {
  const { token, status } = useAuth();
  const [state, setState] = useState<StatusState>({ status: "idle", data: null });

  const isAuthenticated = status === "authenticated" && Boolean(token);
  const isCompact = variant === "compact";

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setState({ status: "idle", data: null });
      return;
    }

    let isMounted = true;
    setState((prev) => ({ ...prev, status: "loading" }));
    apiFetch<IntegrationStatusResponse>("/metrics/integrations/status", { token })
      .then((data) => {
        if (!isMounted) {
          return;
        }
        setState({ status: "loaded", data });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof ApiError
            ? error.message
            : "Nao foi possivel carregar o status das integracoes agora.";
        setState({ status: "error", data: null, message });
      });

    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated]);

  const alerts = state.data?.alerts ?? [];

  const pendingCounts = useMemo(() => {
    if (!state.data) {
      return [];
    }

    return state.data.platforms.map((platform) => {
      const attention = platform.statusCounts.error + platform.statusCounts.pending;
      return {
        platform: platform.platform,
        label: PLATFORM_LABELS[platform.platform] ?? platform.platform,
        attention
      };
    });
  }, [state.data]);

  return (
    <section
      className={
        isCompact ? "rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-4 space-y-3" : "card p-6 space-y-4"
      }
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Alertas das integracoes</p>
          <h2 className={isCompact ? "text-base font-semibold text-deepGreen" : "text-xl font-semibold text-deepGreen"}>
            Status consolidado
          </h2>
        </div>
        {state.status === "error" ? (
          <span className="text-xs font-semibold text-red-600">Nao foi possivel carregar os alertas agora.</span>
        ) : null}
      </header>

      {!isAuthenticated ? (
        <p className="rounded-lg border border-dashed border-deepGreen/20 px-4 py-3 text-sm text-deepGreen/60">
          Entre com sua conta para acompanhar falhas e pendencias das integracoes.
        </p>
      ) : null}

      {state.status === "loading" ? (
        <p className="text-sm text-deepGreen/60">Atualizando status das integracoes...</p>
      ) : null}

      {pendingCounts.length ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {pendingCounts.map((platform) => (
            <div key={platform.platform} className="rounded-xl border border-deepGreen/10 bg-white/95 p-3 text-center">
              <p className="text-xs text-deepGreen/60">{platform.label}</p>
              <p className="text-2xl font-semibold text-deepGreen">{platform.attention}</p>
              <p className="text-[11px] text-deepGreen/50">pendencias</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-deepGreen">Alertas recentes</h3>
          <span className="text-xs text-deepGreen/60">{alerts.length} itens</span>
        </div>

        {alerts.length === 0 && state.status === "loaded" ? (
          <p className="rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Sem pendencias no momento.
          </p>
        ) : null}

        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={`${alert.clientId}-${alert.platform}`}
              className="rounded-xl border border-deepGreen/10 bg-offWhite/60 px-4 py-3 text-sm text-deepGreen"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <Link
                    href={`/clients/${alert.clientId}`}
                    className="font-semibold text-deepGreen underline-offset-2 hover:underline"
                  >
                    {alert.clientName}
                  </Link>
                  <p className="text-xs text-deepGreen/60">{PLATFORM_LABELS[alert.platform] ?? alert.platform}</p>
                </div>
                <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${STATUS_BADGE[alert.status]}`}>
                  {STATUS_COPY[alert.status]?.label ?? alert.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-deepGreen/60">{STATUS_COPY[alert.status]?.helper}</p>
              <p className="mt-2 text-xs text-deepGreen/50">
                Atualizado em {new Date(alert.updatedAt).toLocaleString("pt-BR")}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
