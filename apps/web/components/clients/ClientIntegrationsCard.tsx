'use client';

import { useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type { Client, DirectoryClientSummary } from "../../types/clients";
import { DirectoryClientMenu } from "../integrations/DirectoryClientMenu";

type Props = {
  client: Client;
  token: string;
  onLinked: () => Promise<void>;
  sectionId?: string;
};

const PLACEHOLDERS: Record<"google" | "meta" | "ga4" | "pinterest", string> = {
  google: "Informe IDs no formato 123-456-7890",
  meta: "Use o formato act_1234567890",
  ga4: "Ex.: properties/123456789",
  pinterest: "Ex.: 549769130861"
};

type PinterestStartResponse = {
  authorizationUrl: string;
  state: string;
  expiresAt: string;
};

export function ClientIntegrationsCard({ client, token, onLinked, sectionId }: Props): JSX.Element {
  const [isLinking, setIsLinking] = useState(false);
  const [isPinterestStarting, setIsPinterestStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const integration = client.integrations;
  const directoryName =
    (typeof integration?.directorySnapshot?.clientName === "string"
      ? (integration?.directorySnapshot?.clientName as string)
      : integration?.directoryId) ?? "-";

  const identifiers: Array<{ key: keyof typeof PLACEHOLDERS; label: string; values: string[] }> = [
    { key: "google", label: "Google Ads", values: client.googleCustomerIds },
    { key: "meta", label: "Meta Ads", values: client.metaAccountIds },
    { key: "ga4", label: "GA4", values: client.ga4PropertyIds },
    { key: "pinterest", label: "Pinterest Ads", values: client.pinterestAccountIds }
  ];

  const linkWithDirectory = async (directoryClientId: string, entryName?: string) => {
    if (!directoryClientId) {
      setMessage("Escolha um cadastro antes de salvar.");
      return;
    }

    setIsLinking(true);
    setMessage(entryName ? `Conectando ${entryName}...` : "Conectando cliente...");

    try {
      await apiFetch(`/clients/${client.id}/integrations/link-directory`, {
        token,
        method: "POST",
        body: { directoryClientId }
      });
      setMessage(entryName ? `${entryName} conectado ao Taskora.` : "Cliente sincronizado com o cadastro oficial.");
      await onLinked();
    } catch (error) {
      setMessage(error instanceof ApiError ? error.message : "Não foi possível concluir a conexão.");
    } finally {
      setIsLinking(false);
    }
  };

  const handlePinterestConnect = async () => {
    if (!token) {
      setMessage("Token de autenticação ausente. Faça login novamente.");
      return;
    }
    if (typeof window === "undefined") {
      setMessage("Este navegador não suporta redirecionamento automático.");
      return;
    }

    const redirectUri = `${window.location.origin}/integrations/pinterest/callback`;
    setIsPinterestStarting(true);
    setMessage("Abrindo Pinterest para autorização...");

    try {
      const response = await apiFetch<PinterestStartResponse>(`/clients/${client.id}/integrations/pinterest/start`, {
        token,
        method: "POST",
        body: { redirectUri }
      });
      window.location.href = response.authorizationUrl;
    } catch (error) {
      setIsPinterestStarting(false);
      setMessage(error instanceof ApiError ? error.message : "Não foi possível iniciar o Pinterest.");
    }
  };

  const pinterestIntegration = integration?.pinterest ?? null;
  const pinterestLinkedLabel = pinterestIntegration?.linkedAt
    ? new Date(pinterestIntegration.linkedAt).toLocaleString("pt-BR")
    : null;
  const pinterestExpiresLabel = pinterestIntegration?.expiresAt
    ? new Date(pinterestIntegration.expiresAt).toLocaleString("pt-BR")
    : null;

  return (
    <section id={sectionId} className="rounded-2xl border border-deepGreen/15 bg-white/90 p-6 space-y-4">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Identidade do cliente</p>
        <h2 className="text-xl font-semibold text-deepGreen">Cadastro oficial</h2>
        <p className="text-sm text-deepGreen/60">
          Escolha o registro certo no buscador. Os IDs são salvos no cadastro do Taskora e usados em todos os cards e
          relatórios.
        </p>
      </header>

      {integration ? (
        <div className="rounded-lg border border-deepGreen/10 bg-offWhite px-4 py-3 text-sm text-deepGreen/70 space-y-1">
          <p>
            <span className="font-semibold text-deepGreen">Nome no diretório:</span> {directoryName}
          </p>
          <p>
            <span className="font-semibold text-deepGreen">Cadastro conectado:</span> {integration?.directoryId ?? "-"}
          </p>
          <p>
            <span className="font-semibold text-deepGreen">Última sincronização:</span>{" "}
            {integration.syncedAt ? new Date(integration.syncedAt).toLocaleString("pt-BR") : "-"}
          </p>
          {integration.directoryId ? (
            <button
              type="button"
              className="mt-2 inline-flex items-center rounded-full border border-deepGreen/20 px-3 py-1 text-[11px] font-semibold text-deepGreen hover:border-deepGreen/50"
              onClick={() => void linkWithDirectory(integration.directoryId!, integration.directorySnapshot?.clientName as string | undefined)}
              disabled={isLinking}
            >
              Atualizar IDs
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-deepGreen/60">
          Nenhum cadastro oficial conectado ainda. Conecte para liberar as métricas automáticas.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        {identifiers.map((item) => (
          <div key={item.key} className="rounded-xl border border-deepGreen/10 bg-offWhite/60 px-3 py-2 text-xs text-deepGreen/80">
            <p className="text-[11px] uppercase tracking-[0.2em] text-deepGreen/50">{item.label}</p>
            <p className="mt-1 text-sm text-deepGreen">
              {item.values.length ? item.values.join(", ") : PLACEHOLDERS[item.key]}
            </p>
          </div>
        ))}
      </div>

      {client.platforms.includes("pinterest") ? (
        <div className="rounded-2xl border border-pink-100 bg-pink-50/70 p-4 text-sm text-deepGreen">
          <div className="flex flex-col gap-1">
            <p className="text-xs uppercase tracking-[0.3em] text-pink-600/70">Pinterest Ads</p>
            {pinterestIntegration ? (
              <>
                <p className="text-base font-semibold text-pink-700">Conta autorizada</p>
                <p className="text-sm text-pink-800/80">
                  Conectado em {pinterestLinkedLabel ?? "data não disponível"}.
                  {pinterestExpiresLabel ? ` Expira em ${pinterestExpiresLabel}.` : ""}
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center rounded-full border border-pink-200 px-3 py-1 text-[11px] font-semibold text-pink-800 hover:border-pink-400 disabled:cursor-not-allowed disabled:border-pink-100 disabled:text-pink-400"
                  onClick={() => void handlePinterestConnect()}
                  disabled={isPinterestStarting}
                >
                  {isPinterestStarting ? "Atualizando..." : "Atualizar permissão"}
                </button>
              </>
            ) : (
              <>
                <p className="text-base font-semibold text-pink-700">Liberar MCP Pinterest</p>
                <p className="text-sm text-pink-800/80">
                  Autorize o Pinterest Ads para que o agente MCP consulte campanhas e métricas automaticamente.
                </p>
                <button
                  type="button"
                  className="mt-2 inline-flex items-center rounded-full border border-pink-300 bg-white px-4 py-1 text-[12px] font-semibold text-pink-700 hover:border-pink-400 disabled:cursor-not-allowed disabled:border-pink-100 disabled:text-pink-300"
                  onClick={() => void handlePinterestConnect()}
                  disabled={isPinterestStarting}
                >
                  {isPinterestStarting ? "Redirecionando..." : "Conectar Pinterest"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      <DirectoryClientMenu
        token={token}
        onSelect={(entry: DirectoryClientSummary) => void linkWithDirectory(entry.id, entry.name)}
        actionLabel="Conectar"
        busyLabel="Conectando..."
        disabled={isLinking}
        showReference
      />

      {message ? <p className="text-xs text-deepGreen/70">{message}</p> : null}
    </section>
  );
}
