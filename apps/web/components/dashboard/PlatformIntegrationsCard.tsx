'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type { Client } from "../../types/clients";
import { useAuth } from "../auth/AuthProvider";

type ClientListResponse = {
  items: Client[];
};

type FetchState =
  | { status: "idle"; items: Client[] }
  | { status: "loading"; items: Client[] }
  | { status: "loaded"; items: Client[] }
  | { status: "error"; items: Client[]; message: string };

type ClientIdFields = Pick<Client, "googleCustomerIds" | "metaAccountIds" | "ga4PropertyIds" | "pinterestAccountIds">;
type PlatformKey = "google" | "meta" | "ga4" | "pinterest";

const PLATFORM_CONFIG: Array<{
  key: PlatformKey;
  label: string;
  field: keyof ClientIdFields;
}> = [
  { key: "google", label: "Google Ads", field: "googleCustomerIds" },
  { key: "meta", label: "Meta Ads", field: "metaAccountIds" },
  { key: "ga4", label: "GA4", field: "ga4PropertyIds" },
  { key: "pinterest", label: "Pinterest Ads", field: "pinterestAccountIds" }
];

type PendingClient = {
  id: string;
  name: string;
};

type PlatformStatus = {
  platform: PlatformKey;
  label: string;
  total: number;
  connected: number;
  missingClients: PendingClient[];
  remainingMissing: number;
};

const MAX_WARNINGS = 3;

type PlatformIntegrationsCardProps = {
  variant?: "default" | "compact";
};

export function PlatformIntegrationsCard({ variant = "default" }: PlatformIntegrationsCardProps): JSX.Element {
  const { token, status } = useAuth();
  const [state, setState] = useState<FetchState>({ status: "idle", items: [] });
  const isCompact = variant === "compact";

  const isAuthenticated = status === "authenticated" && Boolean(token);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setState({ status: "idle", items: [] });
      return;
    }

    let isMounted = true;
    setState((prev) => ({ ...prev, status: "loading" }));

    apiFetch<ClientListResponse>("/clients", { token })
      .then((response) => {
        if (!isMounted) {
          return;
        }
        setState({ status: "loaded", items: response.items });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        const message = error instanceof ApiError ? error.message : "Falha ao carregar integracoes.";
        setState({ status: "error", items: [], message });
      });

    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated]);

  const platformStatuses = useMemo<PlatformStatus[]>(() => {
    if (!state.items.length) {
      return PLATFORM_CONFIG.map((platform) => ({
        platform: platform.key,
        label: platform.label,
        total: 0,
        connected: 0,
        missingClients: [],
        remainingMissing: 0
      }));
    }

    return PLATFORM_CONFIG.map((platform) => {
      const missingClients: PendingClient[] = [];
      let connected = 0;

      state.items.forEach((client) => {
        const values = Array.isArray(client[platform.field])
          ? (client[platform.field] as string[])
          : [];

        if (values && values.length > 0) {
          connected += 1;
        } else if (missingClients.length < MAX_WARNINGS) {
          missingClients.push({ id: client.id, name: client.name });
        }
      });

      return {
        platform: platform.key,
        label: platform.label,
        total: state.items.length,
        connected,
        missingClients,
        remainingMissing: Math.max(state.items.length - connected - missingClients.length, 0)
      };
    });
  }, [state.items]);

  const showEmptyState = isAuthenticated && state.status === "loaded" && state.items.length === 0;

  return (
    <section
      className={
        isCompact
          ? "rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-4 space-y-3"
          : "card space-y-4 p-6"
      }
    >
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Integracoes</p>
        <h2 className={isCompact ? "text-base font-semibold text-deepGreen" : "text-xl font-semibold text-deepGreen"}>
          Google / Meta / GA4 / Pinterest por cliente
        </h2>
        <p className={isCompact ? "text-xs text-deepGreen/60" : "text-sm text-deepGreen/60"}>
          Acompanhe quantos clientes ja estao com cada plataforma conectada e onde ainda faltam IDs.
        </p>
      </header>

      {!isAuthenticated ? (
        <p className="rounded-lg border border-dashed border-deepGreen/20 px-4 py-3 text-sm text-deepGreen/60">
          Faca login para visualizar o status das integracoes.
        </p>
      ) : null}

      {state.status === "error" ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.message}</p>
      ) : null}

      {state.status === "loading" ? (
        <p className="text-sm text-deepGreen/60">Carregando integracoes...</p>
      ) : null}

      {showEmptyState ? (
        <p className="rounded-lg border border-dashed border-deepGreen/20 px-4 py-3 text-sm text-deepGreen/60">
          Nenhum cliente cadastrado ainda. Assim que cadastrar, este painel mostrara o status de cada plataforma.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        {platformStatuses.map((platform) => (
          <PlatformStatusCard key={platform.platform} status={platform} />
        ))}
      </div>
    </section>
  );
}

type PlatformStatusCardProps = {
  status: PlatformStatus;
};

function PlatformStatusCard({ status }: PlatformStatusCardProps): JSX.Element {
  const coverage = status.total > 0 ? Math.round((status.connected / status.total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-deepGreen/15 bg-white/95 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-deepGreen">{status.label}</p>
        <span className="text-xs font-semibold text-deepGreen/60">
          {status.connected}/{status.total}
        </span>
      </div>

      <div className="mt-3 h-2 rounded-full bg-deepGreen/10">
        <div className="h-2 rounded-full bg-terracota transition-all" style={{ width: `${coverage}%` }} />
      </div>

      <p className="mt-2 text-xs text-deepGreen/60">Cobertura: {coverage}%</p>

      {status.missingClients.length ? (
        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">Pendentes</p>
          <ul className="mt-1 space-y-1 text-xs text-amber-900">
            {status.missingClients.map((client) => (
              <li key={client.id}>
                -{" "}
                <Link
                  href={`/clients/${client.id}`}
                  className="font-semibold text-amber-900 underline-offset-2 hover:underline"
                >
                  {client.name}
                </Link>
              </li>
            ))}
          </ul>
          {status.remainingMissing > 0 ? (
            <p className="mt-2 text-[11px] text-amber-900/80">+{status.remainingMissing} outros</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-emerald-700">Todos os clientes possuem IDs configurados.</p>
      )}
    </div>
  );
}
