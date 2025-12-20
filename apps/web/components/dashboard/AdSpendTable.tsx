'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type { AdSpendItem, AdSpendResponse } from "../../types/dashboard";
import { useAuth } from "../auth/AuthProvider";
import { useActiveOrg } from "../org/OrgProvider";

type FetchState =
  | { status: "idle"; items: AdSpendItem[] }
  | { status: "loading"; items: AdSpendItem[] }
  | { status: "loaded"; items: AdSpendItem[] }
  | { status: "error"; items: AdSpendItem[]; message: string };

const PLATFORM_LABELS: Record<AdSpendItem["platform"], string> = {
  meta: "Meta Ads",
  google: "Google Ads"
};

const BILLING_OPTIONS = [
  { value: "all", label: "Todos os tipos" },
  { value: "prepaid", label: "Pre-pago" },
  { value: "credit", label: "Cartao / limite" }
];

const PLATFORM_OPTIONS = [
  { value: "all", label: "Google + Meta" },
  { value: "meta", label: "Meta Ads" },
  { value: "google", label: "Google Ads" }
];

const PAGE_SIZE = 5;

const formatCurrency = (value: number | null, currency = "BRL"): string => {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  });
};

export function AdSpendTable(): JSX.Element {
  const { token, status } = useAuth();
  const { activeOrgId } = useActiveOrg();
  const [state, setState] = useState<FetchState>({ status: "idle", items: [] });
  const [platformFilter, setPlatformFilter] = useState<"all" | "meta" | "google">("meta");
  const [billingFilter, setBillingFilter] = useState<"all" | "prepaid" | "credit">("prepaid");
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadData = useCallback(
    async (currentToken: string, options: { force?: boolean } = {}) => {
      setState((prev) => ({ ...prev, status: "loading" }));
      try {
        const response = await apiFetch<AdSpendResponse>("/metrics/spend-overview", {
          token: currentToken,
          query: options.force ? { force: "true" } : undefined
        });
        setState({ status: "loaded", items: response.items ?? [] });
        setLastUpdated(response.cachedAt ?? new Date().toISOString());
      } catch (error) {
        const message =
          error instanceof ApiError && error.status === 404
            ? "API de gastos ainda nao publicada. Confirme se o deploy /metrics/spend-overview esta ativo."
            : "Nao foi possivel consultar os saldos agora.";
        setState({ status: "error", items: [], message });
      }
    },
    []
  );

  useEffect(() => {
    if (!token || status !== "authenticated") {
      setState({ status: "idle", items: [] });
      setVisibleCount(PAGE_SIZE);
      setLastUpdated(null);
      return;
    }
    // Sempre força refresh ao trocar org ou usuario para evitar cache cruzado
    setState({ status: "idle", items: [] });
    setVisibleCount(PAGE_SIZE);
    setLastUpdated(null);
    loadData(token, { force: true }).catch(() => undefined);
  }, [token, status, activeOrgId, loadData]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [platformFilter, billingFilter, state.items]);

  const filteredItems = useMemo(() => {
    return state.items.filter((item) => {
      if (platformFilter !== "all" && item.platform !== platformFilter) {
        return false;
      }
      if (billingFilter === "prepaid" && !(item.platform === "meta" && item.isPrepaid)) {
        return false;
      }
      if (billingFilter === "credit" && item.platform === "meta" && item.isPrepaid) {
        return false;
      }
      return true;
    });
  }, [state.items, platformFilter, billingFilter]);

  const visibleItems = useMemo(() => filteredItems.slice(0, visibleCount), [filteredItems, visibleCount]);
  const canLoadMore = visibleItems.length < filteredItems.length;

  if (status !== "authenticated") {
    return (
      <section className="card p-6">
        <p className="text-sm text-deepGreen/70">Entre no Taskora para acompanhar saldos e gastos das contas.</p>
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Saldos e limites</p>
          <h2 className="text-xl font-semibold text-deepGreen">Panorama de investimento</h2>
          <p className="text-sm text-deepGreen/60">
            Prefira o filtro pre-pago para visualizar quais contas Meta precisam de credito.
          </p>
          {lastUpdated ? (
            <p className="text-xs text-deepGreen/50">Atualizado em {new Date(lastUpdated).toLocaleString("pt-BR")}</p>
          ) : null}
        </div>
        {state.status === "error" ? (
          <span className="text-xs font-semibold text-red-600">{state.message}</span>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (!token) return;
              loadData(token, { force: true }).catch(() => undefined);
            }}
            className="rounded-full border border-deepGreen/30 px-3 py-2 text-xs font-semibold text-deepGreen shadow-sm transition hover:border-deepGreen/60 disabled:opacity-60"
            disabled={state.status === "loading"}
          >
            {state.status === "loading" ? "Atualizando..." : "Atualizar saldos"}
          </button>
        )}
      </header>

      <div className="flex flex-wrap gap-3">
        <select
          value={platformFilter}
          onChange={(event) => setPlatformFilter(event.target.value as "all" | "meta" | "google")}
          className="rounded-full border border-deepGreen/20 px-3 py-1 text-xs font-semibold text-deepGreen shadow-sm"
        >
          {PLATFORM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          value={billingFilter}
          onChange={(event) => setBillingFilter(event.target.value as "all" | "prepaid" | "credit")}
          className="rounded-full border border-deepGreen/20 px-3 py-1 text-xs font-semibold text-deepGreen shadow-sm"
        >
          {BILLING_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {state.status === "loading" ? <p className="text-sm text-deepGreen/60">Atualizando saldos...</p> : null}

      {filteredItems.length === 0 && state.status === "loaded" ? (
        <p className="rounded-xl border border-dashed border-deepGreen/20 px-4 py-4 text-sm text-deepGreen/60">
          Nenhuma conta atende ao filtro atual.
        </p>
      ) : null}

      {filteredItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-deepGreen/10 text-sm text-deepGreen">
            <thead className="bg-offWhite/60 text-xs uppercase tracking-wide text-deepGreen/60">
              <tr>
                <th className="px-3 py-2 text-left">Cliente</th>
                <th className="px-3 py-2 text-left">Plataforma</th>
                <th className="px-3 py-2 text-left">Conta</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-right">Saldo / Limite</th>
                <th className="px-3 py-2 text-right">Gasto medio diario</th>
                <th className="px-3 py-2 text-right">Gasto no mes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-deepGreen/10">
              {visibleItems.map((item) => {
                const typeLabel =
                  item.platform === "meta" ? (item.isPrepaid ? "Pre-pago" : "Cartao / limite") : "Cartao / limite";
                return (
                  <tr key={`${item.platform}-${item.accountId}`}>
                    <td className="px-3 py-3 font-semibold">
                      {item.clientName}
                      <p className="text-xs text-deepGreen/60">{item.clientId ?? "Sem vinculo"}</p>
                    </td>
                    <td className="px-3 py-3 text-deepGreen/70">{PLATFORM_LABELS[item.platform]}</td>
                    <td className="px-3 py-3 text-deepGreen/70">
                      <span className="block">{item.accountName ?? item.accountId}</span>
                      <span className="text-xs text-deepGreen/50">{item.accountId}</span>
                    </td>
                    <td className="px-3 py-3 text-deepGreen/70">{typeLabel}</td>
                    <td className="px-3 py-3 text-right">
                      {item.platform === "meta" && item.isPrepaid
                        ? formatCurrency(item.balanceAvailable, item.currency ?? "BRL")
                        : formatCurrency(item.creditLimit, item.currency ?? "BRL")}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(item.averageDailySpend, item.currency ?? "BRL")}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatCurrency(item.monthToDateSpend, item.currency ?? "BRL")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t border-deepGreen/10 px-2 py-3 text-xs text-deepGreen/60">
            <span>Mostrando {visibleItems.length} de {filteredItems.length} contas</span>
            {canLoadMore ? (
              <button
                type="button"
                className="rounded-full border border-deepGreen/30 px-3 py-1 text-[11px] font-semibold text-deepGreen hover:border-deepGreen/60"
                onClick={() => setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredItems.length))}
              >
                Carregar mais
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
