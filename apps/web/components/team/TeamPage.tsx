'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import {
  buildTeamMemberPayload,
  createTeamMemberFormState,
  type TeamMemberFormState
} from "./TeamMemberForm";
import { TeamMemberFormModal } from "./TeamMemberFormModal";
import { apiFetch, ApiError } from "../../lib/api";
import type { TeamMember, TeamMemberStatus, TeamOverviewResponse } from "../../types/team";
import { useAuth } from "../auth/AuthProvider";

type FetchState =
  | { status: "idle"; items: TeamMember[] }
  | { status: "loading"; items: TeamMember[] }
  | { status: "loaded"; items: TeamMember[] }
  | { status: "error"; items: TeamMember[]; message: string };

const STATUS_FILTERS: Array<{ value: TeamMemberStatus | "all"; label: string }> = [
  { value: "active", label: "Ativos" },
  { value: "inactive", label: "Inativos" },
  { value: "all", label: "Todos" }
];

const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "last7", label: "Últimos 7 dias" },
  { value: "last30", label: "Últimos 30 dias" },
  { value: "month", label: "Mês" }
];

type TeamTab = "overview" | "people" | "admin";
type Delta = { diff: number; pct: number | null } | null;
type HoursEntry = { id: string; name: string; minutes: number };

export function TeamPage(): JSX.Element {
  const { token, status: authStatus, user } = useAuth();
  const isAuthenticated = authStatus === "authenticated" && Boolean(token);
  const isAdmin = user?.isAdmin === true;
  const canManageMembers = isAuthenticated && isAdmin;

  const [teamState, setTeamState] = useState<FetchState>({ status: "idle", items: [] });
  const [overview, setOverview] = useState<TeamOverviewResponse | null>(null);
  const [previousOverview, setPreviousOverview] = useState<TeamOverviewResponse | null>(null);
  const [overviewStatus, setOverviewStatus] = useState<"idle" | "loading" | "error">("idle");
  const [period, setPeriod] = useState<string>("last7");
  const [activeTab, setActiveTab] = useState<TeamTab>("overview");
  const [filter, setFilter] = useState<TeamMemberStatus | "all">("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState<TeamMemberFormState>(createTeamMemberFormState());
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [directoryMembers, setDirectoryMembers] = useState<TeamMember[]>([]);
  const [showAllHoursByUser, setShowAllHoursByUser] = useState(false);
  const [showAllHoursByClient, setShowAllHoursByClient] = useState(false);
  const [showAllDeliveries, setShowAllDeliveries] = useState(false);
  const [showAllRisks, setShowAllRisks] = useState(false);

  const deliveriesSectionRef = useRef<HTMLDivElement | null>(null);
  const risksSectionRef = useRef<HTMLDivElement | null>(null);
  const peopleSectionRef = useRef<HTMLDivElement | null>(null);
  const adminSectionRef = useRef<HTMLDivElement | null>(null);

  const loadMembers = useCallback(
    async (currentToken: string, statusFilter: TeamMemberStatus | "all") => {
      setTeamState((prev) => ({ ...prev, status: "loading" }));
      const query = statusFilter === "all" ? undefined : { status: statusFilter };

      const [visible, directory] = await Promise.all([
        apiFetch<{ items: TeamMember[] }>("/team/members", {
          token: currentToken,
          query
        }),
        apiFetch<{ items: TeamMember[] }>("/team/members", {
          token: currentToken
        })
      ]);

      setTeamState({ status: "loaded", items: visible.items });
      setDirectoryMembers(directory.items);
    },
    []
  );

  const loadOverview = useCallback(
    async (currentToken: string, currentPeriod: string) => {
      setOverviewStatus("loading");
      try {
        const currentPromise = apiFetch<TeamOverviewResponse>("/team/overview", {
          token: currentToken,
          query: { period: currentPeriod }
        });

        const currentRange = resolveFrontDateRange(currentPeriod);
        const previousRange = currentRange ? shiftRangeToPrevious(currentRange) : null;

        const previousPromise = previousRange
          ? apiFetch<TeamOverviewResponse>("/team/overview", {
              token: currentToken,
              query: {
                period: "custom",
                from: previousRange.start.toISOString(),
                to: previousRange.end.toISOString()
              }
            })
          : Promise.resolve(null);

        const [currentOverview, previousData] = await Promise.all([currentPromise, previousPromise]);
        setOverview(currentOverview);
        setPreviousOverview(previousData);
        setOverviewStatus("idle");
      } catch (error) {
        setOverviewStatus("error");
        const message = error instanceof ApiError ? error.message : "Não foi possível carregar o overview.";
        console.warn(message);
      }
    },
    []
  );

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setTeamState({ status: "idle", items: [] });
      setOverview(null);
      return;
    }
    loadMembers(token, filter).catch((error: unknown) => {
      const message =
        error instanceof ApiError ? error.message : "Não conseguimos carregar a equipe agora.";
      setTeamState({ status: "error", items: [], message });
    });
    loadOverview(token, period).catch(() => {
      setOverviewStatus("error");
    });
  }, [token, isAuthenticated, filter, loadMembers, loadOverview, period]);

  const openCreateModal = () => {
    if (!canManageMembers) {
      setFormError("Apenas administradores podem gerenciar integrantes.");
      return;
    }
    setFormMode("create");
    setFormState(createTeamMemberFormState());
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (member: TeamMember) => {
    if (!canManageMembers) {
      setFormError("Apenas administradores podem gerenciar integrantes.");
      return;
    }
    setFormMode("edit");
    setFormState(createTeamMemberFormState(member));
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleChange = (field: keyof TeamMemberFormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !canManageMembers) {
      setFormError("Apenas administradores podem gerenciar integrantes.");
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      const payload = buildTeamMemberPayload(formState);
      if (formMode === "create") {
        await apiFetch("/team/members", {
          token,
          method: "POST",
          body: payload
        });
      } else if (formState.id) {
        await apiFetch(`/team/members/${formState.id}`, {
          token,
          method: "PUT",
          body: payload
        });
      }
      setIsModalOpen(false);
      await loadMembers(token, filter);
      await loadOverview(token, period);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possível salvar este integrante.";
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!token || !canManageMembers) {
      return;
    }
    await apiFetch(`/team/members/${id}`, {
      token,
      method: "DELETE"
    });
    await loadMembers(token, filter);
    await loadOverview(token, period);
  };

  const handleDelete = async (id: string) => {
    if (!token || !canManageMembers) {
      return;
    }
    const confirmed = typeof window === "undefined" ? true : window.confirm("Excluir este membro de forma permanente?");
    if (!confirmed) {
      return;
    }
    await apiFetch(`/team/members/${id}`, {
      token,
      method: "DELETE",
      query: { hard: "true" }
    });
    await loadMembers(token, filter);
    await loadOverview(token, period);
  };

  const handleRestore = async (id: string) => {
    if (!token || !canManageMembers) {
      return;
    }
    await apiFetch(`/team/members/${id}`, {
      token,
      method: "PUT",
      body: { status: "active" }
    });
    await loadMembers(token, filter);
    await loadOverview(token, period);
  };

  const filteredItems = useMemo(() => teamState.items, [teamState.items]);

  const teamDirectory = useMemo(() => {
    const map = new Map<string, string>();
    const sources: Array<{ id: string; name: string; userId?: string | null; email?: string | null }> = [
      ...directoryMembers.map((member) => ({
        id: member.id,
        name: member.name,
        userId: member.userId ?? null,
        email: member.email ?? null
      })),
      ...(overview?.members ?? []).map((member) => ({
        id: member.id,
        name: member.name,
        userId: null,
        email: member.email ?? null
      }))
    ];

    sources.forEach((member) => {
      if (member.name) {
        map.set(member.id, member.name);
      }
      if (member.userId) {
        map.set(member.userId, member.name);
      }
      if (member.email) {
        map.set(member.email, member.name);
      }
    });

    return map;
  }, [overview?.members, directoryMembers]);

  const hoursByUserDisplay = useMemo<HoursEntry[]>(() => {
    if (!overview) {
      return [];
    }
    return (overview.charts.hoursByUser ?? []).map((entry) => {
      const friendlyName =
        teamDirectory.get(entry.id) ??
        teamDirectory.get(entry.name) ??
        (entry.id === "sem_usuario" ? "Sem usuario" : entry.name ?? entry.id);
      return {
        ...entry,
        name: friendlyName
      };
    });
  }, [overview, teamDirectory]);

  const handleCardClick = (target: "deliveries" | "risks" | "people" | "admin") => {
    const map: Record<typeof target, React.RefObject<HTMLDivElement>> = {
      deliveries: deliveriesSectionRef,
      risks: risksSectionRef,
      people: peopleSectionRef,
      admin: adminSectionRef
    };
    map[target]?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const deltas = useMemo(() => {
    if (!overview || !previousOverview) {
      return null;
    }
    const compute = (curr: number, prev: number): Delta => {
      if (prev === undefined || prev === null) {
        return null;
      }
      const diff = curr - prev;
      const pct = prev > 0 ? Math.round((diff / prev) * 100) : null;
      return { diff, pct };
    };
    return {
      hours: compute(overview.cards.hoursMinutes, previousOverview.cards.hoursMinutes),
      tasks: compute(overview.cards.tasksDone, previousOverview.cards.tasksDone),
      wip: compute(overview.cards.wip, previousOverview.cards.wip),
      blocked: compute(overview.cards.blocked, previousOverview.cards.blocked),
      overdue: compute(overview.cards.overdue, previousOverview.cards.overdue),
      missing: compute(overview.cards.missingTime, previousOverview.cards.missingTime)
    };
  }, [overview, previousOverview]);

  return (
    <section className="space-y-10">
      <div className="mx-auto max-w-6xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Times</p>
            <h1 className="text-2xl font-semibold text-gray-900">Painel do time</h1>
            <p className="text-sm text-gray-600">
              KPIs acionáveis, cargas e riscos. Use as abas para navegar entre overview, pessoas e administração.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => {
              const active = period === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPeriod(option.value)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepGreen/40 ${
                    active
                      ? "bg-deepGreen text-white shadow-sm"
                      : "border border-gray-200 bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-700">
          {[
            { id: "overview", label: "Visão do time" },
            { id: "people", label: "Pessoas" },
            { id: "admin", label: "Administração" }
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as TeamTab)}
                className={`rounded-full px-4 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepGreen/30 ${
                  isActive ? "bg-deepGreen text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {overviewStatus === "error" ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Não conseguimos carregar os indicadores do time agora.
          </p>
        ) : null}

        {activeTab === "overview" ? (
          <OverviewTab
            overview={overview}
            deltas={deltas}
            onCardClick={handleCardClick}
            hoursByUser={hoursByUserDisplay}
            showAllHoursByUser={showAllHoursByUser}
            showAllHoursByClient={showAllHoursByClient}
            onToggleHoursByUser={() => setShowAllHoursByUser((prev) => !prev)}
            onToggleHoursByClient={() => setShowAllHoursByClient((prev) => !prev)}
            deliveriesRef={deliveriesSectionRef}
            risksRef={risksSectionRef}
            peopleRef={peopleSectionRef}
            showAllDeliveries={showAllDeliveries}
            showAllRisks={showAllRisks}
            onToggleDeliveries={() => setShowAllDeliveries((prev) => !prev)}
            onToggleRisks={() => setShowAllRisks((prev) => !prev)}
          />
        ) : null}

        {activeTab === "people" ? (
          <PeopleTab overview={overview} reference={peopleSectionRef} />
        ) : null}

        {activeTab === "admin" ? (
          <AdminTab
            isAuthenticated={isAuthenticated}
            isAdmin={isAdmin}
            teamState={teamState}
            filter={filter}
            setFilter={setFilter}
            filteredItems={filteredItems}
            openCreateModal={openCreateModal}
            openEditModal={openEditModal}
            handleArchive={handleArchive}
            handleDelete={handleDelete}
            handleRestore={handleRestore}
            reference={adminSectionRef}
          />
        ) : null}
      </div>

      <TeamMemberFormModal
        isOpen={isModalOpen}
        state={formState}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClose={() => setIsModalOpen(false)}
        isSaving={isSaving}
        error={formError}
        mode={formMode}
        canSetAdminRole={isAdmin}
      />
    </section>
  );
}

type OverviewTabProps = {
  overview: TeamOverviewResponse | null;
  deltas: {
    hours: Delta;
    tasks: Delta;
    wip: Delta;
    blocked: Delta;
    overdue: Delta;
    missing: Delta;
  } | null;
  onCardClick: (target: "deliveries" | "risks" | "people" | "admin") => void;
  hoursByUser: HoursEntry[];
  showAllHoursByUser: boolean;
  showAllHoursByClient: boolean;
  onToggleHoursByUser: () => void;
  onToggleHoursByClient: () => void;
  deliveriesRef: RefObject<HTMLDivElement>;
  risksRef: RefObject<HTMLDivElement>;
  peopleRef: RefObject<HTMLDivElement>;
  showAllDeliveries: boolean;
  showAllRisks: boolean;
  onToggleDeliveries: () => void;
  onToggleRisks: () => void;
};

function OverviewTab({
  overview,
  deltas,
  onCardClick,
  hoursByUser,
  showAllHoursByUser,
  showAllHoursByClient,
  onToggleHoursByUser,
  onToggleHoursByClient,
  deliveriesRef,
  risksRef,
  peopleRef,
  showAllDeliveries,
  showAllRisks,
  onToggleDeliveries,
  onToggleRisks
}: OverviewTabProps): JSX.Element {
  return (
    <div className="mt-6 space-y-8">
      <div className="grid gap-4 md:grid-cols-3">
        {renderCard("Horas registradas", overview?.cards.hoursMinutes ?? 0, "min", deltas?.hours, () => onCardClick("people"), "ok")}
        {renderCard(
          "Tarefas concluídas",
          overview?.cards.tasksDone ?? 0,
          overview?.cards.onTimePercent !== null && overview?.cards.onTimePercent !== undefined ? `${overview?.cards.onTimePercent}% no prazo` : null,
          deltas?.tasks,
          () => onCardClick("deliveries"),
          "ok"
        )}
        {renderCard(
          "WIP (em andamento)",
          overview?.cards.wip ?? 0,
          "tarefas",
          deltas?.wip,
          () => onCardClick("people"),
          overview && overview.cards.wip > 8 ? "warn" : "ok"
        )}
        {renderCard(
          "Bloqueadas",
          overview?.cards.blocked ?? 0,
          "tarefas",
          deltas?.blocked,
          () => onCardClick("risks"),
          overview && (overview.cards.blocked ?? 0) > 0 ? "warn" : "ok"
        )}
        {renderCard(
          "Atrasadas",
          overview?.cards.overdue ?? 0,
          "tarefas",
          deltas?.overdue,
          () => onCardClick("risks"),
          overview && (overview.cards.overdue ?? 0) > 0 ? "warn" : "ok"
        )}
        {renderCard(
          "Entregas sem horas",
          overview?.cards.missingTime ?? 0,
          "tarefas",
          deltas?.missing,
          () => onCardClick("deliveries"),
          overview && (overview.cards.missingTime ?? 0) > 0 ? "warn" : "ok"
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Horas por pessoa</p>
            {hoursByUser.length > 5 ? (
              <button type="button" className="text-xs font-semibold text-deepGreen hover:underline" onClick={onToggleHoursByUser}>
                {showAllHoursByUser ? "Ver Top 5" : "Ver todos"}
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {splitTopAndRest(hoursByUser, showAllHoursByUser).map((item) => {
              const total = overview?.cards.hoursMinutes ?? 1;
              const perc = Math.min(100, Math.round((item.minutes / total) * 100));
              return (
                <div key={item.id}>
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span className="font-semibold text-gray-800">{item.name}</span>
                    <span>{item.minutes} min</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-white">
                    <div className="h-2 rounded-full bg-deepGreen" style={{ width: `${perc}%` }} />
                  </div>
                </div>
              );
            })}
            {(overview?.charts.hoursByUser ?? []).length === 0 ? <p className="text-xs text-gray-600">Sem horas registradas no período.</p> : null}
          </div>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-800">Horas por cliente</p>
            {(overview?.charts.hoursByClient ?? []).length > 5 ? (
              <button type="button" className="text-xs font-semibold text-deepGreen hover:underline" onClick={onToggleHoursByClient}>
                {showAllHoursByClient ? "Ver Top 5" : "Ver todos"}
              </button>
            ) : null}
          </div>
          <div className="mt-4 space-y-3">
            {renderHoursByClient(overview, showAllHoursByClient).map((item) => (
              <div key={item.id}>
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span className="font-semibold text-gray-800">{item.name}</span>
                  <span>{item.minutes} min</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white">
                  <div className="h-2 rounded-full bg-terracota" style={{ width: `${item.perc}%` }} />
                </div>
              </div>
            ))}
            {(overview?.charts.hoursByClient ?? []).length === 0 ? <p className="text-xs text-gray-600">Sem horas registradas no período.</p> : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div ref={deliveriesRef} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Entregas</p>
              <p className="text-sm font-semibold text-gray-800">Últimas entregas do time</p>
            </div>
            {(overview?.lists.lastDeliveries ?? []).length > 5 ? (
              <button type="button" className="text-xs font-semibold text-deepGreen hover:underline" onClick={onToggleDeliveries}>
                {showAllDeliveries ? "Ver menos" : "Ver tudo"}
              </button>
            ) : null}
          </div>
          <ul className="mt-3 space-y-3 text-sm text-gray-700">
            {(showAllDeliveries ? overview?.lists.lastDeliveries ?? [] : (overview?.lists.lastDeliveries ?? []).slice(0, 5)).map((task) => (
              <li key={task.id} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                <p className="font-semibold text-gray-900">{task.title}</p>
                <p className="text-xs text-gray-600">
                  {task.clientName ?? "Sem cliente"} · {task.projectName ?? "Sem projeto"} · {new Date(task.updatedAt).toLocaleDateString("pt-BR")}
                </p>
                <p className="text-xs text-gray-600">Responsáveis: {task.assignees.map((a) => a.name).join(", ") || "–"}</p>
              </li>
            ))}
            {(overview?.lists.lastDeliveries ?? []).length === 0 ? (
              <p className="text-xs text-gray-600">Nenhuma entrega concluída neste período.</p>
            ) : null}
          </ul>
        </div>

        <div ref={risksRef} className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Riscos</p>
              <p className="text-sm font-semibold text-gray-800">Riscos do dia</p>
            </div>
            {(overview?.lists.risks ?? []).length > 5 ? (
              <button type="button" className="text-xs font-semibold text-deepGreen hover:underline" onClick={onToggleRisks}>
                {showAllRisks ? "Ver menos" : "Ver tudo"}
              </button>
            ) : null}
          </div>
          <div className="mt-3 space-y-3 text-sm text-gray-700">
            {groupRisks(showAllRisks ? overview?.lists.risks ?? [] : (overview?.lists.risks ?? []).slice(0, 5)).map((riskGroup) => (
              <div key={riskGroup.label} className="space-y-2 rounded-md border border-amber-100 bg-amber-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">{riskGroup.label}</p>
                <ul className="space-y-2">
                  {riskGroup.items.map((task) => (
                    <li key={task.id} className="rounded-md border border-amber-100 bg-white p-2 shadow-sm">
                      <p className="font-semibold text-gray-900">{task.title}</p>
                      <p className="text-[11px] text-gray-700">
                        {task.dueDate ? `Prazo ${new Date(task.dueDate).toLocaleDateString("pt-BR")}` : "Sem prazo"} · {task.clientName ?? "Sem cliente"} ·{" "}
                        {task.projectName ?? "Sem projeto"}
                      </p>
                      <p className="text-[11px] text-gray-700">Responsáveis: {task.assignees.map((a) => a.name).join(", ") || "–"}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {(overview?.lists.risks ?? []).length === 0 ? <p className="text-xs text-gray-600">Nenhum risco crítico encontrado.</p> : null}
          </div>
        </div>
      </div>

      <div ref={peopleRef} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Pessoas</p>
            <h2 className="text-lg font-semibold text-gray-900">Carga e entregas por membro</h2>
          </div>
          <span className="text-xs text-gray-500">Cadastros editáveis na aba Administração.</span>
        </div>
        <MembersGrid members={overview?.members ?? []} />
      </div>
    </div>
  );
}

function PeopleTab({ overview, reference }: { overview: TeamOverviewResponse | null; reference: RefObject<HTMLDivElement> }): JSX.Element {
  return (
    <div ref={reference} className="mt-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Pessoas</p>
          <h2 className="text-lg font-semibold text-gray-900">Carga e entregas por membro</h2>
        </div>
        <span className="text-xs text-gray-500">Cadastros editáveis na aba Administração.</span>
      </div>
      <MembersGrid members={overview?.members ?? []} />
    </div>
  );
}

type AdminTabProps = {
  isAuthenticated: boolean;
  isAdmin: boolean;
  teamState: FetchState;
  filter: TeamMemberStatus | "all";
  setFilter: (value: TeamMemberStatus | "all") => void;
  filteredItems: TeamMember[];
  openCreateModal: () => void;
  openEditModal: (member: TeamMember) => void;
  handleArchive: (id: string) => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
  handleRestore: (id: string) => Promise<void>;
  reference: RefObject<HTMLDivElement>;
};

function AdminTab({
  isAuthenticated,
  isAdmin,
  teamState,
  filter,
  setFilter,
  filteredItems,
  openCreateModal,
  openEditModal,
  handleArchive,
  handleDelete,
  handleRestore,
  reference
}: AdminTabProps): JSX.Element {
  return (
    <div ref={reference} className="mt-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Administração</p>
          <h2 className="text-xl font-semibold text-gray-900">Cadastro de integrantes</h2>
          <p className="text-sm text-gray-600">
            Gerencie pessoas, papéis e capacidade semanal. Os dados alimentam a visão de time acima.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={openCreateModal}
            disabled={!isAuthenticated || !isAdmin || teamState.status === "loading"}
            className="rounded-full bg-deepGreen px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-deepGreen/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepGreen/40 disabled:opacity-50"
          >
            Adicionar membro
          </button>
          {!isAdmin ? (
            <span className="text-xs text-gray-500">
              Apenas administradores podem gerenciar integrantes.
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepGreen/30 ${
                active
                  ? "border border-deepGreen/30 bg-deepGreen/10 text-deepGreen"
                  : "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {teamState.status === "error" ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {teamState.message}
        </p>
      ) : null}

      {teamState.status === "loading" ? <p className="mt-4 text-sm text-gray-600">Carregando integrantes...</p> : null}

      {!filteredItems.length && teamState.status === "loaded" ? (
        <p className="mt-4 text-sm text-gray-600">Nenhum integrante encontrado para este filtro.</p>
      ) : null}

      {filteredItems.length ? (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm text-gray-700">
            <thead className="bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Função</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Capacidade (h/sem)</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((member) => {
                const weeklyHours = member.weeklyCapacityMinutes ? Math.round(member.weeklyCapacityMinutes / 60) : "-";
                return (
                  <tr key={member.id} className="transition hover:bg-gray-50">
                    <td className="px-4 py-4 text-sm font-semibold text-gray-900">{member.name}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{member.role}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{member.email ?? "-"}</td>
                    <td className="px-4 py-4 text-sm text-gray-700">{weeklyHours}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          member.status === "active"
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                      >
                        {member.status === "active" ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEditModal(member)}
                          disabled={!isAdmin}
                          className="rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Editar
                        </button>
                        {member.status === "active" ? (
                          <button
                            type="button"
                            onClick={() => void handleArchive(member.id)}
                            disabled={!isAdmin}
                            className="rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Arquivar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void handleRestore(member.id)}
                            disabled={!isAdmin}
                            className="rounded-full border border-emerald-200 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Reativar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleDelete(member.id)}
                          disabled={!isAdmin}
                          className="rounded-full border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function MembersGrid({ members }: { members: TeamOverviewResponse["members"] | undefined }): JSX.Element {
  if (!members || members.length === 0) {
    return <p className="text-sm text-gray-600">Sem integrantes ativos.</p>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {members.map((member) => {
        const weeklyHours = member.weeklyCapacityMinutes ? Math.round(member.weeklyCapacityMinutes / 60) : null;
        return (
          <div key={member.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{member.name}</p>
                <p className="text-xs text-gray-600">{member.role}</p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                  member.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700"
                }`}
              >
                {member.status === "active" ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700">
              <div className="rounded-md bg-white p-2 shadow-sm">
                <p className="font-semibold text-gray-900">Horas</p>
                <p>{member.hoursMinutes} min</p>
              </div>
              <div className="rounded-md bg-white p-2 shadow-sm">
                <p className="font-semibold text-gray-900">WIP</p>
                <p>{member.wip} tarefas</p>
              </div>
              <div className="rounded-md bg-white p-2 shadow-sm">
                <p className="font-semibold text-gray-900">Bloqueadas</p>
                <p>{member.blocked}</p>
              </div>
              <div className="rounded-md bg-white p-2 shadow-sm">
                <p className="font-semibold text-gray-900">Concluídas</p>
                <p>{member.done}</p>
              </div>
            </div>
            {weeklyHours ? <p className="mt-2 text-[11px] text-gray-600">Capacidade semanal: {weeklyHours}h</p> : null}
            {member.alerts.length ? (
              <ul className="mt-3 space-y-1 text-[11px] text-amber-700">
                {member.alerts.map((alert) => (
                  <li key={alert} className="rounded bg-amber-100 px-2 py-1">
                    {alert}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-800">Últimas tarefas</p>
              <ul className="mt-1 space-y-1 text-[11px] text-gray-700">
                {member.lastTasks.slice(0, 3).map((task) => (
                  <li key={task.id} className="truncate">
                    {new Date(task.updatedAt).toLocaleDateString("pt-BR")} · {task.title}
                  </li>
                ))}
                {member.lastTasks.length === 0 ? <li className="text-gray-500">Sem tarefas concluídas.</li> : null}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderCard(
  title: string,
  value: number,
  helper?: string | number | null,
  delta?: Delta,
  onClick?: () => void,
  tone: "ok" | "warn" = "ok"
): JSX.Element {
  const badge =
    tone === "warn" ? "bg-amber-100 text-amber-800" : tone === "ok" ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-700";
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border border-gray-100 bg-gray-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepGreen/40"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{title}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge}`}>{tone === "warn" ? "Atenção" : "OK"}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      {helper ? <p className="text-xs text-gray-600">{helper}</p> : null}
      {delta ? (
        <p className="mt-1 text-xs font-semibold text-gray-700">
          {delta.diff >= 0 ? "+" : ""}
          {delta.diff} ({delta.pct !== null ? `${delta.pct}% vs período anterior` : "sem base"})
        </p>
      ) : null}
    </button>
  );
}

function resolveFrontDateRange(period: string): { start: Date; end: Date } | null {
  const today = new Date();
  const startOfDay = (date: Date) => {
    const copy = new Date(date);
    copy.setUTCHours(0, 0, 0, 0);
    return copy;
  };
  const endOfDay = (date: Date) => {
    const copy = new Date(date);
    copy.setUTCHours(23, 59, 59, 999);
    return copy;
  };

  switch (period) {
    case "today": {
      const start = startOfDay(today);
      return { start, end: endOfDay(today) };
    }
    case "week": {
      const currentDay = today.getUTCDay();
      const diff = currentDay === 0 ? 6 : currentDay - 1;
      const start = startOfDay(new Date(today.getTime() - diff * 24 * 60 * 60 * 1000));
      return { start, end: endOfDay(today) };
    }
    case "month": {
      const start = startOfDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
      return { start, end: endOfDay(today) };
    }
    case "last30": {
      const start = startOfDay(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDay(today) };
    }
    case "last7":
    default: {
      const start = startOfDay(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
      return { start, end: endOfDay(today) };
    }
  }
}

function shiftRangeToPrevious(range: { start: Date; end: Date }): { start: Date; end: Date } {
  const durationMs = range.end.getTime() - range.start.getTime() + 1;
  const prevEnd = new Date(range.start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs + 1);
  return { start: prevStart, end: prevEnd };
}

function splitTopAndRest<T extends { minutes: number }>(items: T[], showAll: boolean): T[] {
  if (showAll) {
    return items;
  }
  return items.slice(0, 5);
}

function renderHoursByClient(
  overview: TeamOverviewResponse | null,
  showAll: boolean
): Array<{ id: string; name: string; minutes: number; perc: number }> {
  if (!overview) {
    return [];
  }
  const total = overview.cards.hoursMinutes || 1;
  const sorted = [...(overview.charts.hoursByClient ?? [])].sort((a, b) => b.minutes - a.minutes);
  if (showAll || sorted.length <= 5) {
    return sorted.map((item) => ({
      ...item,
      perc: Math.min(100, Math.round((item.minutes / total) * 100))
    }));
  }
  const top = sorted.slice(0, 5);
  const restTotal = sorted.slice(5).reduce((acc, item) => acc + item.minutes, 0);
  const withOthers =
    restTotal > 0
      ? [...top, { id: "outros", name: "Outros", minutes: restTotal }]
      : top;
  return withOthers.map((item) => ({
    ...item,
    perc: Math.min(100, Math.round((item.minutes / total) * 100))
  }));
}

function groupRisks(
  risks: Array<{
    id: string;
    status: string;
    dueDate: string | null;
    title: string;
    projectName: string | null;
    clientName: string | null;
    assignees: Array<{ id: string; name: string }>;
  }>
): Array<{ label: string; items: typeof risks }> {
  const overdue: typeof risks = [];
  const blocked: typeof risks = [];
  const other: typeof risks = [];
  const nowIso = new Date().toISOString();

  risks.forEach((task) => {
    if (task.status === "blocked") {
      blocked.push(task);
    } else if (task.dueDate && task.dueDate < nowIso) {
      overdue.push(task);
    } else {
      other.push(task);
    }
  });

  return [
    { label: "Atrasadas", items: overdue },
    { label: "Bloqueadas", items: blocked },
    { label: "Outras pendências", items: other }
  ].filter((group) => group.items.length > 0);
}
