'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type { Client, DirectoryClientSummary } from "../../types/clients";
import { useAuth } from "../auth/AuthProvider";
import { DirectoryClientMenu } from "../integrations/DirectoryClientMenu";

type FetchState =
  | { status: "idle"; items: Client[] }
  | { status: "loading"; items: Client[] }
  | { status: "loaded"; items: Client[] }
  | { status: "error"; items: Client[]; message: string };

type LinkState =
  | { status: "idle" }
  | { status: "loading"; clientId: string }
  | { status: "success"; clientId: string; label?: string }
  | { status: "error"; message: string; clientId: string };

export function ClientListCard(): JSX.Element {
  const { token, status: authStatus } = useAuth();
  const [state, setState] = useState<FetchState>({ status: "idle", items: [] });
  const [linkState, setLinkState] = useState<LinkState>({ status: "idle" });

  const reload = async (currentToken: string) => {
    setState((prev) => ({ ...prev, status: "loading" }));
    const response = await apiFetch<{ items: Client[] }>("/clients", {
      token: currentToken
    });
    setState({ status: "loaded", items: response.items });
  };

  useEffect(() => {
    if (!token || authStatus !== "authenticated") {
      setState({ status: "idle", items: [] });
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        await reload(token);
      } catch (error) {
        if (!isMounted) {
          return;
        }
        const message = error instanceof ApiError ? error.message : "Não foi possivel carregar os clientes.";
        setState({ status: "error", items: [], message });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [token, authStatus]);

  const integrationSummary = useMemo(() => {
    if (state.items.length === 0) {
      return { linked: 0, total: 0 };
    }
    const linked = state.items.filter((client) => Boolean(client.integrations?.directoryId)).length;
    return { linked, total: state.items.length };
  }, [state.items]);

  const recentClients = useMemo(() => state.items.slice(0, 5), [state.items]);

  const handleLink = async (clientId: string, entry: DirectoryClientSummary) => {
    if (!token) {
      return;
    }

    setLinkState({ status: "loading", clientId });
    try {
      await apiFetch(`/clients/${clientId}/integrations/link-directory`, {
        token,
        method: "POST",
        body: { directoryClientId: entry.id }
      });
      await reload(token);
      setLinkState({ status: "success", clientId, label: entry.name });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Falha ao vincular diretório.";
      setLinkState({ status: "error", message, clientId });
    }
  };

  const isLoading = state.status === "loading";
  const showEmpty = state.status === "loaded" && state.items.length === 0;
  const showError = state.status === "error";

  return (
    <section className="card p-6 space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Clientes em operação</p>
          <h2 className="text-xl font-semibold text-deepGreen">Veja quem ja esta pronto e quem ainda falta</h2>
          <p className="text-sm text-deepGreen/70">
            Use esta lista para identificar rapidamente o status de cada conta e abra a ficha completa em um unico clique.
          </p>
        </div>
        {state.items.length ? (
          <span className="rounded-full border border-deepGreen/15 px-3 py-1 text-xs font-semibold text-deepGreen/70">
            {integrationSummary.linked}/{integrationSummary.total} com integrações concluidas
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/clients"
          className="rounded-full border border-deepGreen/20 px-4 py-1 text-xs font-semibold text-deepGreen hover:border-deepGreen/40"
        >
          Abrir módulo completo
        </Link>
        <Link
          href="/clients#client-form"
          className="rounded-full bg-deepGreen px-4 py-1 text-xs font-semibold text-offWhite shadow-sm hover:bg-deepGreen/90"
        >
          + Cliente
        </Link>
      </div>
      {isLoading ? <p className="text-sm text-deepGreen/60">Atualizando lista...</p> : null}

      {showError && "message" in state ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.message}</p>
      ) : null}

      {showEmpty ? (
        <p className="text-sm text-deepGreen/60">
          Nenhum cliente encontrado neste filtro. Ajuste o status acima ou cadastre um novo em{" "}
          <a href="/clients" className="font-semibold text-terracota underline-offset-4 hover:underline">
            /clients
          </a>
          .
        </p>
      ) : null}

      {recentClients.length > 0 ? (
        <ul className="space-y-3">
          {recentClients.map((client) => (
            <li key={client.id} className="rounded-xl border border-deepGreen/10 bg-white p-4 text-sm shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/clients/${client.id}`}
                    className="font-semibold text-deepGreen underline-offset-2 hover:underline"
                  >
                    {client.name}
                  </Link>
                  <p className="text-xs text-deepGreen/60">{client.segment ?? "Segmento não informado"}</p>
                  <IntegrationBadges client={client} />
                </div>
                <div className="text-right text-xs text-deepGreen/60">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      client.status === "active" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-700 border border-slate-200"
                    }`}
                  >
                    {client.status === "active" ? "Ativo" : "Arquivado"}
                  </span>
                  <p className="mt-1">
                    Atualizado em{" "}
                    {new Date(client.updatedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short"
                    })}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-xs text-deepGreen/60">
                Timeline e relatórios ja estao ativos em{" "}
                <Link href={`/clients/${client.id}`} className="font-semibold text-terracota underline-offset-2 hover:underline">
                  /clients/{client.id}
                </Link>
                .
              </p>

              <div className="mt-3 space-y-2">
                <p className="text-xs text-deepGreen/70">
                  {client.integrations?.directoryId
                    ? `Conectado ao cadastro ${client.integrations.directoryId}. Se precisar trocar, busque novamente.`
                    : "Conecte ao cadastro oficial para liberar as métricas automaticamente."}
                </p>
                <DirectoryClientMenu
                  token={token ?? ""}
                  onSelect={(entry) => void handleLink(client.id, entry)}
                  title="Conectar ao cadastro oficial"
                  description="Busque pelo nome e clique em Conectar; os detalhes tecnicos sao preenchidos automaticamente."
                  actionLabel="Conectar"
                  busyLabel="Conectando..."
                  disabled={linkState.status === "loading" && linkState.clientId === client.id}
                />
                {linkState.status === "success" && linkState.clientId === client.id ? (
                  <p className="text-xs text-emerald-700">
                    {linkState.label ? `${linkState.label} sincronizado.` : "Cadastro conectado."}
                  </p>
                ) : null}
                {linkState.status === "error" && linkState.clientId === client.id ? (
                  <p className="text-xs text-red-600">{linkState.message}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function IntegrationBadges({ client }: { client: Client }) {
  const info = client.integrations;
  const googleIds = client.googleCustomerIds ?? [];
  const metaIds = client.metaAccountIds ?? [];
  const ga4Ids = client.ga4PropertyIds ?? [];
  const pinterestIds = client.pinterestAccountIds ?? [];
  const items = [
    {
      label: "Diretório",
      connected: Boolean(info?.directoryId)
    },
    {
      label: "Google",
      connected: googleIds.length > 0
    },
    {
      label: "Meta",
      connected: metaIds.length > 0
    },
    {
      label: "GA4",
      connected: ga4Ids.length > 0
    },
    {
      label: "Pinterest",
      connected: pinterestIds.length > 0
    }
  ];

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            item.connected ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-700 border border-slate-200"
          }`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}
