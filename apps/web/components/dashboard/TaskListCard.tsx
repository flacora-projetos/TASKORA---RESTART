'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, TASK_STATUS_STYLES } from "../../constants/tasks";
import { apiFetch, ApiError } from "../../lib/api";
import type { ProjectSummary } from "../../types/projects";
import type { TaskEntity, TaskStatus } from "../../types/tasks";
import type { TeamMember } from "../../types/team";
import { useAuth } from "../auth/AuthProvider";

const INTEGRATION_LABELS: Record<"google" | "meta" | "other", string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  other: "Outros"
};

const SYNC_STATUS_LABELS = {
  disconnected: "Desvinculado",
  pending: "Em atualizacao",
  synced: "Sincronizado",
  error: "Erro"
};

const FILTER_OPTIONS = [
  { label: "Todas", value: "all" },
  ...TASK_STATUS_ORDER.map((status) => ({ label: TASK_STATUS_LABELS[status], value: status }))
] as const;

type FilterValue = (typeof FILTER_OPTIONS)[number]["value"];

const ALL_PROJECTS_VALUE = "all";
type SelectedProjectId = string | typeof ALL_PROJECTS_VALUE | null;

const getToday = (): string => new Date().toISOString().slice(0, 10);

const formatMinutesLabel = (value: number): string => {
  if (!value || value <= 0) {
    return "0min";
  }
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}min`);
  }
  return parts.join(" ");
};

type ProjectState =
  | { status: "idle"; items: ProjectSummary[] }
  | { status: "loading"; items: ProjectSummary[] }
  | { status: "loaded"; items: ProjectSummary[] }
  | { status: "error"; items: ProjectSummary[]; message: string };

type TaskState =
  | { status: "idle"; items: TaskEntity[] }
  | { status: "loading"; items: TaskEntity[] }
  | { status: "loaded"; items: TaskEntity[] }
  | { status: "error"; items: TaskEntity[]; message: string };

type MutationState =
  | { type: "idle" }
  | { type: "saving"; taskId: string }
  | { type: "creating" };

type HoursModalState =
  | { open: false }
  | {
      open: true;
      task: TaskEntity;
      date: string;
      minutes: string;
      notes: string;
      source: "manual" | "auto";
    };

export function TaskListCard() {
  const { token, status: authStatus } = useAuth();
  const isAuthenticated = authStatus === "authenticated" && Boolean(token);

  const [projectState, setProjectState] = useState<ProjectState>({ status: "idle", items: [] });
  const [taskState, setTaskState] = useState<TaskState>({ status: "idle", items: [] });
  const [selectedProjectId, setSelectedProjectId] = useState<SelectedProjectId>(ALL_PROJECTS_VALUE);
  const [filter, setFilter] = useState<FilterValue>("all");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [mutationState, setMutationState] = useState<MutationState>({ type: "idle" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [hoursSummary, setHoursSummary] = useState<Record<string, number>>({});
  const [hoursModal, setHoursModal] = useState<HoursModalState>({ open: false });
  const [hoursSaving, setHoursSaving] = useState(false);
  const [hoursFeedback, setHoursFeedback] = useState<string | null>(null);
  const [teamDirectory, setTeamDirectory] = useState<Record<string, string>>({});

  const projectLookup = useMemo(() => {
    const map = new Map<string, string>();
    projectState.items.forEach((project) => {
      map.set(project.id, project.name);
    });
    return map;
  }, [projectState.items]);

  const fetchProjects = useCallback(
    async (currentToken: string) => {
      const response = await apiFetch<{ items: ProjectSummary[] }>("/projects", {
        token: currentToken
      });
      return response.items;
    },
    []
  );

  const fetchTasksByProject = useCallback(
    async (projectId: string, currentToken: string) => {
      const response = await apiFetch<{ items: TaskEntity[] }>(`/projects/${projectId}/tasks`, {
        token: currentToken,
        query: filter === "all" ? undefined : { status: filter }
      });
      return response.items;
    },
    [filter]
  );

  const fetchAllProjectTasks = useCallback(
    async (projectIds: string[], currentToken: string) => {
      if (projectIds.length === 0) {
        return [];
      }
      const results = await Promise.all(projectIds.map((id) => fetchTasksByProject(id, currentToken)));
      return results.flat();
    },
    [fetchTasksByProject]
  );

  const fetchHoursSummaryByProject = useCallback(
    async (projectId: string, currentToken: string) => {
      const response = await apiFetch<{ totals: Record<string, number> }>("/time-entries/summary", {
        token: currentToken,
        query: { projectId }
      });
      setHoursSummary(response.totals ?? {});
    },
    []
  );

  const fetchHoursSummaryForProjects = useCallback(
    async (projectIds: string[], currentToken: string) => {
      if (projectIds.length === 0) {
        setHoursSummary({});
        return;
      }
      const results = await Promise.all(
        projectIds.map(async (projectId) => {
          const response = await apiFetch<{ totals: Record<string, number> }>("/time-entries/summary", {
            token: currentToken,
            query: { projectId }
          });
          return response.totals ?? {};
        })
      );
      const merged: Record<string, number> = {};
      results.forEach((totals) => {
        Object.assign(merged, totals);
      });
      setHoursSummary(merged);
    },
    []
  );

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setProjectState({ status: "idle", items: [] });
      setSelectedProjectId(null);
      return;
    }

    let isMounted = true;
    setProjectState((prev) => ({ ...prev, status: "loading" }));

    fetchProjects(token)
      .then((items) => {
        if (!isMounted) {
          return;
        }
        setProjectState({ status: "loaded", items });
        setSelectedProjectId((current) => {
          if (current === ALL_PROJECTS_VALUE) {
            return current;
          }
          if (current && items.some((project) => project.id === current)) {
            return current;
          }
          return ALL_PROJECTS_VALUE;
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof ApiError ? error.message : "Não foi possivel carregar os projetos.";
        setProjectState({ status: "error", items: [], message });
      });

    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated, fetchProjects]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setTeamDirectory({});
      return;
    }

    let isMounted = true;

    apiFetch<{ items: TeamMember[] }>("/team/members", {
      token,
      query: { status: "active" }
    })
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const directory: Record<string, string> = {};
        response.items.forEach((member) => {
          directory[member.id] = member.name;
          if (member.userId) {
            directory[member.userId] = member.name;
          }
        });
        setTeamDirectory(directory);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setTeamDirectory({});
      });

    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (!token || !isAuthenticated || !selectedProjectId) {
      setTaskState({ status: "idle", items: [] });
      return;
    }
    if (selectedProjectId === ALL_PROJECTS_VALUE && projectState.items.length === 0) {
      setTaskState({ status: "idle", items: [] });
      return;
    }

    let isMounted = true;
    setTaskState((prev) => ({ ...prev, status: "loading" }));

    const activeProjectIds =
      selectedProjectId === ALL_PROJECTS_VALUE ? projectState.items.map((project) => project.id) : [selectedProjectId];

    const loader =
      selectedProjectId === ALL_PROJECTS_VALUE
        ? fetchAllProjectTasks(activeProjectIds, token)
        : fetchTasksByProject(selectedProjectId, token);

    loader
      .then((items) => {
        if (!isMounted) {
          return;
        }
        setTaskState({ status: "loaded", items });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof ApiError ? error.message : "Não foi possivel carregar as tarefas.";
        setTaskState({ status: "error", items: [], message });
      });

    return () => {
      isMounted = false;
    };
  }, [
    token,
    isAuthenticated,
    selectedProjectId,
    fetchTasksByProject,
    fetchAllProjectTasks,
    projectState.items
  ]);

  useEffect(() => {
    if (!token || !isAuthenticated || !selectedProjectId) {
      setHoursSummary({});
      return;
    }
    if (selectedProjectId === ALL_PROJECTS_VALUE && projectState.items.length === 0) {
      setHoursSummary({});
      return;
    }
    if (selectedProjectId === ALL_PROJECTS_VALUE) {
      const ids = projectState.items.map((project) => project.id);
      fetchHoursSummaryForProjects(ids, token).catch(() => setHoursSummary({}));
      return;
    }
    fetchHoursSummaryByProject(selectedProjectId, token).catch(() => setHoursSummary({}));
  }, [
    token,
    isAuthenticated,
    selectedProjectId,
    fetchHoursSummaryByProject,
    fetchHoursSummaryForProjects,
    projectState.items
  ]);

  const tasksPreview = useMemo(() => {
    if (taskState.items.length === 0) {
      return [];
    }

    const sorted = [...taskState.items].sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (a.dueDate) {
        return -1;
      }
      if (b.dueDate) {
        return 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return sorted.slice(0, 6);
  }, [taskState.items]);

  const handleReloadTasks = useCallback(async () => {
    if (!token || !isAuthenticated || !selectedProjectId) {
      return;
    }
    const projectIds =
      selectedProjectId === ALL_PROJECTS_VALUE ? projectState.items.map((project) => project.id) : [selectedProjectId];
    setTaskState((prev) => ({ ...prev, status: "loading" }));
    try {
      const items =
        selectedProjectId === ALL_PROJECTS_VALUE
          ? await fetchAllProjectTasks(projectIds, token)
          : await fetchTasksByProject(selectedProjectId, token);
      setTaskState({ status: "loaded", items });
      if (selectedProjectId === ALL_PROJECTS_VALUE) {
        await fetchHoursSummaryForProjects(projectIds, token);
      } else {
        await fetchHoursSummaryByProject(selectedProjectId, token);
      }
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Nao foi possivel atualizar as tarefas.";
      setTaskState({ status: "error", items: [], message });
    }
  }, [
    token,
    isAuthenticated,
    selectedProjectId,
    fetchAllProjectTasks,
    fetchTasksByProject,
    fetchHoursSummaryByProject,
    fetchHoursSummaryForProjects,
    projectState.items
  ]);

  const openHoursModal = useCallback((task: TaskEntity, source: "manual" | "auto") => {
    setHoursFeedback(null);
    setHoursSaving(false);
    setHoursModal({
      open: true,
      task,
      date: getToday(),
      minutes: "",
      notes: "",
      source
    });
  }, []);

  const closeHoursModal = useCallback(() => {
    setHoursFeedback(null);
    setHoursSaving(false);
    setHoursModal({ open: false });
  }, []);

  const updateHoursModalField = (field: "date" | "minutes" | "notes", value: string) => {
    setHoursModal((prev) => {
      if (!prev.open) {
        return prev;
      }
      return { ...prev, [field]: value };
    });
  };

  const handleHoursSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hoursModal.open || !token) {
      return;
    }
    const projectId = hoursModal.task.projectId;
    if (!projectId) {
      setHoursFeedback("Associe a tarefa a um projeto para registrar horas.");
      return;
    }
    const parsedMinutes = Number(hoursModal.minutes);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
      setHoursFeedback("Informe um total de minutos maior que zero.");
      return;
    }

    setHoursSaving(true);
    setHoursFeedback(null);

    try {
      await apiFetch("/time-entries", {
        token,
        method: "POST",
        body: {
          projectId,
          taskId: hoursModal.task.id,
          date: hoursModal.date,
          reportedMinutes: parsedMinutes,
          notes: hoursModal.notes.trim() ? hoursModal.notes.trim() : undefined
        }
      });
      await handleReloadTasks();
      closeHoursModal();
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Nao foi possivel registrar as horas.";
      setHoursFeedback(message);
    } finally {
      setHoursSaving(false);
    }
  };

  const handleStatusChange = async (task: TaskEntity, nextStatus: TaskStatus) => {
    if (!token || !task.projectId) {
      return;
    }
    setFeedback(null);
    setMutationState({ type: "saving", taskId: task.id });
    try {
      await apiFetch(`/projects/${task.projectId}/tasks/${task.id}`, {
        token,
        method: "PUT",
        body: { status: nextStatus }
      });
      await handleReloadTasks();
      if (nextStatus === "done") {
        openHoursModal(task, "auto");
      }
      setMutationState({ type: "idle" });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Nao foi possivel atualizar a tarefa.";
      setFeedback(message);
      setMutationState({ type: "idle" });
    }
  };

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !selectedProjectId || selectedProjectId === ALL_PROJECTS_VALUE || !newTaskTitle.trim()) {
      if (selectedProjectId === ALL_PROJECTS_VALUE) {
        setFeedback("Selecione um projeto especifico para criar uma tarefa.");
      }
      return;
    }
    setFeedback(null);
    setMutationState({ type: "creating" });

    try {
      await apiFetch(`/projects/${selectedProjectId}/tasks`, {
        token,
        method: "POST",
        body: {
          title: newTaskTitle.trim(),
          status: filter === "all" ? "todo" : filter
        }
      });
      setNewTaskTitle("");
      await handleReloadTasks();
      setMutationState({ type: "idle" });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possivel criar a tarefa.";
      setFeedback(message);
      setMutationState({ type: "idle" });
    }
  };

  const formatDateLabel = (value: string | null) => {
    if (!value) {
      return null;
    }
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short"
    });
    return formatter.format(new Date(value));
  };

  const isLoadingProjects = projectState.status === "loading";
  const hasProjects = projectState.items.length > 0;
  const isLoadingTasks = taskState.status === "loading";
  const showTaskError = taskState.status === "error";
  const isAllProjectsSelected = selectedProjectId === ALL_PROJECTS_VALUE;
  const selectedProject =
    !selectedProjectId || isAllProjectsSelected
      ? null
      : projectState.items.find((item) => item.id === selectedProjectId) ?? null;
  const isCreating = mutationState.type === "creating";

  return (
    <>
      <section className="card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Execucao</p>
          <h2 className="text-xl font-semibold text-deepGreen">Quadro de tarefas</h2>
          {isAllProjectsSelected ? (
            <p className="text-xs text-deepGreen/60">Projeto selecionado: Todos os projetos</p>
          ) : selectedProject ? (
            <p className="text-xs text-deepGreen/60">Projeto selecionado: {selectedProject.name}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-lg border border-deepGreen/20 bg-white px-3 py-2 text-sm text-deepGreen shadow-sm focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
            value={selectedProjectId ?? ""}
            onChange={(event) => setSelectedProjectId(event.target.value || null)}
            disabled={!isAuthenticated || isLoadingProjects || !hasProjects}
          >
            {!hasProjects ? <option value="">Nenhum projeto disponivel</option> : null}
            {hasProjects ? <option value={ALL_PROJECTS_VALUE}>Todos os projetos</option> : null}
            {projectState.items.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleReloadTasks()}
            disabled={!isAuthenticated || !selectedProjectId || isLoadingTasks}
            className="rounded-full border border-deepGreen/20 px-4 py-2 text-xs font-semibold text-deepGreen hover:border-deepGreen/50 disabled:opacity-50"
          >
            Atualizar
          </button>
        </div>
      </div>

      {!isAuthenticated ? (
        <p className="text-sm text-deepGreen/70">
          Autentique-se para consultar as tarefas vinculadas aos projetos.
        </p>
      ) : null}

      {isAuthenticated ? (
        <>
          {projectState.status === "error" ? (
            <p className="text-sm text-red-600">{projectState.message}</p>
          ) : null}

          {!hasProjects && projectState.status === "loaded" ? (
            <p className="text-sm text-deepGreen/70">
              Cadastre um projeto para comecar a planejar tarefas.
            </p>
          ) : null}

          {hasProjects ? (
            <>
              <div className="flex flex-wrap gap-2">
                {FILTER_OPTIONS.map((option) => {
                  const isActive = filter === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setFilter(option.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isActive
                          ? "border-terracota bg-terracota/15 text-terracota"
                          : "border-deepGreen/20 text-deepGreen/70 hover:border-deepGreen/40"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {feedback ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {feedback}
                </div>
              ) : null}

              {showTaskError ? <p className="text-sm text-red-600">{taskState.message}</p> : null}

              {isLoadingTasks ? (
                <p className="text-sm text-deepGreen/70">Carregando tarefas...</p>
              ) : null}

              {!isLoadingTasks && tasksPreview.length === 0 && !showTaskError ? (
                <p className="text-sm text-deepGreen/70">
                  Nenhuma tarefa encontrada para este filtro.
                </p>
              ) : null}

              <ul className="space-y-3">
                {tasksPreview.map((task) => {
                  const isUpdating =
                    mutationState.type === "saving" && mutationState.taskId === task.id;
                  const dueDateLabel = formatDateLabel(task.dueDate);
                  const updatedLabel = formatDateLabel(task.updatedAt) ?? "N/D";
                  const createdLabel = formatDateLabel(task.createdAt) ?? "N/D";
                  const createdById =
                    task.createdById ?? task.activityLog.find((entry) => entry.type === "created")?.actorId ?? null;
                  const createdByLabel =
                    task.createdByName ??
                    (createdById ? teamDirectory[createdById] ?? "Autor desconhecido" : "Autor desconhecido");
                  const loggedMinutes = hoursSummary[task.id] ?? 0;
                  const hasLoggedMinutes = loggedMinutes > 0;
                  const checklistTotal = task.checklist?.length ?? 0;
                  const checklistDone = (task.checklist ?? []).filter((item) => item.done).length;
                  const projectName =
                    projectLookup.get(task.projectId) ??
                    projectState.items.find((project) => project.id === task.projectId)?.name ??
                    null;
                  const assigneeNames =
                    task.assignees.length > 0
                      ? task.assignees
                          .map((assigneeId) => teamDirectory[assigneeId] ?? assigneeId)
                          .join(", ")
                      : null;

                  return (
                    <li
                      key={task.id}
                      className="rounded-xl border border-deepGreen/15 bg-white/70 p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-deepGreen">{task.title}</p>
                          <p className="text-xs text-deepGreen/60">
                            {projectName ? `Projeto: ${projectName}` : "Projeto nao informado"}
                          </p>
                          <p className="text-xs text-deepGreen/60">
                            {assigneeNames ? `Responsaveis: ${assigneeNames}` : "Sem responsaveis"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${TASK_STATUS_STYLES[task.status]}`}
                        >
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-deepGreen/60">
                        {dueDateLabel ? <span>Prazo: {dueDateLabel}</span> : null}
                        <span>Atualizado em {updatedLabel}</span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                            hasLoggedMinutes
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-deepGreen/15 bg-transparent text-deepGreen/50"
                          }`}
                        >
                          {hasLoggedMinutes
                            ? `Horas: ${formatMinutesLabel(loggedMinutes)}`
                            : "Sem horas registradas"}
                        </span>
                        {checklistTotal > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-deepGreen/20 bg-deepGreen/5 px-2 py-0.5 text-[11px] text-deepGreen/70">
                            Checklist: {checklistDone}/{checklistTotal}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-deepGreen/60">
                        <span>Criada em {createdLabel}</span>
                        {createdByLabel ? <span>Por {createdByLabel}</span> : null}
                      </div>

                      {task.integration ? (
                        <p className="mt-1 text-[11px] text-deepGreen/60">
                          Integração: {INTEGRATION_LABELS[task.integration.provider]} -{" "}
                          {SYNC_STATUS_LABELS[task.integration.syncStatus]}
                        </p>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <label className="text-xs text-deepGreen/70">
                          Atualizar status:
                          <select
                            className="ml-2 rounded border border-deepGreen/20 bg-white px-2 py-1 text-xs text-deepGreen"
                            value={task.status}
                            disabled={isUpdating}
                            onChange={(event) =>
                              void handleStatusChange(task, event.target.value as TaskStatus)
                            }
                          >
                            {TASK_STATUS_ORDER.map((status) => (
                              <option key={status} value={status}>
                                {TASK_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => openHoursModal(task, "manual")}
                          className="inline-flex items-center rounded-full border border-deepGreen/20 px-3 py-1 text-xs font-semibold text-deepGreen transition hover:border-deepGreen/50"
                        >
                          Registrar horas
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>

              <form className="mt-4 space-y-2" onSubmit={handleCreateTask}>
                <label className="text-xs font-semibold text-deepGreen">
                  Criar tarefa rapida
                  <input
                    type="text"
                    value={newTaskTitle}
                    onChange={(event) => setNewTaskTitle(event.target.value)}
                    placeholder="Ex.: Enviar relatorio mensal..."
                    className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                    disabled={isCreating}
                  />
                </label>
                {isAllProjectsSelected ? (
                  <p className="text-xs text-amber-600">
                    Selecione um projeto especifico para criar novas tarefas.
                  </p>
                ) : null}
                <button
                  type="submit"
                  disabled={
                    isCreating || !newTaskTitle.trim() || !selectedProjectId || isAllProjectsSelected
                  }
                  className="inline-flex items-center justify-center rounded-full bg-deepGreen px-5 py-2 text-sm font-semibold text-offWhite shadow shadow-deepGreen/40 transition hover:bg-deepGreen/90 disabled:opacity-60"
                >
                  {isCreating ? "Adicionando..." : "Adicionar tarefa"}
                </button>
              </form>
            </>
          ) : null}
        </>
      ) : null}
      </section>

      {hoursModal.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-offWhite p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Tempo</p>
                <h3 className="text-lg font-semibold text-deepGreen">Registrar horas</h3>
                <p className="text-xs text-deepGreen/60">
                  {hoursModal.source === "auto"
                    ? "Terminou esta tarefa? Adicione o tempo para atualizar o banco de horas."
                    : "Informe rapidamente quanto tempo voce dedicou nesta tarefa."}
                </p>
              </div>
              <button
                type="button"
                onClick={closeHoursModal}
                className="rounded-full border border-deepGreen/20 px-3 py-1 text-xs font-semibold text-deepGreen hover:border-deepGreen/40"
              >
                Fechar
              </button>
            </div>

            <form className="mt-4 space-y-4" onSubmit={handleHoursSubmit}>
              <div>
                <p className="text-sm font-semibold text-deepGreen">{hoursModal.task.title}</p>
                <p className="text-xs text-deepGreen/60">
                  Projeto:{" "}
                  {projectState.items.find((project) => project.id === hoursModal.task.projectId)?.name ??
                    selectedProject?.name ??
                    (isAllProjectsSelected ? "Projeto da tarefa" : "Projeto selecionado")}
                </p>
              </div>

              <label className="block text-xs font-semibold text-deepGreen">
                Data
                <input
                  type="date"
                  value={hoursModal.date}
                  onChange={(event) => updateHoursModalField("date", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                  max={getToday()}
                />
              </label>

              <label className="block text-xs font-semibold text-deepGreen">
                Minutos trabalhados
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={hoursModal.minutes}
                  onChange={(event) => updateHoursModalField("minutes", event.target.value)}
                  placeholder="Ex.: 60"
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                />
              </label>

              <label className="block text-xs font-semibold text-deepGreen">
                Notas (opcional)
                <textarea
                  value={hoursModal.notes}
                  onChange={(event) => updateHoursModalField("notes", event.target.value)}
                  placeholder="Resumo do trabalho realizado..."
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                  rows={3}
                />
              </label>

              {hoursFeedback ? (
                <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {hoursFeedback}
                </p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeHoursModal}
                  className="rounded-full border border-deepGreen/20 px-4 py-2 text-xs font-semibold text-deepGreen hover:border-deepGreen/40"
                  disabled={hoursSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={hoursSaving}
                  className="rounded-full bg-deepGreen px-5 py-2 text-xs font-semibold text-offWhite shadow shadow-deepGreen/30 transition hover:bg-deepGreen/90 disabled:opacity-60"
                >
                  {hoursSaving ? "Registrando..." : "Registrar horas"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
