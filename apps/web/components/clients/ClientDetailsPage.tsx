'use client';

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ClientAssistBanner } from "./ClientAssistBanner";
import { ClientFormState, createFormStateFromClient, buildClientPayload } from "./ClientForm";
import { ClientFormModal } from "./ClientFormModal";
import { ClientIntegrationsCard } from "./ClientIntegrationsCard";
import { ClientMetricsCard } from "./ClientMetricsCard";
import { ClientProjectsCard } from "./ClientProjectsCard";
import { ClientReportExporter } from "./ClientReportExporter";
import { ClientTimelineCard } from "./ClientTimelineCard";
import { InstagramInsightsTab } from "./InstagramInsightsTab";
import { InstagramLoginModal } from "./InstagramLoginModal";
import { apiFetch, ApiError } from "../../lib/api";
import { getActiveOrgId } from "../../lib/org";
import type { Client, ClientPlatform } from "../../types/clients";
import type { TeamMember } from "../../types/team";
import { useAuth } from "../auth/AuthProvider";

type Props = {
  clientId: string;
};

type ClientState =
  | { status: "idle"; data: Client | null }
  | { status: "loading"; data: Client | null }
  | { status: "loaded"; data: Client }
  | { status: "error"; data: Client | null; message: string };

const CLIENT_TABS = [
  { id: "overview", label: "Visao geral" },
  { id: "projects", label: "Projetos & Tarefas" },
  { id: "instagram", label: "Instagram Insights" },
  { id: "settings", label: "Configuracoes" }
] as const;

type ClientTabId = (typeof CLIENT_TABS)[number]["id"];

export function ClientDetailsPage({ clientId }: Props): JSX.Element {
  const { token, status: authStatus, user } = useAuth();
  const [state, setState] = useState<ClientState>({ status: "idle", data: null });
  const [formState, setFormState] = useState<ClientFormState>(createFormStateFromClient());
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [activeTab, setActiveTab] = useState<ClientTabId>("overview");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isInstagramModalOpen, setIsInstagramModalOpen] = useState(false);
  const [isStartingInstagram, setIsStartingInstagram] = useState(false);
  const [instagramError, setInstagramError] = useState<string | null>(null);

  const isAuthenticated = authStatus === "authenticated" && Boolean(token);
  const isAdmin = user?.isAdmin === true;
  const visibleTabs = CLIENT_TABS.filter((tab) => (tab.id === "settings" ? isAdmin : true));

  const loadClient = useCallback(
    async (currentToken: string) => {
      setState((prev) => ({ ...prev, status: "loading" }));
      const client = await apiFetch<Client>(`/clients/${clientId}`, {
        token: currentToken
      });
      setState({ status: "loaded", data: client });
      return client;
    },
    [clientId]
  );

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setState({ status: "idle", data: null });
      return;
    }
    loadClient(token).catch((error) => {
      const message = error instanceof ApiError ? error.message : "Não foi possível carregar o cliente.";
      setState({ status: "error", data: null, message });
    });
  }, [token, isAuthenticated, clientId, loadClient]);

  const loadTeamMembers = useCallback(
    async (currentToken: string) => {
      const response = await apiFetch<{ items: TeamMember[] }>("/team/members", {
        token: currentToken,
        query: { status: "active" }
      });
      setTeamMembers(response.items);
    },
    []
  );

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setTeamMembers([]);
      return;
    }
    loadTeamMembers(token).catch(() => {
      setTeamMembers([]);
    });
  }, [token, isAuthenticated, loadTeamMembers]);

  useEffect(() => {
    if (!isAdmin && activeTab === "settings") {
      setActiveTab("overview");
    }
  }, [activeTab, isAdmin]);

  const handleFormChange = (field: keyof ClientFormState, value: string | string[] | null) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value ?? ""
    }));
  };

  const handlePlatformToggle = (platform: ClientPlatform) => {
    setFormState((prev) => {
      const exists = prev.platforms.includes(platform);
      return {
        ...prev,
        platforms: exists ? prev.platforms.filter((item) => item !== platform) : [...prev.platforms, platform]
      };
    });
  };

  if (!isAuthenticated || !token) {
    return (
      <section className="rounded-2xl border border-deepGreen/15 bg-white/90 p-6">
        <h2 className="text-xl font-semibold text-deepGreen">Cliente</h2>
        <p className="text-sm text-deepGreen/70">Faça login para visualizar os detalhes.</p>
      </section>
    );
  }

  if (state.status === "loading" || state.status === "idle") {
    return <p className="text-sm text-deepGreen/70">Carregando cliente...</p>;
  }

  if (state.status === "error") {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {state.message}
      </section>
    );
  }

  const client = state.data;
  const identifierItems = [
    {
      label: "Google Ads",
      values: client.googleCustomerIds,
      placeholder: "Nenhum ID cadastrado"
    },
    {
      label: "Meta Ads",
      values: client.metaAccountIds,
      placeholder: "Nenhum ID cadastrado"
    },
    {
      label: "GA4",
      values: client.ga4PropertyIds,
      placeholder: "Nenhuma propriedade cadastrada"
    },
    {
      label: "Pinterest Ads",
      values: client.pinterestAccountIds,
      placeholder: "Nenhum ID cadastrado"
    }
  ];

  const highlightCards = [
    {
      label: "Status atual",
      value: client.status === "active" ? "Ativo" : "Arquivado",
      badgeClass:
        client.status === "active"
          ? "bg-emerald-50 text-emerald-800 border-emerald-100"
          : "bg-slate-100 text-slate-700 border-slate-200"
    },
    {
      label: "Segmento",
      value: client.segment || "Sem segmento informado"
    },
    {
      label: "Or?amento mensal",
      value: client.monthlyBudget
        ? client.monthlyBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
        : "Não informado"
    },
    {
      label: "Plataformas",
      value: client.platforms?.length ? client.platforms.join(", ") : "Escolha ao menos uma plataforma"
    }
  ];

  const idBadges = [
    { label: "Google Ads", ready: client.googleCustomerIds.length, colorReady: "text-emerald-700" },
    { label: "Meta Ads", ready: client.metaAccountIds.length, colorReady: "text-emerald-700" },
    { label: "GA4", ready: client.ga4PropertyIds.length, colorReady: "text-emerald-700" },
    { label: "Pinterest Ads", ready: client.pinterestAccountIds.length, colorReady: "text-emerald-700" }
  ];

  const openEditModal = () => {
    setFormState(createFormStateFromClient(client));
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const closeEditModal = (reference?: Client) => {
    setIsFormModalOpen(false);
    setFormError(null);
    setIsSaving(false);
    setFormState(createFormStateFromClient(reference ?? client));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !isAuthenticated) {
      return;
    }
    if (!formState.name.trim() || !formState.id) {
      setFormError("Informe o nome do cliente.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const payload = buildClientPayload(formState);

    try {
      await apiFetch(`/clients/${formState.id}`, {
        token,
        method: "PUT",
        body: payload
      });
      const updated = await loadClient(token);
      closeEditModal(updated);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Falha ao salvar cliente.";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchiveClient = async () => {
    if (!token || !isAuthenticated) {
      return;
    }
    if (!window.confirm(`Arquivar ${client.name}?`)) {
      return;
    }
    try {
      setIsArchiving(true);
      await apiFetch(`/clients/${client.id}`, {
        token,
        method: "DELETE"
      });
      const updated = await loadClient(token);
      closeEditModal(updated);
    } catch (error) {
      alert(error instanceof ApiError ? error.message : "Falha ao arquivar cliente.");
    } finally {
      setIsArchiving(false);
    }
  };

  const archiveDisabled = client.status === "archived" || isArchiving;
  const archiveButtonLabel =
    client.status === "archived" ? "Cliente arquivado" : isArchiving ? "Arquivando..." : "Arquivar";

  const overviewContent = (
    <div className="space-y-8">
      <ClientMetricsCard sectionId="metricas" setupHref="#cadastro-oficial" clientId={client.id} token={token} />
      <ClientReportExporter client={client} token={token} />
      <ClientTimelineCard clientId={client.id} token={token} />
    </div>
  );

  const projectsContent = (
    <div className="space-y-6">
      <section className="rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-5 text-sm text-deepGreen">
        <h3 className="text-base font-semibold text-deepGreen">Projetos em andamento</h3>
        <p className="mt-1 text-deepGreen/70">
          Use o módulo abaixo para acompanhar as iniciativas do cliente. Para abrir o pipeline completo ou visualizar o
          calendário geral, utilize os atalhos.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href={`/projects?clientId=${client.id}`}
            className="rounded-full border border-deepGreen/20 px-4 py-1 text-xs font-semibold text-deepGreen hover:border-deepGreen/40"
          >
            Abrir lista de projetos
          </Link>
          <Link
            href="/calendar"
            className="rounded-full border border-deepGreen/20 px-4 py-1 text-xs font-semibold text-deepGreen hover:border-deepGreen/40"
          >
            Ver calendário semanal
          </Link>
        </div>
      </section>
      <ClientProjectsCard clientId={client.id} />
    </div>
  );

  const settingsContent = (
    <div className="space-y-6">
      <section id="client-info" className="rounded-2xl border border-deepGreen/15 bg-white/95 p-6">
        <h3 className="text-base font-semibold text-deepGreen">Cadastro do cliente</h3>
        <p className="text-sm text-deepGreen/60">Dados básicos usados nos relatórios e integrações.</p>
        <dl className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Segmento</dt>
            <dd className="text-sm text-deepGreen">{client.segment || "Sem segmento informado"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Plataformas</dt>
            <dd className="text-sm text-deepGreen">
              {client.platforms?.length ? client.platforms.join(", ") : "Escolha ao menos uma plataforma"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Orçamento mensal</dt>
            <dd className="text-sm text-deepGreen">
              {client.monthlyBudget
                ? client.monthlyBudget.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                : "Não informado"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Status</dt>
            <dd>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                  client.status === "active"
                    ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-100 text-slate-700"
                }`}
              >
                {client.status === "active" ? "Ativo" : "Arquivado"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Drive / Documentos</dt>
            <dd className="text-sm text-deepGreen">
              {client.driveLink ? (
                <a href={client.driveLink} target="_blank" rel="noreferrer" className="underline">
                  Abrir pasta do cliente
                </a>
              ) : (
                "Nenhum link cadastrado"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Grupo de WhatsApp</dt>
            <dd className="text-sm text-deepGreen">
              {client.whatsappGroup ? (
                <a href={client.whatsappGroup} target="_blank" rel="noreferrer" className="underline">
                  Acessar conversa
                </a>
              ) : (
                "Nenhum link cadastrado"
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-6">
          <h4 className="text-sm font-semibold text-deepGreen">IDs conectados</h4>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {identifierItems.map((item) => (
              <div key={item.label} className="rounded-xl border border-deepGreen/20 bg-offWhite/80 px-3 py-2 text-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-deepGreen/60">{item.label}</p>
                <p className="mt-1 text-deepGreen">{item.values.length ? item.values.join(", ") : item.placeholder}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <ClientIntegrationsCard
        sectionId="cadastro-oficial"
        client={client}
        token={token}
        onLinked={async () => {
          if (!token) return;
          await loadClient(token);
        }}
      />
      <ClientAssistBanner client={client} />
    </div>
  );

  const instagramContent = <InstagramInsightsTab onOpenLogin={() => setIsInstagramModalOpen(true)} />;

  const renderTabContent = () => {
    switch (activeTab) {
      case "projects":
        return projectsContent;
      case "instagram":
        return instagramContent;
      case "settings":
        return isAdmin ? settingsContent : overviewContent;
      default:
        return overviewContent;
    }
  };

  const handleStartInstagramAuth = async () => {
    setInstagramError(null);
    setIsStartingInstagram(true);
    try {
      const orgId = getActiveOrgId();
      const state = `org=${orgId ?? "none"};client=${client.id}`;
      const appId = process.env.NEXT_PUBLIC_IG_APP_ID ?? "1181517340574625";
      const redirectUri =
        process.env.NEXT_PUBLIC_IG_REDIRECT_URI ??
        "https://instagram-integration-770338558500.us-central1.run.app/auth/instagram/callback";
      const scopes = "instagram_basic instagram_business_basic instagram_business_manage_insights";
      const fallbackAuthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${encodeURIComponent(state)}`;

      const baseUrl =
        process.env.NEXT_PUBLIC_INSTAGRAM_AUTH_BASE_URL ??
        "https://instagram-integration-770338558500.us-central1.run.app";
      const trimmedBase = baseUrl.replace(/\/$/, "");

      try {
        const response = await fetch(
          `${trimmedBase}/auth/instagram/start?state=${encodeURIComponent(state)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json"
            }
          }
        );
        if (!response.ok) {
          throw new Error(`Instagram auth start failed (${response.status})`);
        }
        const data = (await response.json()) as { auth_url?: string };
        if (!data.auth_url) {
          throw new Error("Instagram auth URL not returned");
        }
        const popup = window.open(data.auth_url, "_blank", "noopener,noreferrer");
        if (!popup) {
          window.location.href = data.auth_url;
        }
      } catch {
        const popup = window.open(fallbackAuthUrl, "_blank", "noopener,noreferrer");
        if (!popup) {
          window.location.href = fallbackAuthUrl;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao iniciar login do Instagram.";
      setInstagramError(message);
      setIsStartingInstagram(false);
    }
  };

  return (
    <>
      <section className="rounded-xl border border-gray-200 bg-gradient-to-br from-deepGreen to-deepGreen/80 p-8 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">Cliente</p>
            <h1 className="text-2xl font-semibold leading-snug">{client.name}</h1>
            <p className="text-sm text-white/80">
              Atualizado em {new Date(client.updatedAt ?? client.createdAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2 text-sm">
            <Link
              href="/clients"
              className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
            >
              Voltar
            </Link>
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
            >
              Editar cliente
            </button>
            <button
              type="button"
              onClick={() => void handleArchiveClient()}
              disabled={archiveDisabled}
              className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/50"
            >
              {archiveButtonLabel}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {highlightCards.map((card) => (
            <div key={card.label} className="rounded-lg border border-white/15 bg-white/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">{card.label}</p>
              {card.badgeClass ? (
                <span className={`mt-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${card.badgeClass}`}>
                  {card.value}
                </span>
              ) : (
                <p className="mt-3 text-base font-semibold text-white">{card.value}</p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {idBadges.map((badge) => (
            <span
              key={badge.label}
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                badge.ready
                  ? "border-white/60 bg-white/15 text-white"
                  : "border-white/30 bg-white/5 text-white/70"
              }`}
            >
              {badge.label}: {badge.ready ? `${badge.ready} ID(s)` : "pendente"}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
        <nav className="flex flex-wrap gap-6 border-b border-gray-200 px-6 pt-4">
          {visibleTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium transition ${
                  isActive
                    ? "border-b-2 border-terracota text-terracota"
                    : "border-b-2 border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
        <div className="px-6 py-6">{renderTabContent()}</div>
      </section>

      <ClientFormModal
        isOpen={isFormModalOpen}
        onClose={() => closeEditModal()}
        isEditing
        formState={formState}
        onChange={handleFormChange}
        onPlatformToggle={handlePlatformToggle}
        onSubmit={handleSubmit}
        onCancelEdit={() => closeEditModal()}
        isSaving={isSaving}
        error={formError}
        teamMembers={teamMembers}
      />
      <InstagramLoginModal
        isOpen={isInstagramModalOpen}
        onClose={() => setIsInstagramModalOpen(false)}
        onStart={() => void handleStartInstagramAuth()}
        isLoading={isStartingInstagram}
        errorMessage={instagramError}
      />
    </>
  );
}

