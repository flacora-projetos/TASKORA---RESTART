'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import { ClientFormState, createFormStateFromClient, buildClientPayload } from "./ClientForm";
import { ClientFormModal } from "./ClientFormModal";
import { ClientTable } from "./ClientTable";
import { apiFetch, ApiError } from "../../lib/api";
import type { Client, ClientPlatform } from "../../types/clients";
import type { TeamMember } from "../../types/team";
import { useAuth } from "../auth/AuthProvider";

type ClientsState =
  | { status: "idle"; items: Client[] }
  | { status: "loading"; items: Client[] }
  | { status: "loaded"; items: Client[] }
  | { status: "error"; items: Client[]; message: string };

type PlatformFilterValue = ClientPlatform | "all" | "ga4";

const PLATFORM_OPTIONS: Array<{ value: PlatformFilterValue; label: string }> = [
  { value: "all", label: "Todas as plataformas" },
  { value: "google", label: "Google Ads" },
  { value: "meta", label: "Meta Ads" },
  { value: "pinterest", label: "Pinterest" },
  { value: "ga4", label: "GA4" },
  { value: "tiktok", label: "TikTok" },
  { value: "other", label: "Outras" }
];

export function ClientsPage(): JSX.Element {
  const { token, status: authStatus } = useAuth();
  const isAuthenticated = authStatus === "authenticated" && Boolean(token);

  const [clientsState, setClientsState] = useState<ClientsState>({ status: "idle", items: [] });
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("active");
  const [platformFilter, setPlatformFilter] = useState<PlatformFilterValue>("all");
  const [segmentFilter, setSegmentFilter] = useState<string>("all");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [formState, setFormState] = useState<ClientFormState>(createFormStateFromClient());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const loadClients = useCallback(
    async (
      currentToken: string,
      filters: { status?: "active" | "archived"; responsibleId?: string } = {}
    ) => {
      setClientsState((prev) => ({ ...prev, status: "loading" }));
      const query: Record<string, string> = {};
      if (filters.status) {
        query.status = filters.status;
      }
      if (filters.responsibleId) {
        query.responsibleId = filters.responsibleId;
      }
      const response = await apiFetch<{ items: Client[] }>("/clients", {
        token: currentToken,
        query: Object.keys(query).length > 0 ? query : undefined
      });
      setClientsState({ status: "loaded", items: response.items });
    },
    []
  );

  const buildClientFilters = useCallback(() => {
    const filters: { status?: "active" | "archived"; responsibleId?: string } = {};
    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }
    if (responsibleFilter !== "all") {
      filters.responsibleId = responsibleFilter;
    }
    return filters;
  }, [statusFilter, responsibleFilter]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setClientsState({ status: "idle", items: [] });
      return;
    }

    const filters = buildClientFilters();
    loadClients(token, filters).catch((error) => {
      const message = error instanceof ApiError ? error.message : "Não foi possível carregar os clientes.";
      setClientsState({ status: "error", items: [], message });
    });
  }, [token, isAuthenticated, buildClientFilters, loadClients]);

  const loadTeamMembers = useCallback(
    async (currentToken: string) => {
      const response = await apiFetch<{ items: TeamMember[] }>("/team/members", {
        token: currentToken
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
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const resetFormState = () => {
    setFormState(createFormStateFromClient());
    setFormError(null);
    setIsSaving(false);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    resetFormState();
  };

  const openCreateModal = () => {
    resetFormState();
    setIsFormModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !isAuthenticated) {
      return;
    }
    if (!formState.name.trim()) {
      setFormError("Informe o nome do cliente.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const payload = buildClientPayload(formState);

    try {
      if (formState.id) {
        await apiFetch(`/clients/${formState.id}`, {
          token,
          method: "PUT",
          body: payload
        });
      } else {
        await apiFetch("/clients", {
          token,
          method: "POST",
          body: payload
        });
      }

      await loadClients(token, buildClientFilters());
      closeFormModal();
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Falha ao salvar cliente.";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (client: Client) => {
    setFormState(createFormStateFromClient(client));
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleCancelEdit = () => {
    closeFormModal();
  };

  const handleArchive = async (client: Client) => {
    if (!token || !isAuthenticated) {
      return;
    }
    if (!window.confirm(`Arquivar ${client.name}?`)) {
      return;
    }
    try {
      await apiFetch(`/clients/${client.id}`, {
        token,
        method: "DELETE"
      });
      await loadClients(token, buildClientFilters());
    } catch (error) {
      alert(error instanceof ApiError ? error.message : "Falha ao arquivar cliente.");
    }
  };

  const segments = useMemo(() => {
    const unique = new Set<string>();
    clientsState.items.forEach((client) => {
      if (client.segment) {
        unique.add(client.segment);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [clientsState.items]);

  const safeTeamMembers = useMemo(() => (Array.isArray(teamMembers) ? teamMembers : []), [teamMembers]);

  const responsibleFilterOptions = useMemo(
    () =>
      safeTeamMembers
        .map((member) => ({
          id: member.id,
          label: member.status === "inactive" ? `${member.name} (inativo)` : member.name
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [safeTeamMembers]
  );

  const responsibleLookup = useMemo(() => {
    const map = new Map<string, TeamMember>();
    safeTeamMembers.forEach((member) => map.set(member.id, member));
    return map;
  }, [safeTeamMembers]);

  const filteredClients = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return clientsState.items.filter((client) => {
      if (responsibleFilter !== "all" && client.responsibleId !== responsibleFilter) {
        return false;
      }

      if (platformFilter !== "all") {
        const matchesPlatform =
          platformFilter === "ga4"
            ? Array.isArray(client.ga4PropertyIds) && client.ga4PropertyIds.length > 0
            : Array.isArray(client.platforms) && client.platforms.includes(platformFilter);
        if (!matchesPlatform) {
          return false;
        }
      }

      if (segmentFilter !== "all") {
        const clientSegment = (client.segment ?? "").toLowerCase();
        if (clientSegment !== segmentFilter.toLowerCase()) {
          return false;
        }
      }

      if (normalizedQuery) {
        const haystack = [
          client.name,
          client.integrations?.directoryId ?? "",
          ...(client.googleCustomerIds ?? []),
          ...(client.metaAccountIds ?? []),
          ...(client.ga4PropertyIds ?? []),
          ...(client.pinterestAccountIds ?? [])
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase());

        const matchesQuery = haystack.some((value) => value.includes(normalizedQuery));
        if (!matchesQuery) {
          return false;
        }
      }

      return true;
    });
  }, [clientsState.items, platformFilter, responsibleFilter, segmentFilter, searchQuery]);

  const handleResetFilters = () => {
    setStatusFilter("active");
    setPlatformFilter("all");
    setSegmentFilter("all");
    setResponsibleFilter("all");
    setSearchQuery("");
  };

  if (!isAuthenticated) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900">Clientes</h2>
        <p className="mt-2 text-sm text-gray-600">Faça login no dashboard para gerenciar os clientes do Taskora.</p>
      </section>
    );
  }

  return (
    <>
      <div className="space-y-8">
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Clientes</p>
              <h1 className="text-2xl font-semibold text-gray-900">Visão geral dos clientes</h1>
              <p className="text-sm text-gray-600">Organize integrações, responsáveis e resultados em um só lugar.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={openCreateModal}
                className="rounded-full bg-terracota px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-terracota/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40"
              >
                Criar cliente
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Filtros inteligentes</p>
              <p className="text-sm text-gray-600">
                Combine status, plataforma, segmento e responsável para achar clientes em segundos.
              </p>
            </div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="text-sm font-semibold text-gray-600 transition hover:text-gray-900"
            >
              Limpar filtros
            </button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600" htmlFor="clients-status-filter">
                Status
              </label>
              <select
                id="clients-status-filter"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as "all" | "active" | "archived")}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40"
              >
                <option value="all">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="archived">Arquivados</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600" htmlFor="clients-platform-filter">
                Plataforma
              </label>
              <select
                id="clients-platform-filter"
                value={platformFilter}
                onChange={(event) => setPlatformFilter(event.target.value as ClientPlatform | "all")}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40"
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600" htmlFor="clients-segment-filter">
                Segmento
              </label>
              <select
                id="clients-segment-filter"
                value={segmentFilter}
                onChange={(event) => setSegmentFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40"
              >
                <option value="all">Todos os segmentos</option>
                {segments.map((segment) => (
                  <option key={segment} value={segment}>
                    {segment}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600" htmlFor="clients-responsible-filter">
                Responsável
              </label>
              <select
                id="clients-responsible-filter"
                value={responsibleFilter}
                onChange={(event) => setResponsibleFilter(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40"
              >
                <option value="all">Todos os responsáveis</option>
                {responsibleFilterOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1 xl:col-span-2">
              <label className="text-xs font-semibold text-gray-600" htmlFor="clients-search-input">
                Busca rápida
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path
                      fillRule="evenodd"
                      d="M10 3.75a6.25 6.25 0 1 0 3.868 11.197l3.592 3.593a.75.75 0 1 0 1.06-1.06l-3.592-3.594A6.25 6.25 0 0 0 10 3.75ZM5.25 10a4.75 4.75 0 1 1 9.5 0 4.75 4.75 0 0 1-9.5 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                <input
                  id="clients-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Buscar por nome, ID ou plataforma"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40"
                />
              </div>
            </div>
          </div>
        </section>

        <ClientTable
          clients={filteredClients}
          loading={clientsState.status === "loading"}
          onEdit={handleEdit}
          onArchive={handleArchive}
          responsibleLookup={responsibleLookup}
        />
      </div>
      <ClientFormModal
        isOpen={isFormModalOpen}
        onClose={closeFormModal}
        isEditing={Boolean(formState.id)}
        formState={formState}
        onChange={handleFormChange}
        onPlatformToggle={handlePlatformToggle}
        onSubmit={handleSubmit}
        onCancelEdit={handleCancelEdit}
        isSaving={isSaving}
        error={formError}
        teamMembers={teamMembers}
      />
      {showScrollTop ? (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-6 right-6 z-40 rounded-full bg-deepGreen px-4 py-2 text-xs font-semibold uppercase tracking-wide text-offWhite shadow-lg shadow-deepGreen/40 transition hover:bg-deepGreen/90"
        >
          Voltar ao topo
        </button>
      ) : null}
    </>
  );
}
