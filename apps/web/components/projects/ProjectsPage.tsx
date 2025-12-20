'use client';

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import {
  buildProjectPayload,
  createProjectFormState,
  ProjectFormState,
  PROJECT_STATUS_OPTIONS
} from "./ProjectForm";
import { ProjectFormModal } from "./ProjectFormModal";
import { TASK_STATUS_LABELS, TASK_STATUS_STYLES, TASK_TYPE_OPTIONS } from "../../constants/tasks";
import { apiFetch, ApiError } from "../../lib/api";
import { dateInputToSaoPauloISOString } from "../../lib/datetime";
import { renderTextWithLinks } from "../../lib/text";
import type { Client } from "../../types/clients";
import type { Project, ProjectStatus } from "../../types/projects";
import type { TaskEntity, TaskStatus, TaskType } from "../../types/tasks";
import type { TeamMember } from "../../types/team";
import { useAuth } from "../auth/AuthProvider";

type ProjectsState =
  | { status: "idle"; items: Project[] }
  | { status: "loading"; items: Project[] }
  | { status: "loaded"; items: Project[] }
  | { status: "error"; items: Project[]; message: string };

const STATUS_FILTERS: Array<{ value: ProjectStatus | "all"; label: string }> = [
  { value: "all", label: "Todos" },
  ...PROJECT_STATUS_OPTIONS
];

const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  draft: "border-gray-200 bg-gray-50 text-gray-700",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paused: "border-amber-200 bg-amber-50 text-amber-800",
  completed: "border-sky-200 bg-sky-50 text-sky-700"
};

type ProjectTaskForm = {
  projectId: string;
  title: string;
  dueDate: string;
  assignees: string[];
  status: TaskStatus;
  type: TaskType;
  notes: string;
  checklist: Array<{ id: string; label: string; done: boolean }>;
  checklistInput: string;
};

const PROJECT_TASK_FORM_DEFAULT: ProjectTaskForm = {
  projectId: "",
  title: "",
  dueDate: "",
  assignees: [],
  status: "todo",
  type: "other",
  notes: "",
  checklist: [],
  checklistInput: ""
};

export function ProjectsPage(): JSX.Element {
  const searchParams = useSearchParams();
  const paramClientId = searchParams?.get("clientId") ?? "all";

  const { token, status: authStatus } = useAuth();
  const isAuthenticated = authStatus === "authenticated" && Boolean(token);

  const [projectsState, setProjectsState] = useState<ProjectsState>({ status: "idle", items: [] });
  const [clients, setClients] = useState<Client[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "all">("all");
  const [clientFilter, setClientFilter] = useState<string>(paramClientId || "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formState, setFormState] = useState<ProjectFormState>(createProjectFormState());
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskForm, setTaskForm] = useState<ProjectTaskForm>(PROJECT_TASK_FORM_DEFAULT);
  const [taskModalState, setTaskModalState] = useState<"idle" | "saving">("idle");
  const [taskModalFeedback, setTaskModalFeedback] = useState<string | null>(null);
  const [taskModalProject, setTaskModalProject] = useState<Project | null>(null);
  const [focusProject, setFocusProject] = useState<Project | null>(null);
  const [focusTasks, setFocusTasks] = useState<TaskEntity[]>([]);
  const [focusState, setFocusState] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [focusError, setFocusError] = useState<string | null>(null);

  const clientOptions = useMemo(
    () =>
      clients
        .map((client) => ({ id: client.id, name: client.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  const clientLookup = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => map.set(client.id, client));
    return map;
  }, [clients]);

  const memberOptions = useMemo(
    () =>
      teamMembers
        .filter((member) => member.status === "active")
        .map((member) => ({ id: member.id, name: member.name, role: member.role }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [teamMembers]
  );

  const memberLookup = useMemo(() => {
    const map = new Map<string, TeamMember>();
    teamMembers.forEach((member) => map.set(member.id, member));
    return map;
  }, [teamMembers]);

  const loadProjects = useCallback(
    async (currentToken: string, filters: { status?: ProjectStatus; clientId?: string }) => {
      setProjectsState((prev) => ({ ...prev, status: "loading" }));
      const response = await apiFetch<{ items: Project[] }>("/projects", {
        token: currentToken,
        query: filters
      });
      setProjectsState({ status: "loaded", items: response.items });
    },
    []
  );

  const loadClients = useCallback(
    async (currentToken: string) => {
      const response = await apiFetch<{ items: Client[] }>("/clients", {
        token: currentToken,
        query: { status: "active" }
      });
      setClients(response.items);
    },
    []
  );

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
      setProjectsState({ status: "idle", items: [] });
      setClients([]);
      return;
    }
    const filters: { status?: ProjectStatus; clientId?: string } = {};
    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }
    if (clientFilter !== "all") {
      filters.clientId = clientFilter;
    }
    loadProjects(token, filters).catch((error) => {
      const message =
        error instanceof ApiError ? error.message : "Não foi possível carregar os projetos.";
      setProjectsState({ status: "error", items: [], message });
    });
  }, [token, isAuthenticated, statusFilter, clientFilter, loadProjects]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      return;
    }
    loadClients(token).catch(() => {
      // se falhar, mantemos lista vazia
    });
    loadTeamMembers(token).catch(() => {
      // mantemos lista vazia
    });
  }, [token, isAuthenticated, loadClients, loadTeamMembers]);

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return projectsState.items.filter((project) => {
      if (clientFilter !== "all" && project.clientId !== clientFilter) {
        return false;
      }
      if (statusFilter !== "all" && project.status !== statusFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const ownerLabel = project.ownerId ? memberLookup.get(project.ownerId)?.name ?? project.ownerId : "";
      const ownerMatches = ownerLabel.toLowerCase().includes(normalizedSearch);
      const nameMatches = project.name.toLowerCase().includes(normalizedSearch);
      return ownerMatches || nameMatches;
    });
  }, [projectsState.items, clientFilter, statusFilter, searchQuery, memberLookup]);

  const filteredCount = filteredItems.length;

  const handleClearFilters = (): void => {
    setStatusFilter("all");
    setClientFilter("all");
    setSearchQuery("");
  };

  const resetFormState = (nextClientId?: string) => {
    setFormState((prev) => {
      const targetClient = nextClientId ?? (clientFilter !== "all" ? clientFilter : prev.clientId);
      return { ...createProjectFormState(), clientId: targetClient ?? "" };
    });
    setFormError(null);
    setIsSaving(false);
  };

  const openCreateModal = () => {
    setFormMode("create");
    resetFormState();
    setIsModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setFormMode("edit");
    setFormState(createProjectFormState(project));
    setFormError(null);
    setIsSaving(false);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormError(null);
    setIsSaving(false);
  };

  const handleFormChange = (field: keyof ProjectFormState, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const refreshProjects = () => {
    if (!token || !isAuthenticated) {
      return;
    }
    const filters: { status?: ProjectStatus; clientId?: string } = {};
    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }
    if (clientFilter !== "all") {
      filters.clientId = clientFilter;
    }
    loadProjects(token, filters).catch(() => undefined);
  };

  const fetchProjectTasks = useCallback(
    async (projectId: string) => {
      if (!token) {
        setFocusState("error");
        setFocusError("Faça login para visualizar os detalhes do projeto.");
        return;
      }
      setFocusState("loading");
      setFocusError(null);
      try {
        const response = await apiFetch<{ items: TaskEntity[] }>(`/projects/${projectId}/tasks`, {
          token
        });
        setFocusTasks(response.items);
        setFocusState("loaded");
      } catch (error) {
        const message =
          error instanceof ApiError ? error.message : "Não conseguimos carregar as tarefas deste projeto.";
        setFocusState("error");
        setFocusError(message);
      }
    },
    [token]
  );

  const handleOpenFocus = useCallback(
    (project: Project) => {
      setFocusProject(project);
      setFocusTasks([]);
      fetchProjectTasks(project.id);
    },
    [fetchProjectTasks]
  );

  const handleCloseFocus = useCallback(() => {
    setFocusProject(null);
    setFocusTasks([]);
    setFocusState("idle");
    setFocusError(null);
  }, []);

  const handleRefreshFocusTasks = useCallback(() => {
    if (focusProject) {
      fetchProjectTasks(focusProject.id);
    }
  }, [fetchProjectTasks, focusProject]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !isAuthenticated) {
      return;
    }
    if (!formState.name.trim()) {
      setFormError("Informe o nome do projeto.");
      return;
    }
    if (!formState.clientId) {
      setFormError("Selecione um cliente.");
      return;
    }
    setIsSaving(true);
    setFormError(null);

    const payload = buildProjectPayload(formState);

    try {
      if (formMode === "create") {
        await apiFetch("/projects", {
          token,
          method: "POST",
          body: payload
        });
      } else if (formState.id) {
        await apiFetch(`/projects/${formState.id}`, {
          token,
          method: "PUT",
          body: payload
        });
      }
      closeModal();
      refreshProjects();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possível salvar o projeto.";
      setFormError(message);
      setIsSaving(false);
    }
  };

  const handleArchive = async (project: Project) => {
    if (!token || !isAuthenticated) {
      return;
    }
    const confirmed = window.confirm(
      `Tem certeza que deseja arquivar o projeto "${project.name}"?`
    );
    if (!confirmed) {
      return;
    }
    try {
      await apiFetch(`/projects/${project.id}`, {
        token,
        method: "DELETE"
      });
      refreshProjects();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possível arquivar o projeto.";
      alert(message);
    }
  };

  const handleOpenProjectTaskModal = (project: Project) => {
    setTaskModalProject(project);
    setTaskForm((prev) => ({
      ...PROJECT_TASK_FORM_DEFAULT,
      projectId: project.id,
      dueDate: prev.projectId === project.id ? prev.dueDate : "",
      assignees: prev.projectId === project.id ? prev.assignees : [],
      title: "",
      notes: ""
    }));
    setTaskModalFeedback(null);
    setTaskModalState("idle");
    setTaskModalOpen(true);
  };

  const handleCloseProjectTaskModal = () => {
    setTaskModalOpen(false);
    setTaskModalProject(null);
    setTaskForm(PROJECT_TASK_FORM_DEFAULT);
    setTaskModalFeedback(null);
    setTaskModalState("idle");
  };

  const handleTaskFormChange = (
    field: keyof ProjectTaskForm,
    value: string | string[] | ProjectTaskForm["checklist"]
  ) => {
    setTaskForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProjectTaskSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      setTaskModalFeedback("Faça login para criar tarefas.");
      return;
    }
    if (!taskForm.projectId) {
      setTaskModalFeedback("Escolha um projeto para associar a tarefa.");
      return;
    }
    if (!taskForm.title.trim()) {
      setTaskModalFeedback("Dê um nome para a tarefa.");
      return;
    }
    setTaskModalState("saving");
    setTaskModalFeedback(null);
      try {
        await apiFetch(`/projects/${taskForm.projectId}/tasks`, {
          token,
          method: "POST",
          body: {
            title: taskForm.title.trim(),
            status: taskForm.status,
            type: taskForm.type,
            dueDate: convertDateInputToISO(taskForm.dueDate),
            assignees: taskForm.assignees,
            description: taskForm.notes.trim() ? taskForm.notes.trim() : null,
            checklist: taskForm.checklist.length ? taskForm.checklist : undefined
          }
        });
      handleCloseProjectTaskModal();
      refreshProjects();
      if (focusProject?.id === taskForm.projectId) {
        fetchProjectTasks(taskForm.projectId);
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possível criar a tarefa para este projeto.";
      setTaskModalFeedback(message);
      setTaskModalState("idle");
    }
  };

  const resolveClientName = (clientId: string): string => {
    const client = clientLookup.get(clientId);
    return client?.name ?? "Cliente desconhecido";
  };

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("pt-BR") : "-";

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) {
      return "-";
    }
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  };

const convertDateInputToISO = (value: string): string | null => dateInputToSaoPauloISOString(value);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-gray-200 bg-gradient-to-br from-deepGreen to-deepGreen/80 p-8 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">Operação · Projetos</p>
            <h1 className="text-2xl font-semibold leading-snug">Projetos</h1>
            <p className="text-sm text-white/80">
              Gerencie o pipeline de entregas por cliente e acompanhe o status de cada iniciativa.
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 text-sm text-white/80 lg:items-end">
            <div className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
              {filteredCount === 1 ? "1 projeto visível" : `${filteredCount} projetos visíveis`}
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-deepGreen transition hover:bg-white/90"
            >
              Novo projeto
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">Filtros principais</p>
            <p className="text-sm text-gray-600">Status, cliente e busca.</p>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-sm font-semibold text-terracota underline-offset-2 transition hover:underline"
          >
            Limpar filtros
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold text-gray-600">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ProjectStatus | "all")}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"
            >
              {STATUS_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600">
            Cliente
            <select
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"
            >
              <option value="all">Todos os clientes</option>
              {clientOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-gray-600 lg:col-span-1 md:col-span-2">
            Buscar
            <div className="relative mt-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4">
                  <path
                    d="m19 19-4-4m1-6a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Busque por projeto ou responsável"
                className="w-full rounded-lg border border-gray-300 bg-white px-9 py-2 text-sm text-gray-900 placeholder:text-gray-400 outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"
              />
            </div>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-lg font-semibold text-gray-900">Projetos</p>
            <p className="text-sm text-gray-600">
              {projectsState.status === "loading" && projectsState.items.length === 0
                ? "Carregando projetos..."
                : `${filteredCount} ${filteredCount === 1 ? "resultado" : "resultados"}`}
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {projectsState.status === "error" ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
              {projectsState.message}
            </p>
          ) : null}

          {projectsState.status === "loaded" && filteredItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
              Nenhum projeto encontrado com os filtros atuais.
            </div>
          ) : null}

          {filteredItems.length > 0 ? (
            <div className="space-y-4">
              {filteredItems.map((project) => {
                const statusDefinition = PROJECT_STATUS_OPTIONS.find((option) => option.value === project.status);
                const statusTone =
                  PROJECT_STATUS_STYLES[project.status] ?? "border-gray-200 bg-gray-50 text-gray-700";
                const ownerName = project.ownerId
                  ? memberLookup.get(project.ownerId)?.name ?? project.ownerId
                  : "Responsável não definido";
                const periodLabel = `${formatDate(project.startDate)} · ${formatDate(project.endDate)}`;
                const updatedLabel = new Date(project.updatedAt).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short"
                });

                return (
                  <article
                    key={project.id}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-wide text-gray-500">Projeto</p>
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        <p className="text-sm text-gray-600">
                          {resolveClientName(project.clientId)} · Atualizado em {updatedLabel}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone}`}
                        >
                          {statusDefinition?.label ?? project.status}
                        </span>
                        <div className="flex flex-wrap justify-end gap-2 text-xs font-semibold">
                          <button
                            type="button"
                            onClick={() => handleOpenFocus(project)}
                            className="inline-flex items-center rounded-full bg-deepGreen px-3 py-1 text-white transition hover:bg-deepGreen/90"
                          >
                            Modo Focus
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenProjectTaskModal(project)}
                            className="inline-flex items-center rounded-full border border-deepGreen/30 px-3 py-1 text-deepGreen transition hover:border-deepGreen/60"
                          >
                            Criar tarefa
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(project)}
                            className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-gray-700 transition hover:border-gray-400"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchive(project)}
                            className="inline-flex items-center rounded-full border border-terracota/40 px-3 py-1 text-terracota transition hover:border-terracota/60"
                          >
                            Arquivar
                          </button>
                          <Link
                            href={{ pathname: "/tasks", query: { projectId: project.id } }}
                            className="inline-flex items-center rounded-full border border-gray-200 px-3 py-1 text-gray-700 transition hover:border-gray-400"
                          >
                            Ver tarefas
                          </Link>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 text-sm text-gray-600 md:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Responsável</p>
                        <p className="font-medium text-gray-900">{ownerName}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Período</p>
                        <p className="font-medium text-gray-900">{periodLabel}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Budget</p>
                        <p className="font-medium text-gray-900">{formatCurrency(project.budget)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500">Última atualização</p>
                        <p className="font-medium text-gray-900">{updatedLabel}</p>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </div>
      </section>

      <ProjectFormModal
        isOpen={isModalOpen}
        state={formState}
        clients={clientOptions}
        members={memberOptions}
        onChange={handleFormChange}
        onSubmit={handleSubmit}
        onClose={closeModal}
        isSaving={isSaving}
        error={formError}
        mode={formMode}
      />
      <ProjectTaskModal
        open={taskModalOpen}
        project={taskModalProject}
        form={taskForm}
        members={memberOptions}
        state={taskModalState}
        feedback={taskModalFeedback}
        onClose={handleCloseProjectTaskModal}
        onChange={handleTaskFormChange}
        onSubmit={handleProjectTaskSubmit}
      />
      <ProjectFocusPanel
        project={focusProject}
        clientName={focusProject ? resolveClientName(focusProject.clientId) : null}
        ownerName={
          focusProject?.ownerId ? memberLookup.get(focusProject.ownerId)?.name ?? "Responsável não definido" : null
        }
        tasks={focusTasks}
        state={focusState}
        error={focusError}
        onClose={handleCloseFocus}
        onCreateTask={focusProject ? () => handleOpenProjectTaskModal(focusProject) : undefined}
        onEdit={focusProject ? () => openEditModal(focusProject) : undefined}
        onRefreshTasks={handleRefreshFocusTasks}
      />
    </div>
  );
}

type ProjectTaskModalProps = {
  open: boolean;
  project: Project | null;
  form: ProjectTaskForm;
  members: Array<{ id: string; name: string; role: string | null }>;
  state: "idle" | "saving";
  feedback: string | null;
  onClose: () => void;
  onChange: (field: keyof ProjectTaskForm, value: string | string[] | ProjectTaskForm["checklist"]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function ProjectTaskModal({
  open,
  project,
  form,
  members,
  state,
  feedback,
  onClose,
  onChange,
  onSubmit
}: ProjectTaskModalProps): JSX.Element | null {
  if (!open || !project) {
    return null;
  }

  const handleAssigneesChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(event.target.selectedOptions).map((option) => option.value);
    onChange("assignees", values);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4 py-6">
      <div className="w-full max-w-xl rounded-[32px] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Projeto</p>
            <h2 className="text-2xl font-semibold text-deepGreen">{project.name}</h2>
            <p className="text-sm text-deepGreen/60">Crie uma tarefa diretamente deste projeto.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-deepGreen/20 px-3 py-1 text-xs font-semibold text-deepGreen hover:border-deepGreen/50"
          >
            Fechar
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="text-sm font-semibold text-deepGreen">
            Nome da tarefa *
            <input
              type="text"
              value={form.title}
              onChange={(event) => onChange("title", event.target.value)}
              className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-4 py-2 text-sm"
              placeholder="Ex.: Revisar criativos"
              required
            />
          </label>

          <label className="text-sm font-semibold text-deepGreen">
            Tipo
            <select
              value={form.type}
              onChange={(event) => onChange("type", event.target.value)}
              className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-4 py-2 text-sm"
            >
              {TASK_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-semibold text-deepGreen">
              Prazo
              <input
                type="date"
                value={form.dueDate}
                onChange={(event) => onChange("dueDate", event.target.value)}
                className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-4 py-2 text-sm"
              />
            </label>
            <label className="text-sm font-semibold text-deepGreen">
              Responsáveis
              <select
                multiple
                value={form.assignees}
                onChange={handleAssigneesChange}
                className="mt-1 w-full min-h-[120px] rounded-2xl border border-deepGreen/20 px-4 py-2 text-sm"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
              <span className="text-xs text-deepGreen/60">Use Ctrl/Cmd para selecionar mais de um.</span>
            </label>
          </div>

          <label className="text-sm font-semibold text-deepGreen">
            Contexto rápido
            <textarea
              value={form.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-4 py-2 text-sm"
              placeholder="Detalhes para quem vai executar..."
            />
            <span className="text-xs text-deepGreen/60">Status inicia como &quot;A fazer&quot;.</span>
          </label>

          <div className="space-y-2 rounded-2xl border border-deepGreen/10 bg-deepGreen/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-deepGreen">Checklist (opcional)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={form.checklistInput}
                onChange={(event) => onChange("checklistInput", event.target.value)}
                placeholder="Adicionar item"
                className="flex-1 min-w-[200px] rounded-xl border border-deepGreen/20 px-3 py-2 text-sm focus:border-deepGreen focus:outline-none"
                disabled={state === "saving"}
              />
              <button
                type="button"
                onClick={() => {
                  const value = form.checklistInput.trim();
                  if (!value) {
                    return;
                  }
                  const nextItem = {
                    id: globalThis.crypto?.randomUUID?.() ?? Date.now().toString(),
                    label: value,
                    done: false
                  };
                  onChange("checklist", [...form.checklist, nextItem]);
                  onChange("checklistInput", "");
                }}
                disabled={state === "saving"}
                className="rounded-full bg-deepGreen px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-deepGreen/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Adicionar
              </button>
            </div>
            {form.checklist.length > 0 ? (
              <ul className="space-y-2">
                {form.checklist.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-deepGreen/10 bg-white px-3 py-2"
                  >
                    <span className="text-sm text-deepGreen">
                      {index + 1}. {item.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => onChange("checklist", form.checklist.filter((entry) => entry.id !== item.id))}
                      disabled={state === "saving"}
                      className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-60"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-deepGreen/70">Nenhum item adicionado.</p>
            )}
          </div>

          {feedback ? <p className="text-sm text-rose-600">{feedback}</p> : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-deepGreen/20 px-5 py-2 text-sm font-semibold text-deepGreen hover:border-deepGreen/40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={state === "saving"}
              className="rounded-full bg-deepGreen px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "saving" ? "Criando..." : "Criar tarefa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

type ProjectFocusPanelProps = {
  project: Project | null;
  clientName: string | null;
  ownerName: string | null;
  tasks: TaskEntity[];
  state: "idle" | "loading" | "loaded" | "error";
  error: string | null;
  onClose: () => void;
  onCreateTask?: () => void;
  onEdit?: () => void;
  onRefreshTasks: () => void;
};

function ProjectFocusPanel({
  project,
  clientName,
  ownerName,
  tasks,
  state,
  error,
  onClose,
  onCreateTask,
  onEdit,
  onRefreshTasks
}: ProjectFocusPanelProps): JSX.Element | null {
  if (!project) {
    return null;
  }

  const formatDate = (value: string | null) =>
    value ? new Date(value).toLocaleDateString("pt-BR") : "Sem data";

  const formatCurrency = (value: number | null) =>
    value === null || value === undefined
      ? "-"
      : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

  const periodLabel = `${formatDate(project.startDate)} → ${formatDate(project.endDate)}`;

  return (
    <aside className="fixed inset-y-0 right-0 z-30 w-full max-w-lg border-l border-slate-200 bg-white shadow-2xl">
      <div className="flex h-full flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Modo Focus</p>
            <h2 className="text-xl font-semibold text-slate-900">{project.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">
            <p className="mb-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold">
                {PROJECT_STATUS_OPTIONS.find((option) => option.value === project.status)?.label ??
                  project.status}
              </span>
              <span className="text-xs text-slate-500">
                Atualizado em {new Date(project.updatedAt).toLocaleString("pt-BR")}
              </span>
            </p>
            <p>
              Cliente: <span className="font-semibold">{clientName ?? "Não informado"}</span>
            </p>
            <p>
              Responsável: <span className="font-semibold">{ownerName ?? "Sem responsável"}</span>
            </p>
            <p>Período: {periodLabel}</p>
            <p>Budget: {formatCurrency(project.budget)}</p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Notas do projeto</h3>
            <p className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
              {project.notes?.trim()
                ? renderTextWithLinks(project.notes)
                : "Sem notas registradas para este projeto."}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {onCreateTask ? (
              <button
                type="button"
                onClick={onCreateTask}
                className="inline-flex items-center rounded-full bg-deepGreen px-4 py-2 text-sm font-semibold text-white hover:bg-deepGreen/90"
              >
                Criar tarefa
              </button>
            ) : null}
            {onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center rounded-full border border-deepGreen/30 px-4 py-2 text-sm font-semibold text-deepGreen hover:border-deepGreen/60"
              >
                Editar projeto
              </button>
            ) : null}
            <Link
              href={`/tasks?projectId=${project.id}`}
              className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500"
            >
              Ver no módulo de tarefas
            </Link>
            <Link
              href={`/calendar?projectId=${project.id}`}
              className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-slate-500"
            >
              Abrir calendário
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Tarefas ligadas</h3>
              <button
                type="button"
                onClick={onRefreshTasks}
                className="text-xs font-semibold text-deepGreen hover:underline"
              >
                Atualizar lista
              </button>
            </div>
            {state === "loading" ? (
              <p className="text-sm text-slate-500">Carregando tarefas do projeto...</p>
            ) : state === "error" ? (
              <p className="text-sm text-rose-600">{error}</p>
            ) : tasks.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma tarefa encontrada para este projeto.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.slice(0, 5).map((task) => (
                  <li key={task.id} className="rounded-2xl border border-slate-200 px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
                          TASK_STATUS_STYLES[task.status]
                        }`}
                      >
                        {TASK_STATUS_LABELS[task.status]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {task.dueDate ? `Prazo: ${new Date(task.dueDate).toLocaleDateString("pt-BR")}` : "Sem prazo"}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {tasks.length > 5 ? (
              <p className="text-xs text-slate-500">
                Mostrando 5 de {tasks.length} tarefas. Abra o módulo de tarefas para ver todas.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </aside>
  );
}
