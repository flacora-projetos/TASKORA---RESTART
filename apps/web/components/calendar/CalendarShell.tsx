'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, TASK_STATUS_STYLES } from "../../constants/tasks";
import { apiFetch, ApiError } from "../../lib/api";
import type { ClientSummary } from "../../types/clients";
import type { ProjectSummary } from "../../types/projects";
import type { TaskEntity, TaskStatus } from "../../types/tasks";
import type { TeamMember } from "../../types/team";
import { useAuth } from "../auth/AuthProvider";

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
type ClientState =
  | { status: "idle"; items: ClientSummary[] }
  | { status: "loading"; items: ClientSummary[] }
  | { status: "loaded"; items: ClientSummary[] }
  | { status: "error"; items: ClientSummary[]; message: string };

type FilterValue = TaskStatus | "all";
type SelectedProjectId = string | typeof ALL_PROJECTS_VALUE | null;
type CalendarTask = TaskEntity & { displayAssignees: string[] };

const STATUS_FILTERS = [
  { label: "Todas", value: "all" },
  ...TASK_STATUS_ORDER.map((status) => ({ label: TASK_STATUS_LABELS[status], value: status }))
] as const;

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long"
});

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short"
});

const STATUS_PRIORITY = TASK_STATUS_ORDER.reduce(
  (acc, status, index) => {
    acc[status] = index;
    return acc;
  },
  {} as Record<TaskStatus, number>
);

const SAO_PAULO_OFFSET = "-03:00";
const ALL_PROJECTS_VALUE = "all";

function normalizeDate(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getWeekStart(date: Date): Date {
  const base = normalizeDate(date);
  const day = base.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setDate(base.getDate() + diff);
  return base;
}

function buildWeekDays(offset: number): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (offset !== 0) {
    today.setDate(today.getDate() + offset * 7);
  }
  const start = getWeekStart(today);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDueDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(`${year}-${month}-${day}T00:00:00${SAO_PAULO_OFFSET}`);
    return Number.isNaN(parsed.getTime()) ? null : normalizeDate(parsed);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : normalizeDate(parsed);
}

function sortByStatus(taskA: TaskEntity, taskB: TaskEntity): number {
  const priorityDiff = STATUS_PRIORITY[taskA.status] - STATUS_PRIORITY[taskB.status];
  if (priorityDiff !== 0) {
    return priorityDiff;
  }
  const titleA = taskA.title.toLowerCase();
  const titleB = taskB.title.toLowerCase();
  if (titleA < titleB) {
    return -1;
  }
  if (titleA > titleB) {
    return 1;
  }
  return taskA.id.localeCompare(taskB.id);
}

function formatDayLabel(date: Date): string {
  const weekday = WEEKDAY_FORMATTER.format(date);
  const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capitalizedWeekday}, ${DAY_MONTH_FORMATTER.format(date)}`;
}

function formatPeriodLabel(start: Date | null, end: Date | null): string {
  if (!start || !end) {
    return "--";
  }
  const startLabel = DAY_MONTH_FORMATTER.format(start);
  const endLabel = DAY_MONTH_FORMATTER.format(end);
  const yearLabel =
    start.getFullYear() === end.getFullYear()
      ? `${start.getFullYear()}`
      : `${start.getFullYear()}-${end.getFullYear()}`;
  return `${startLabel} - ${endLabel} ${yearLabel}`;
}

function formatUpdateLabel(value: string | null): string {
  if (!value) {
    return "--";
  }
  const parsed = parseDueDate(value);
  return parsed ? DAY_MONTH_FORMATTER.format(parsed) : "--";
}

export function CalendarShell(): JSX.Element {
  const { token, status: authStatus } = useAuth();
  const isAuthenticated = authStatus === "authenticated" && Boolean(token);
  const projectSelectId = "calendar-project-select";

  const [projectState, setProjectState] = useState<ProjectState>({ status: "idle", items: [] });
  const [taskState, setTaskState] = useState<TaskState>({ status: "idle", items: [] });
  const [clientState, setClientState] = useState<ClientState>({ status: "idle", items: [] });
  const [selectedProjectId, setSelectedProjectId] = useState<SelectedProjectId>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | "all" | null>(null);
  const [statusFilter, setStatusFilter] = useState<FilterValue>("all");
  const [weekOffset, setWeekOffset] = useState(0);
  const [teamDirectory, setTeamDirectory] = useState<Map<string, string>>(new Map());
  const [expandedOutside, setExpandedOutside] = useState(false);
  const [outsideSearch, setOutsideSearch] = useState("");
  const [dayExpanded, setDayExpanded] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<CalendarTask | null>(null);

  const fetchProjects = useCallback(async (currentToken: string) => {
    const response = await apiFetch<{ items: ProjectSummary[] }>("/projects", {
      token: currentToken
    });
    return response.items;
  }, []);

  const fetchClients = useCallback(async (currentToken: string) => {
    const response = await apiFetch<{ items: ClientSummary[] }>("/clients", {
      token: currentToken
    });
    return response.items;
  }, []);

  const fetchTasks = useCallback(async (projectId: string, currentToken: string) => {
    const response = await apiFetch<{ items: TaskEntity[] }>(`/projects/${projectId}/tasks`, {
      token: currentToken
    });
    return response.items;
  }, []);

  const fetchTasksForProjects = useCallback(
    async (projectIds: string[], currentToken: string) => {
      if (projectIds.length === 0) {
        return [];
      }
      const results = await Promise.all(projectIds.map((projectId) => fetchTasks(projectId, currentToken)));
      return results.flat();
    },
    [fetchTasks]
  );

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setTeamDirectory(new Map());
      return;
    }

    apiFetch<{ items: TeamMember[] }>("/team/members", { token })
      .then((response) => {
        const map = new Map<string, string>();
        response.items.forEach((member) => {
          if (member.name) {
            map.set(member.id, member.name);
          }
          if (member.userId) {
            map.set(member.userId, member.name);
          }
          if (member.email) {
            map.set(member.email.toLowerCase(), member.name);
          }
        });
        setTeamDirectory(map);
      })
      .catch(() => {
        setTeamDirectory(new Map());
      });
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setProjectState({ status: "idle", items: [] });
      setClientState({ status: "idle", items: [] });
      setSelectedProjectId(null);
      setSelectedClientId(null);
      return;
    }

    let isMounted = true;
    setProjectState((prev) => ({ ...prev, status: "loading" }));
    setClientState((prev) => ({ ...prev, status: "loading" }));

    Promise.all([fetchProjects(token), fetchClients(token)])
      .then(([projects, clients]) => {
        if (!isMounted) {
          return;
        }
        setProjectState({ status: "loaded", items: projects });
        setClientState({ status: "loaded", items: clients });
        setSelectedProjectId((current) => {
          if (current === ALL_PROJECTS_VALUE) {
            return current;
          }
          if (current && projects.some((project) => project.id === current)) {
            return current;
          }
          if (projects.length === 0) {
            return null;
          }
          return ALL_PROJECTS_VALUE;
        });
        setSelectedClientId((current) => {
          if (current === "all") {
            return current;
          }
          if (current && clients.some((client) => client.id === current)) {
            return current;
          }
          return "all";
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        const message = error instanceof ApiError ? error.message : "Nao foi possivel carregar os projetos.";
        setProjectState({ status: "error", items: [], message });
        setClientState({
          status: "error",
          items: [],
          message: error instanceof ApiError ? error.message : "Nao foi possivel carregar os clientes."
        });
      });

    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated, fetchProjects, fetchClients]);

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
    setTaskState({ status: "loading", items: [] });

    const projectIds =
      selectedProjectId === ALL_PROJECTS_VALUE ? projectState.items.map((project) => project.id) : [selectedProjectId];

    const loader =
      selectedProjectId === ALL_PROJECTS_VALUE
        ? fetchTasksForProjects(projectIds, token)
        : fetchTasks(selectedProjectId, token);

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
        const message = error instanceof ApiError ? error.message : "Nao foi possivel carregar o calendario.";
        setTaskState({ status: "error", items: [], message });
      });

    return () => {
      isMounted = false;
    };
  }, [token, isAuthenticated, selectedProjectId, fetchTasks, fetchTasksForProjects, projectState.items]);

  const handleReloadTasks = useCallback(async () => {
    if (!token || !isAuthenticated || !selectedProjectId) {
      return;
    }
    if (selectedProjectId === ALL_PROJECTS_VALUE && projectState.items.length === 0) {
      return;
    }

    setTaskState({ status: "loading", items: [] });
    try {
      const projectIds =
        selectedProjectId === ALL_PROJECTS_VALUE
          ? projectState.items.map((project) => project.id)
          : [selectedProjectId];
      const items =
        selectedProjectId === ALL_PROJECTS_VALUE
          ? await fetchTasksForProjects(projectIds, token)
          : await fetchTasks(selectedProjectId, token);
      setTaskState({ status: "loaded", items });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Nao foi possivel atualizar o calendario.";
      setTaskState({ status: "error", items: [], message });
    }
  }, [token, isAuthenticated, selectedProjectId, projectState.items, fetchTasksForProjects, fetchTasks]);

  const projectClientMap = useMemo(() => {
    const map = new Map<string, string>();
    projectState.items.forEach((project) => {
      map.set(project.id, project.clientId);
    });
    return map;
  }, [projectState.items]);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    projectState.items.forEach((project) => {
      map.set(project.id, project.name);
    });
    return map;
  }, [projectState.items]);

  const getProjectName = useCallback(
    (projectId: string | null | undefined): string => {
      if (!projectId) {
        return "Sem projeto";
      }
      return projectNameMap.get(projectId) ?? "Sem projeto";
    },
    [projectNameMap]
  );

  const filteredTasks = useMemo(() => {
    return taskState.items.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) {
        return false;
      }
      if (selectedClientId && selectedClientId !== "all") {
        const clientId = projectClientMap.get(task.projectId);
        if (clientId !== selectedClientId) {
          return false;
        }
      }
      return true;
    });
  }, [taskState.items, statusFilter, selectedClientId, projectClientMap]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: taskState.items.length
    } as Record<FilterValue, number>;
    TASK_STATUS_ORDER.forEach((status) => {
      counts[status] = 0;
    });
    taskState.items.forEach((task) => {
      counts[task.status] = (counts[task.status] ?? 0) + 1;
    });
    return counts;
  }, [taskState.items]);

  const resolveAssigneeName = useCallback(
    (id: string): string => {
      if (!id) {
        return "Sem usuario";
      }
      const lower = id.toLowerCase();
      return (
        teamDirectory.get(id) ??
        teamDirectory.get(lower) ??
        (id.includes("@") ? teamDirectory.get(lower) : undefined) ??
        `Usuario desconhecido (${id})`
      );
    },
    [teamDirectory]
  );

  const tasksWithAssignees = useMemo<CalendarTask[]>(() => {
    return filteredTasks.map((task) => ({
      ...task,
      displayAssignees: task.assignees.map((assignee) => resolveAssigneeName(assignee))
    }));
  }, [filteredTasks, resolveAssigneeName]);

  const weekDays = useMemo(() => buildWeekDays(weekOffset), [weekOffset]);
  const weekStart = weekDays[0] ?? null;
  const weekEnd = weekDays[weekDays.length - 1] ?? null;
  const weekStartTime = weekStart ? weekStart.getTime() : null;
  const weekEndTime = weekEnd ? normalizeDate(new Date(weekEnd)).getTime() : null;

  const calendarGroups = useMemo(() => {
    if (weekStartTime === null || weekEndTime === null) {
      return {
        groups: {} as Record<string, CalendarTask[]>,
        outside: [] as CalendarTask[],
        undated: [] as CalendarTask[]
      };
    }

    const endOfWeek = new Date(weekEndTime);
    endOfWeek.setHours(23, 59, 59, 999);

    const groups: Record<string, CalendarTask[]> = {};
    const outside: CalendarTask[] = [];
    const undated: CalendarTask[] = [];

    tasksWithAssignees.forEach((task) => {
      const due = parseDueDate(task.dueDate);
      if (!due) {
        undated.push(task);
        return;
      }
      const dueTime = due.getTime();
      const key = toDateKey(due);
      if (dueTime >= weekStartTime && dueTime <= endOfWeek.getTime()) {
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(task);
        return;
      }
      outside.push(task);
    });

    Object.keys(groups).forEach((key) => {
      groups[key] = groups[key].sort(sortByStatus);
    });
    outside.sort(sortByStatus);
    undated.sort(sortByStatus);

    return { groups, outside, undated };
  }, [tasksWithAssignees, weekStartTime, weekEndTime]);

  const periodLabel = useMemo(() => formatPeriodLabel(weekStart, weekEnd), [weekStart, weekEnd]);

  const isLoadingProjects = projectState.status === "loading";
  const showProjectError = projectState.status === "error";
  const isLoadingTasks = taskState.status === "loading";
  const showTaskError = taskState.status === "error";
  const hasProjects = projectState.items.length > 0;
  const isAllProjectsSelected = selectedProjectId === ALL_PROJECTS_VALUE;
  const selectedProject =
    !isAllProjectsSelected && selectedProjectId
      ? projectState.items.find((project) => project.id === selectedProjectId) ?? null
      : null;

  const heroHint = isAuthenticated
    ? isAllProjectsSelected
      ? "Mostrando tarefas de todos os projetos desta organizacao."
      : selectedProjectId
        ? "Use o calendario para enxergar o que vence em cada semana."
        : "Selecione um projeto para visualizar os prazos."
    : "Entre com sua conta Taskora para liberar o calendario.";

  const filteredOutside = useMemo(() => {
    if (!expandedOutside) {
      return {
        outside: calendarGroups.outside.slice(0, 10),
        undated: calendarGroups.undated.slice(0, 10)
      };
    }
    const query = outsideSearch.trim().toLowerCase();
    const apply = (items: CalendarTask[]) =>
      query ? items.filter((task) => task.title.toLowerCase().includes(query)) : items;
    return {
      outside: apply(calendarGroups.outside),
      undated: apply(calendarGroups.undated)
    };
  }, [calendarGroups.outside, calendarGroups.undated, expandedOutside, outsideSearch]);

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-gradient-to-br from-terracota to-terracota/70 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-white/70">Calendario</p>
            <h1 className="text-2xl font-semibold leading-tight text-white">
              Planejamento semanal de tarefas
            </h1>
            <p className="text-sm text-white/80">{heroHint}</p>
          </div>
          <div className="grid w-full gap-4 text-sm text-white sm:grid-cols-2 lg:w-auto">
            <div className="rounded-lg border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Projeto atual</p>
              <p className="text-sm font-semibold">
                {isAllProjectsSelected
                  ? "Todos os projetos"
                  : selectedProject
                    ? selectedProject.name
                    : "Selecione um projeto"}
              </p>
            </div>
            <div className="rounded-lg border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Semana exibida</p>
              <p className="text-sm font-semibold">{periodLabel}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-6">
        <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-800" htmlFor={projectSelectId}>
              Projeto
            </label>
            <select
              id={projectSelectId}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-terracota/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
              value={selectedProjectId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setSelectedProjectId(null);
                  return;
                }
                setSelectedProjectId(value === ALL_PROJECTS_VALUE ? ALL_PROJECTS_VALUE : value);
              }}
              disabled={!isAuthenticated || !hasProjects || isLoadingProjects}
            >
              {!selectedProjectId ? (
                <option value="">{isLoadingProjects ? "Carregando..." : "Selecione um projeto"}</option>
              ) : null}
              {hasProjects ? <option value={ALL_PROJECTS_VALUE}>Todos os projetos</option> : null}
              {projectState.items.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-800" htmlFor="calendar-client-select">
              Cliente
            </label>
            <select
              id="calendar-client-select"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-terracota/40 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500"
              value={selectedClientId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  setSelectedClientId(null);
                  return;
                }
                setSelectedClientId(value === "all" ? "all" : value);
              }}
              disabled={clientState.status === "loading" || clientState.items.length === 0}
            >
              {!selectedClientId ? (
                <option value="">{clientState.status === "loading" ? "Carregando..." : "Todos os clientes"}</option>
              ) : null}
              <option value="all">Todos os clientes</option>
              {clientState.items.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-gray-800">Status das tarefas</p>
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((filterOption) => {
                const isActive = statusFilter === filterOption.value;
                return (
                  <button
                    key={filterOption.value}
                    type="button"
                    onClick={() => setStatusFilter(filterOption.value)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40 ${
                      isActive
                        ? "border border-transparent bg-terracota/15 text-terracota"
                        : "border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {filterOption.label} ({statusCounts[filterOption.value] ?? 0})
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setWeekOffset((current) => current - 1)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40 ${
                  weekOffset < 0
                    ? "border border-terracota bg-terracota text-white shadow-sm"
                    : "border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                Semana anterior
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40 ${
                  weekOffset === 0
                    ? "border border-deepGreen bg-deepGreen text-white shadow-sm"
                    : "border border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                Semana atual
              </button>
              <button
                type="button"
                onClick={() => setWeekOffset((current) => current + 1)}
                className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40 ${
                  weekOffset > 0
                    ? "border border-terracota bg-terracota text-white shadow-sm"
                    : "border border-gray-200 text-gray-700 hover-border-gray-300 hover:bg-gray-50"
                }`}
              >
                Proxima semana
              </button>
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              <button
                type="button"
                onClick={() => void handleReloadTasks()}
                disabled={!isAuthenticated || !selectedProjectId || isLoadingTasks}
                className="rounded-full bg-terracota px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-terracota/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
              >
                Atualizar calendario
              </button>
              {isLoadingTasks ? <span className="text-sm text-gray-500">Carregando...</span> : null}
            </div>
          </div>

          {showProjectError ? <p className="text-sm text-red-600">{projectState.message}</p> : null}
          {showTaskError ? <p className="text-sm text-red-600">{taskState.message}</p> : null}
          {!isAuthenticated ? (
            <p className="text-sm text-gray-600">Entre com sua conta Taskora para listar as tarefas.</p>
          ) : null}
          {isAuthenticated && hasProjects && !selectedProjectId ? (
            <p className="text-sm text-gray-600">Selecione um projeto para ver os prazos.</p>
          ) : null}
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {weekDays.map((day) => {
            const dayKey = toDateKey(day);
            const dayTasks = calendarGroups.groups[dayKey] ?? [];
            const showToggle = dayTasks.length > 2;
            const visibleTasks = showToggle ? dayTasks.slice(0, 2) : dayTasks;

            return (
              <div key={dayKey} className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Prazo</p>
                    <p className="text-sm font-semibold text-gray-900">{formatDayLabel(day)}</p>
                  </div>
                  <span className="text-xs font-medium text-gray-500">
                    {dayTasks.length} tarefa{dayTasks.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {dayTasks.length === 0 ? (
                    <p className="text-sm text-gray-500">Sem tarefas com prazo neste dia.</p>
                  ) : (
                    <>
                      <div className="space-y-3">
                        {visibleTasks.map((task) => (
                          <button
                            type="button"
                            key={task.id}
                            onClick={() => setSelectedTask(task)}
                            className="w-full text-left rounded-lg border border-gray-200 bg-gray-50 p-3 transition hover:border-gray-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/30"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="text-sm font-medium text-gray-900">{task.title}</p>
                                <p className="text-xs text-gray-500">
                                  {task.displayAssignees.length > 0
                                    ? `Responsaveis: ${task.displayAssignees.join(", ")}`
                                    : "Sem responsaveis"}
                                </p>
                              </div>
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${TASK_STATUS_STYLES[task.status]}`}
                              >
                                {TASK_STATUS_LABELS[task.status]}
                              </span>
                            </div>
                            <p className="mt-2 text-[11px] text-gray-500">
                              Atualizado em {formatUpdateLabel(task.updatedAt)}
                            </p>
                          </button>
                        ))}
                      </div>
                      {showToggle ? (
                        <button
                          type="button"
                          onClick={() => setDayExpanded(dayKey)}
                          className="w-full rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/30"
                        >
                          Ver todas ({dayTasks.length})
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {calendarGroups.outside.length > 0 || calendarGroups.undated.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Fora da semana</p>
                <p className="text-sm font-semibold text-amber-900">
                  Tarefas com prazo em outras semanas ou sem data definida
                </p>
                <p className="text-xs text-amber-700">
                  {calendarGroups.outside.length + calendarGroups.undated.length} tarefa(s) fora do range exibido
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExpandedOutside((prev) => !prev)}
                className="rounded-full border border-amber-200 bg-white/70 px-3 py-1 text-[11px] font-semibold text-amber-800 transition hover:bg-white"
              >
                {expandedOutside ? "Recolher" : "Expandir"}
              </button>
            </div>
            {expandedOutside ? (
              <div className="mt-3 space-y-3">
                <input
                  type="text"
                  value={outsideSearch}
                  onChange={(event) => setOutsideSearch(event.target.value)}
                  placeholder="Buscar titulo"
                  className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                />
                <ul className="space-y-2">
                  {filteredOutside.outside.map((task) => (
                    <li
                      key={`outside-${task.id}`}
                      className="rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-sm text-amber-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{task.title}</span>
                        <span className="text-xs text-amber-700">Prazo: {formatUpdateLabel(task.dueDate)}</span>
                      </div>
                    </li>
                  ))}
                  {filteredOutside.undated.map((task) => (
                    <li
                      key={`undated-${task.id}`}
                      className="rounded-lg border border-amber-200 bg-white/80 px-3 py-2 text-sm text-amber-900"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{task.title}</span>
                        <span className="text-xs text-amber-700">Sem data definida</span>
                      </div>
                    </li>
                  ))}
                  {filteredOutside.outside.length + filteredOutside.undated.length === 0 ? (
                    <li className="text-xs text-amber-700">Nenhuma tarefa encontrada para a busca.</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {dayExpanded ? (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/50 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Dia</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatDayLabel(new Date(dayExpanded))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDayExpanded(null)}
                className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/30"
              >
                Fechar
              </button>
            </div>
            <div className="mt-4 max-h-[60vh] space-y-2 overflow-auto">
              {(calendarGroups.groups[dayExpanded] ?? []).map((task) => (
                <div key={task.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-600">
                        {task.displayAssignees.length > 0
                          ? `Responsaveis: ${task.displayAssignees.join(", ")}`
                          : "Sem responsaveis"}
                      </p>
                      <p className="text-[11px] text-gray-600">Projeto: {getProjectName(task.projectId)}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${TASK_STATUS_STYLES[task.status]}`}>
                      {TASK_STATUS_LABELS[task.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600">Prazo: {formatUpdateLabel(task.dueDate)}</p>
                  <p className="text-[11px] text-gray-500">Atualizado em {formatUpdateLabel(task.updatedAt)}</p>
                </div>
              ))}
              {(calendarGroups.groups[dayExpanded] ?? []).length === 0 ? (
                <p className="text-sm text-gray-600">Nenhuma tarefa para este dia.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {selectedTask ? (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.25em] text-gray-500">Tarefa</p>
                <p className="text-lg font-semibold text-gray-900">{selectedTask.title}</p>
                <p className="text-xs text-gray-600">
                  {selectedTask.displayAssignees.length > 0
                    ? `Responsaveis: ${selectedTask.displayAssignees.join(", ")}`
                    : "Sem responsaveis"}
                </p>
                <p className="text-xs text-gray-600">
                  Projeto: {projectNameMap.get(selectedTask.projectId) ?? "Sem projeto"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-[11px] font-semibold ${TASK_STATUS_STYLES[selectedTask.status]}`}
                >
                  {TASK_STATUS_LABELS[selectedTask.status]}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTask(null)}
                  className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/30"
                >
                  Fechar
                </button>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-700">
                Prazo: {selectedTask.dueDate ? formatUpdateLabel(selectedTask.dueDate) : "Sem data definida"}
              </p>
              <p className="text-[11px] text-gray-600">
                Atualizado em {formatUpdateLabel(selectedTask.updatedAt)}
              </p>
              {selectedTask.description ? (
                <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm text-gray-800">
                  {selectedTask.description}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
