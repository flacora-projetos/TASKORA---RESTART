'use client';

import { useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type { DirectoryClientSummary, DirectorySearchResponse } from "../../types/clients";

type DirectoryClientMenuProps = {
  token: string;
  onSelect: (entry: DirectoryClientSummary) => void;
  title?: string;
  description?: string;
  limit?: number;
  actionLabel?: string;
  disabled?: boolean;
  busyLabel?: string;
  showReference?: boolean;
};

type MenuState =
  | { status: "idle"; items: DirectoryClientSummary[] }
  | { status: "loading"; items: DirectoryClientSummary[] }
  | { status: "loaded"; items: DirectoryClientSummary[] }
  | { status: "error"; items: DirectoryClientSummary[]; message: string };

type CacheInfo = { lastSyncedAt: string | null; stale: boolean } | null;

function formatDate(value: string | null): string {
  if (!value) {
    return "Sem histórico";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sem histórico";
  }
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function MetadataBadges({ entry }: { entry: DirectoryClientSummary }) {
  const google = entry.metadata?.googleCustomerIds ?? [];
  const meta = entry.metadata?.metaAccountIds ?? [];
  const ga4 = entry.metadata?.ga4PropertyIds ?? [];
  if (!google.length && !meta.length && !ga4.length) {
    return null;
  }
  return (
    <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-deepGreen/60">
      {google.length ? <span>Google: {google.join(", ")}</span> : null}
      {meta.length ? <span>Meta: {meta.join(", ")}</span> : null}
      {ga4.length ? <span>GA4: {ga4.join(", ")}</span> : null}
    </div>
  );
}

export function DirectoryClientMenu({
  token,
  onSelect,
  title = "Buscar no cadastro oficial",
  description = "Digite o nome do cliente e clique em Conectar. O Taskora cuida dos IDs automaticamente.",
  limit = 10,
  actionLabel = "Conectar",
  disabled = false,
  busyLabel = "Conectando...",
  showReference = false
}: DirectoryClientMenuProps): JSX.Element | null {
  const [searchTerm, setSearchTerm] = useState("");
  const [state, setState] = useState<MenuState>({ status: "idle", items: [] });
  const [cacheInfo, setCacheInfo] = useState<CacheInfo>(null);

  const cacheLabel = useMemo(() => {
    if (!cacheInfo) {
      return null;
    }
    return cacheInfo.stale ? `Dados do cache (${formatDate(cacheInfo.lastSyncedAt)})` : `Atualizado em ${formatDate(cacheInfo.lastSyncedAt)}`;
  }, [cacheInfo]);

  if (!token) {
    return null;
  }

  const loadOptions = async () => {
    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const response = await apiFetch<DirectorySearchResponse>("/integrations/directory/clients", {
        token,
        query: {
          q: searchTerm.trim() || undefined,
          limit
        }
      });
      setState({ status: "loaded", items: response.items });
      if (response.cache) {
        setCacheInfo({
          lastSyncedAt: response.cache.lastSyncedAt,
          stale: response.cache.stale
        });
      } else {
        setCacheInfo(null);
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Falha ao consultar o diretório.";
      setState({ status: "error", items: [], message });
      setCacheInfo(null);
    }
  };

  return (
    <div className="rounded-2xl border border-deepGreen/10 bg-offWhite/40 p-4 text-sm text-deepGreen/80">
      <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">{title}</p>
          <p className="text-xs text-deepGreen/60">{description}</p>
          {cacheLabel ? <p className="text-[11px] text-deepGreen/50">{cacheLabel}</p> : null}
        </div>
        {cacheInfo?.stale ? (
          <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800">Atualize em breve</span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="flex-1 rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
          placeholder="Nome, segmento ou plataforma"
        />
        <button
          type="button"
          onClick={() => void loadOptions()}
          className="rounded-full border border-deepGreen/20 px-4 py-2 text-xs font-semibold text-deepGreen hover:border-deepGreen/50"
        >
          {state.status === "loading" ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {state.status === "error" ? <p className="mt-2 text-xs text-red-600">{state.message}</p> : null}
      {state.status === "loaded" && state.items.length === 0 ? (
        <p className="mt-3 text-xs text-deepGreen/60">Nenhum resultado para este filtro.</p>
      ) : null}
      {state.items.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {state.items.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-deepGreen/15 bg-white px-3 py-2"
            >
              <div>
                <p className="text-sm font-semibold text-deepGreen">{entry.name}</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-deepGreen/50">{entry.platform}</p>
                {entry.accountId ? <p className="text-[11px] text-deepGreen/60">Conta: {entry.accountId}</p> : null}
                {showReference ? (
                  <p className="text-[11px] text-deepGreen/60">Registro interno: {entry.id}</p>
                ) : null}
                <MetadataBadges entry={entry} />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (disabled) {
                    return;
                  }
                  onSelect(entry);
                }}
                disabled={disabled}
                className="rounded-full border border-terracota px-3 py-1 text-xs font-semibold text-terracota transition hover:bg-terracota/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {disabled ? busyLabel : actionLabel}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
