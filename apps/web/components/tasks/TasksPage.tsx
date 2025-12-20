"use client";

import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TASK_STATUS_LABELS, TASK_STATUS_ORDER, TASK_STATUS_STYLES, TASK_TYPE_OPTIONS } from "../../constants/tasks";
import { apiFetch, ApiError } from "../../lib/api";
import { dateInputToSaoPauloISOString, formatMinutesAsClock } from "../../lib/datetime";
import { renderTextWithLinks } from "../../lib/text";
import type {
  TaskEntity,
  TaskOverviewAssignee,
  TaskOverviewCard,
  TaskOverviewClient,
  TaskOverviewItem,
  TaskOverviewProject,
  TaskOverviewResponse,
  TaskPriorityTag,
  TaskStatus,
  TaskType
} from "../../types/tasks";
import type { TeamMember } from "../../types/team";
import { useAuth } from "../auth/AuthProvider";
import { PushOptInCard } from "../notifications/PushOptInCard";







type OverviewQuickPeriod = "none" | "today" | "week" | "month" | "last7" | "last30" | "custom";







type TasksFiltersState = {



  status: TaskStatus | "all";



  type: TaskType | "all";



  assigneeId: string;



  clientId: string;



  projectId: string;



  platform: string;



  period: OverviewQuickPeriod;



  from: string;



  to: string;



  search: string;



};







const INITIAL_FILTERS: TasksFiltersState = {



  status: "all",



  type: "all",



  assigneeId: "all",



  clientId: "all",



  projectId: "all",



  platform: "all",



  period: "week",



  from: "",



  to: "",



  search: ""



};







const PERIOD_PRESETS: Array<{ value: OverviewQuickPeriod; label: string }> = [



  { value: "today", label: "Hoje" },



  { value: "week", label: "Esta semana" },



  { value: "month", label: "Este mês" },



  { value: "last7", label: "Últimos 7 dias" },



  { value: "last30", label: "Últimos 30 dias" },



  { value: "none", label: "Sem filtro" }



];







const PRIORITY_LABELS: Record<TaskPriorityTag, string> = {



  overdue: "Atrasada",



  due_today: "Hoje",



  upcoming: "Próxima",



  no_due_date: "Sem prazo",



  completed: "Concluída"



};







const PRIORITY_STYLES: Record<TaskPriorityTag, string> = {



  overdue: "bg-rose-100 text-rose-800 border-rose-200",



  due_today: "bg-amber-100 text-amber-900 border-amber-200",



  upcoming: "bg-emerald-100 text-emerald-900 border-emerald-200",



  no_due_date: "bg-slate-100 text-slate-700 border-slate-200",



  completed: "bg-emerald-50 text-emerald-700 border-emerald-100"



};







const PLATFORM_TONES: Record<string, string> = {



  google: "bg-amber-50 text-amber-700 border-amber-200",



  meta: "bg-sky-50 text-sky-700 border-sky-200",



  ga4: "bg-indigo-50 text-indigo-700 border-indigo-200",



  pinterest: "bg-rose-50 text-rose-700 border-rose-200",



  tiktok: "bg-fuchsia-50 text-fuchsia-600 border-fuchsia-200",



  other: "bg-slate-50 text-slate-600 border-slate-200"



};







const ASSIGNEE_COLORS = [



  "bg-emerald-600",



  "bg-amber-600",



  "bg-rose-500",



  "bg-sky-600",



  "bg-indigo-600",



  "bg-stone-600"



];







const DATE_FROM_INPUT_ID = "tasks-filter-from";



const DATE_TO_INPUT_ID = "tasks-filter-to";



const SEARCH_INPUT_ID = "tasks-filter-search";







function convertDateInputToISO(value: string): string | null {



  return dateInputToSaoPauloISOString(value);



}







function formatISOToDateInput(value: string | null): string {



  if (!value) {



    return "";



  }



  return value.slice(0, 10);



}



function getTodayDateInput(): string {



  return new Date().toISOString().slice(0, 10);



}







const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {



  day: "2-digit",



  month: "short"



});







const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {



  day: "2-digit",



  month: "long",



  year: "numeric"



});







type FetchState = "idle" | "loading" | "loaded";







type CreateTaskForm = {



  title: string;



  projectId: string;



  assignees: string[];



  dueDate: string;



  type: TaskType;



  status: TaskStatus;



  notes: string;



  checklist: Array<{ id: string; label: string; done: boolean }>;



  checklistInput: string;



};







const CREATE_TASK_DEFAULT: CreateTaskForm = {



  title: "",



  projectId: "",



  assignees: [],



  dueDate: "",



  type: "other",



  status: "todo",



  notes: "",



  checklist: [],



  checklistInput: ""



};







type FocusEditForm = {



  title: string;



  assignees: string[];



  type: TaskType;



  dueDate: string;



  status: TaskStatus;



  projectId: string;



  description: string;



};



type ProjectOption = TaskOverviewProject & {



  clientName: string | null;



  displayName: string;



};



type HoursFormState = {



  date: string;



  minutes: string;



  notes: string;



};



type ProjectHoursState = Record<

  string,

  {

    status: "idle" | "loading" | "loaded" | "error";

    totals: Record<string, number>;

    message?: string;

  }

>;







export function TasksPage(): JSX.Element {



  const { token, status: authStatus, user } = useAuth();



  const isAuthenticated = authStatus === "authenticated" && Boolean(token);







  const [filters, setFilters] = useState<TasksFiltersState>(INITIAL_FILTERS);
  useEffect(() => {
    const projectIdParam =
      typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("projectId") : null;
    if (!projectIdParam || projectIdParam === "all") {
      return;
    }
    setFilters((prev) => (prev.projectId === projectIdParam ? prev : { ...prev, projectId: projectIdParam }));
  }, []);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setTeamDirectory({});
      return;
    }
    apiFetch<{ items: TeamMember[] }>("/team/members", { token })
      .then((response) => {
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
        setTeamDirectory({});
      });
  }, [isAuthenticated, token]);



  const [searchInput, setSearchInput] = useState("");



  const [overview, setOverview] = useState<TaskOverviewResponse | null>(null);



  const [fetchState, setFetchState] = useState<FetchState>("idle");



  const [error, setError] = useState<string | null>(null);



  const [mutation, setMutation] = useState<{ taskId: string } | null>(null);



  const [quickFeedback, setQuickFeedback] = useState<string | null>(null);



  const [rescheduleTarget, setRescheduleTarget] = useState<{ taskId: string; date: string } | null>(null);



  const [focusTask, setFocusTask] = useState<TaskOverviewItem | null>(null);



  const [focusDetails, setFocusDetails] = useState<TaskEntity | null>(null);



  const [focusState, setFocusState] = useState<"idle" | "loading" | "loaded" | "error">("idle");



  const [focusError, setFocusError] = useState<string | null>(null);



  const [noteText, setNoteText] = useState("");



  const [noteState, setNoteState] = useState<"idle" | "saving">("idle");



  const [noteFeedback, setNoteFeedback] = useState<string | null>(null);



  const [checklistInput, setChecklistInput] = useState("");



  const [checklistState, setChecklistState] = useState<"idle" | "saving">("idle");



  const [checklistFeedback, setChecklistFeedback] = useState<string | null>(null);



  const [focusEditForm, setFocusEditForm] = useState<FocusEditForm | null>(null);
  const [focusEditDescriptionTouched, setFocusEditDescriptionTouched] = useState(false);

  const [focusEditState, setFocusEditState] = useState<"idle" | "saving">("idle");



  const [focusEditFeedback, setFocusEditFeedback] = useState<{



    type: "success" | "error";



    message: string;



  } | null>(null);



  const [assigneeOverrides, setAssigneeOverrides] = useState<Record<string, TaskOverviewAssignee[]>>({});
  const [teamDirectory, setTeamDirectory] = useState<Record<string, string>>({});




  const [showBackToTop, setShowBackToTop] = useState(false);



  const [createModalOpen, setCreateModalOpen] = useState(false);



  const [createForm, setCreateForm] = useState<CreateTaskForm>(CREATE_TASK_DEFAULT);



  const [createState, setCreateState] = useState<"idle" | "saving">("idle");



  const [createFeedback, setCreateFeedback] = useState<string | null>(null);



  const [focusHoursModalOpen, setFocusHoursModalOpen] = useState(false);



  const [focusHoursForm, setFocusHoursForm] = useState<HoursFormState>({



    date: getTodayDateInput(),



    minutes: "",



    notes: ""



  });



  const [focusHoursSaving, setFocusHoursSaving] = useState(false);



  const [focusHoursFeedback, setFocusHoursFeedback] = useState<string | null>(null);



  const [focusHoursTarget, setFocusHoursTarget] = useState<{ projectId: string; task: TaskOverviewItem } | null>(null);



  const [projectHoursState, setProjectHoursState] = useState<ProjectHoursState>({});



  const detailsCacheRef = useRef<Map<string, TaskEntity>>(new Map());



  const focusEditVersionRef = useRef<string | null>(null);

  const availableAssigneesRef = useRef<TaskOverviewAssignee[]>([]);



  const taskHoursTotals = useMemo(() => {

    const totals: Record<string, number> = {};

    Object.values(projectHoursState).forEach((entry) => {

      Object.assign(totals, entry.totals);

    });

    return totals;

  }, [projectHoursState]);







  const loadOverview = useCallback(



    async (currentToken: string, currentFilters: TasksFiltersState) => {



      setFetchState("loading");



      setError(null);



      try {



        const query = buildQueryFromFilters(currentFilters);



        const response = await apiFetch<TaskOverviewResponse>("/tasks/overview", {



          token: currentToken,



          query



        });



        setOverview(response);



        setAssigneeOverrides((prev) => {



          let changed = false;



          const next = { ...prev };



          response.items.forEach((item) => {



            if (item.assignees.length > 0 && next[item.id]) {



              delete next[item.id];



              changed = true;



            }



          });



          return changed ? next : prev;



        });



        setFetchState("loaded");



      } catch (err) {



        const message =



          err instanceof ApiError ? err.message : "Não conseguimos carregar as tarefas agora.";



        setError(message);



        setFetchState("loaded");



      }



    },



    []



  );



  const loadProjectHours = useCallback(



    async (projectId: string, options: { force?: boolean } = {}) => {



      if (!token || !projectId) {



        return;



      }



      let shouldFetch = true;



      setProjectHoursState((prev) => {



        const current = prev[projectId];



        if (!options.force && current && (current.status === "loading" || current.status === "loaded")) {



          shouldFetch = false;



          return prev;



        }



        return {



          ...prev,



          [projectId]: {



            status: "loading",



            totals: current?.totals ?? {},



            message: current?.message



          }



        };



      });



      if (!shouldFetch) {



        return;



      }



      try {



        const response = await apiFetch<{ totals: Record<string, number> }>("/time-entries/summary", {



          token,



          query: { projectId }



        });



        setProjectHoursState((prev) => ({



          ...prev,



          [projectId]: { status: "loaded", totals: response.totals }



        }));



      } catch (err) {



        const message = err instanceof ApiError ? err.message : "Não foi possível carregar as horas.";



        setProjectHoursState((prev) => ({



          ...prev,



          [projectId]: {



            status: "error",



            totals: prev[projectId]?.totals ?? {},



            message



          }



        }));



      }



    },



    [token]



  );



  const availableProjects = useMemo(() => overview?.filters.projects ?? [], [overview]);

  const availableAssignees = useMemo(() => overview?.filters.assignees ?? [], [overview]);

  const assigneeDirectory = useMemo(() => {
    const map = new Map<string, string>();
    availableAssignees.forEach((member) => {
      map.set(member.id, member.name);
    });
    return map;
  }, [availableAssignees]);

  const teamDirectoryMap = useMemo(() => new Map<string, string>(Object.entries(teamDirectory)), [teamDirectory]);

  const clientLookup = useMemo(() => {
    const clients = overview?.filters.clients ?? [];
    return new Map<string, TaskOverviewClient>(clients.map((client) => [client.id, client]));
  }, [overview]);



  const projectOptions = useMemo<ProjectOption[]>(
    () =>
      availableProjects.map((project) => {
        const clientInfo = project.clientId ? clientLookup.get(project.clientId) ?? null : null;
        const clientName = clientInfo?.name ?? null;
        return {
          ...project,
          clientName,
          displayName: clientName ? `${project.name} - ${clientName}` : project.name
        };
      }),
    [availableProjects, clientLookup]
  );



  const fetchTaskDetails = useCallback(

    async (task: TaskOverviewItem, options: { force?: boolean; projectIdOverride?: string } = {}) => {

      if (!task) {
        return;
      }

      if (!token) {

        setFocusDetails(null);

        setFocusState("idle");

        return;

      }

      const projectId = options.projectIdOverride ?? task.project?.id ?? null;

      if (!projectId) {

        setFocusDetails(null);

        setFocusState("loaded");

        setFocusError("Tarefa sem projeto vinculado.");

        return;

      }



      const cached = detailsCacheRef.current.get(task.id);

      if (cached && !options.force) {

        setFocusDetails(cached);

        setFocusState("loaded");

        setFocusError(null);

        return;

      }



      setFocusState("loading");

      setFocusError(null);



      try {

        const response = await apiFetch<{ items: TaskEntity[] }>(`/projects/${projectId}/tasks`, {

          token

        });

        const found = response.items.find((item) => item.id === task.id) ?? null;

        if (found) {

          detailsCacheRef.current.set(task.id, found);

        }

        setFocusDetails(found);

        setFocusState("loaded");

        if (found) {

          const derivedAssignees = (found.assignees ?? []).map((id) => {

            const member = availableAssigneesRef.current.find((assignee) => assignee.id === id);

            return member ?? { id, name: "Sem cadastro", color: null, role: null };

          });

          if (derivedAssignees.length > 0) {

            setAssigneeOverrides((prev) => {

              const current = prev[found.id];

              const isSame =

                current &&

                current.length === derivedAssignees.length &&

                current.every((item, index) => item.id === derivedAssignees[index].id);

              if (isSame) {

                return prev;

              }

              return {

                ...prev,

                [found.id]: derivedAssignees

              };

            });

          }

        }

      } catch (err) {

        const message =

          err instanceof ApiError ? err.message : "Não conseguimos carregar os detalhes da tarefa.";

        setFocusError(message);

        setFocusState("error");

      }

    },

    [token]

  );



  const handleSelectTask = useCallback((task: TaskOverviewItem) => {



    setFocusTask(task);



  }, []);







  const handleCloseFocus = useCallback(() => {



    setFocusTask(null);



    setFocusDetails(null);



    setFocusState("idle");



    setFocusError(null);



    setNoteText("");



    setNoteFeedback(null);

    setFocusEditForm(null);
    setFocusEditDescriptionTouched(false);

    setFocusEditFeedback(null);

    setFocusEditState("idle");



    focusEditVersionRef.current = null;



  }, []);



  const handleOpenFocusHoursModal = useCallback(



    (task?: TaskOverviewItem) => {



      const target = task ?? focusTask;



      if (!target || !target.project?.id) {



        setQuickFeedback("Associe a tarefa a um projeto para registrar horas.");



        return;



      }



      setFocusHoursTarget({ projectId: target.project.id, task: target });



      setFocusHoursForm({



        date: getTodayDateInput(),



        minutes: "",



        notes: ""



      });



      setFocusHoursFeedback(null);



      setFocusHoursSaving(false);



      setFocusHoursModalOpen(true);



    },



    [focusTask, setQuickFeedback]



  );



  const handleCloseFocusHoursModal = useCallback(() => {



    setFocusHoursModalOpen(false);



    setFocusHoursTarget(null);



    setFocusHoursFeedback(null);



    setFocusHoursSaving(false);



  }, []);



  const handleFocusHoursFieldChange = useCallback((field: keyof HoursFormState, value: string) => {



    setFocusHoursForm((prev) => ({



      ...prev,



      [field]: value



    }));



  }, []);



  const handleFocusHoursSubmit = useCallback(



    async (event: FormEvent<HTMLFormElement>) => {



      event.preventDefault();



      if (!token) {



        setFocusHoursFeedback("Faça login para registrar horas.");



        return;



      }



      if (!focusHoursTarget) {



        setFocusHoursFeedback("Selecione uma tarefa para registrar horas.");



        return;



      }



      const parsedMinutes = Number(focusHoursForm.minutes);



      if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {



        setFocusHoursFeedback("Informe um total de minutos maior que zero.");



        return;



      }



      setFocusHoursSaving(true);



      setFocusHoursFeedback(null);



      try {



        await apiFetch("/time-entries", {



          token,



          method: "POST",



          body: {



            projectId: focusHoursTarget.projectId,



            taskId: focusHoursTarget.task.id,



            date: focusHoursForm.date,



            reportedMinutes: parsedMinutes,



            notes: focusHoursForm.notes.trim() ? focusHoursForm.notes.trim() : undefined



          }



        });



        setQuickFeedback("Horas registradas para a tarefa.");



        handleCloseFocusHoursModal();



        void loadProjectHours(focusHoursTarget.projectId, { force: true });



        await fetchTaskDetails(focusHoursTarget.task, { force: true });



      } catch (err) {



        const message = err instanceof ApiError ? err.message : "Não foi possível registrar as horas.";



        setFocusHoursFeedback(message);



      } finally {



        setFocusHoursSaving(false);



      }



    },



    [token, focusHoursTarget, focusHoursForm, setQuickFeedback, handleCloseFocusHoursModal, fetchTaskDetails, loadProjectHours]



  );







  useEffect(() => {



    if (!token) {



      return;



    }



    void loadOverview(token, filters);



  }, [token, filters, loadOverview]);







  useEffect(() => {



    if (!searchInput.trim() && filters.search === "") {



      return;



    }



    const timer = setTimeout(() => {



      setFilters((prev) => {



        const normalized = searchInput.trim();



        if (prev.search === normalized) {



          return prev;



        }



        return { ...prev, search: normalized };



      });



    }, 350);



    return () => clearTimeout(timer);



  }, [searchInput, filters.search]);







  useEffect(() => {



    if (!focusTask) {



      setFocusDetails(null);



      setNoteText("");



      setNoteFeedback(null);



      if (focusState !== "idle") {



        setFocusState("idle");



        setFocusError(null);



      }



      return;



    }



    setNoteText("");



    setNoteFeedback(null);



    void fetchTaskDetails(focusTask);



  }, [focusTask, fetchTaskDetails, focusState]);







  useEffect(() => {



    if (!overview || !focusTask) {



      return;



    }



    const updated = overview.items.find((item) => item.id === focusTask.id);



    if (!updated) {



      handleCloseFocus();



      return;



    }



    if (updated.updatedAt !== focusTask.updatedAt) {



      setFocusTask(updated);



    }



  }, [overview, focusTask, handleCloseFocus]);







  useEffect(() => {



    const handleScroll = () => {



      setShowBackToTop(window.scrollY > 400);



    };



    window.addEventListener("scroll", handleScroll, { passive: true });



    return () => window.removeEventListener("scroll", handleScroll);



  }, []);







  useEffect(() => {



    if (!focusTask) {

      setFocusEditForm(null);

      setFocusEditDescriptionTouched(false);

      setFocusEditFeedback(null);

      setFocusEditState("idle");

      focusEditVersionRef.current = null;

      return;

    }



    const source = focusDetails && focusDetails.id === focusTask.id ? focusDetails : null;



    const versionKey = `${focusTask.id}:${source?.updatedAt ?? focusTask.updatedAt}`;



    if (focusEditVersionRef.current === versionKey && focusEditForm) {
      if (source?.description && !focusEditForm.description) {
        setFocusEditForm({ ...focusEditForm, description: source.description });
      }
      return;
    }



    focusEditVersionRef.current = versionKey;



    setFocusEditForm({

      title: source?.title ?? focusTask.title,

      type: source?.type ?? focusTask.type,

      status: source?.status ?? focusTask.status,

      dueDate: formatISOToDateInput(source?.dueDate ?? focusTask.dueDate),

      assignees: source?.assignees ?? focusTask.assignees.map((assignee) => assignee.id),

      projectId: source?.projectId ?? focusTask.project?.id ?? "",

      description: source?.description ?? ""

    });

    setFocusEditDescriptionTouched(false);

    setFocusEditFeedback(null);

  }, [focusTask, focusDetails, focusEditForm]);



  useEffect(() => {



    setChecklistInput("");



    setChecklistFeedback(null);



  }, [focusTask?.id]);







  useEffect(() => {



    if (!quickFeedback) {



      return;



    }



    const timer = setTimeout(() => setQuickFeedback(null), 4000);



    return () => clearTimeout(timer);



  }, [quickFeedback]);







  useEffect(() => {



    if (!overview?.filters.projects || overview.filters.projects.length === 0) {



      return;



    }



    setCreateForm((prev) => {



      if (prev.projectId) {



        return prev;



      }



      return {



        ...prev,



        projectId: overview.filters.projects[0]?.id ?? ""



      };



    });



  }, [overview]);







  const applyQuickUpdates = useCallback(



    async (task: TaskOverviewItem, updates: Record<string, unknown>, successMessage?: string) => {



      if (!token) {



        setQuickFeedback("Faça login para atualizar as tarefas.");



        return;



      }



      if (!task.project?.id) {



        setQuickFeedback("Associe a tarefa a um projeto para usar as ações rápidas.");



        return;



      }







      setMutation({ taskId: task.id });



      setQuickFeedback(null);







      try {



        await apiFetch(`/projects/${task.project.id}/tasks/${task.id}`, {



          token,



          method: "PUT",



          body: updates



        });



        detailsCacheRef.current.delete(task.id);



        await loadOverview(token, filters);



        if (focusTask && focusTask.id === task.id) {



          await fetchTaskDetails(task, { force: true });



        }



        if (updates["status"] === "done" && task.project?.id) {



          setFocusHoursTarget({ projectId: task.project.id, task });



          setFocusHoursForm({



            date: getTodayDateInput(),



            minutes: "",



            notes: ""



          });



          setFocusHoursFeedback(null);



          setFocusHoursSaving(false);



          setFocusHoursModalOpen(true);



        }



        if (successMessage) {



          setQuickFeedback(successMessage);



        }



      } catch (err) {



        const message =



          err instanceof ApiError ? err.message : "Não conseguimos aplicar a ação rápida.";



        setQuickFeedback(message);



      } finally {



        setMutation(null);



        setRescheduleTarget((current) => (current?.taskId === task.id ? null : current));



      }



    },



    [token, filters, loadOverview, focusTask, fetchTaskDetails]



  );







  const handleMarkDone = useCallback(



    (task: TaskOverviewItem) => applyQuickUpdates(task, { status: "done" }, "Tarefa concluída!"),



    [applyQuickUpdates]



  );







  const handleMarkReview = useCallback(



    (task: TaskOverviewItem) =>



      applyQuickUpdates(task, { status: "review" }, "Marcamos como revisão."),



    [applyQuickUpdates]



  );







  const handleStatusChange = useCallback(



    (task: TaskOverviewItem, nextStatus: TaskStatus) => {



      if (task.status === nextStatus) {



        return;



      }



      void applyQuickUpdates(task, { status: nextStatus }, "Status atualizado.");



    },



    [applyQuickUpdates]



  );







  const handleDeleteTask = useCallback(



    async (task: TaskOverviewItem) => {



      if (!token) {



        setQuickFeedback("Faca login para excluir tarefas.");



        return;



      }



      if (!task.project?.id) {



        setQuickFeedback("Vincule a tarefa a um projeto antes de excluir.");



        return;



      }



      const confirmed = window.confirm("Deseja realmente excluir esta tarefa? Esta ação não pode ser desfeita.");



      if (!confirmed) {



        return;



      }



      setMutation({ taskId: task.id });



      setQuickFeedback(null);



      try {



        await apiFetch(`/projects/${task.project.id}/tasks/${task.id}`, {



          token,



          method: "DELETE"



        });



        detailsCacheRef.current.delete(task.id);



        await loadOverview(token, filters);



        if (focusTask && focusTask.id === task.id) {



          handleCloseFocus();



        }



        setQuickFeedback("Tarefa excluida.");



      } catch (err) {



        const message = err instanceof ApiError ? err.message : "Não conseguimos excluir esta tarefa.";



        setQuickFeedback(message);



      } finally {



        setMutation(null);



      }



    },



    [token, filters, loadOverview, focusTask, handleCloseFocus]



  );







  const handleRescheduleOpen = useCallback((task: TaskOverviewItem) => {



    setRescheduleTarget({ taskId: task.id, date: formatISOToDateInput(task.dueDate) });



  }, []);







  const handleRescheduleDateChange = useCallback((value: string) => {



    setRescheduleTarget((current) => {



      if (!current) {



        return current;



      }



      return { ...current, date: value };



    });



  }, []);







  const handleRescheduleCancel = useCallback(() => {



    setRescheduleTarget(null);



  }, []);







  const handleRescheduleSubmit = useCallback(



    (task: TaskOverviewItem) => {



      if (!rescheduleTarget || rescheduleTarget.taskId !== task.id) {



        return;



      }



      const iso = convertDateInputToISO(rescheduleTarget.date);



      void applyQuickUpdates(task, { dueDate: iso });



    },



    [applyQuickUpdates, rescheduleTarget]



  );







  const handleAddNote = useCallback(



    async (event: FormEvent<HTMLFormElement>) => {



      event.preventDefault();



      if (!focusTask || !token) {



        return;



      }



      if (!focusTask.project?.id) {



        setNoteFeedback("Esta tarefa precisa estar associada a um projeto.");



        return;



      }



      const content = noteText.trim();



      if (!content) {



        setNoteFeedback("Escreva uma atualização antes de enviar.");



        return;



      }







      setNoteState("saving");



      setNoteFeedback(null);







      const timestamp = new Date();



      const formattedTimestamp = `${timestamp.toLocaleDateString("pt-BR")} ${timestamp.toLocaleTimeString("pt-BR")}`;



      const baseDescription = focusDetails?.description?.trim();



      const nextDescription = [baseDescription, `Atualização (${formattedTimestamp}): ${content}`]



        .filter(Boolean)



        .join("\n\n");







      try {



        await apiFetch(`/projects/${focusTask.project.id}/tasks/${focusTask.id}`, {



          token,



          method: "PUT",



          body: { description: nextDescription }



        });



        detailsCacheRef.current.delete(focusTask.id);



        setNoteText("");



        await loadOverview(token, filters);



        await fetchTaskDetails(focusTask, { force: true });



      } catch (err) {



        const message =



          err instanceof ApiError ? err.message : "Não foi possível registrar a atualização.";



        setNoteFeedback(message);



      } finally {



        setNoteState("idle");



      }



    },



    [focusTask, token, noteText, focusDetails, loadOverview, filters, fetchTaskDetails]



  );



  const handleChecklistUpdate = useCallback(



    async (nextChecklist: Array<{ id: string; label: string; done: boolean }>) => {



      if (!focusTask || !token || !focusTask.project?.id) {



        return;



      }



      setChecklistState("saving");



      setChecklistFeedback(null);



      try {



        const updated = await apiFetch<TaskEntity>(`/projects/${focusTask.project.id}/tasks/${focusTask.id}`, {



          token,



          method: "PUT",



          body: { checklist: nextChecklist }



        });



        detailsCacheRef.current.set(updated.id, updated);



        setFocusDetails(updated);



        setChecklistInput("");



      } catch (err) {



        const message = err instanceof ApiError ? err.message : "N??o foi poss??vel atualizar o checklist.";



        setChecklistFeedback(message);



      } finally {



        setChecklistState("idle");



      }



    },



    [focusTask, token]



  );







  const handleFocusEditFieldChange = useCallback(
    (field: keyof FocusEditForm, value: string | string[]) => {
      if (field === "description") {
        setFocusEditDescriptionTouched(true);
      }

      setFocusEditForm((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          [field]: value
        } as FocusEditForm;
      });
    },
    []
  );







  const handleFocusEditSubmit = useCallback(async () => {



    if (!focusTask) {



      return;



    }



    if (!focusTask.project?.id) {



      setFocusEditFeedback({



        type: "error",



        message: "Associe a tarefa a um projeto antes de editar."



      });



      return;



    }



    if (!token) {



      setFocusEditFeedback({ type: "error", message: "Faca login para editar a tarefa." });



      return;



    }



    if (!focusEditForm) {



      setFocusEditFeedback({



        type: "error",



        message: "Ainda estamos carregando os dados da tarefa."



      });



      return;



    }



    if (!focusEditForm.title.trim()) {



      setFocusEditFeedback({ type: "error", message: "Defina um titulo para a tarefa." });



      return;



    }



    if (!focusEditForm.projectId) {



      setFocusEditFeedback({ type: "error", message: "Selecione um projeto para a tarefa." });



      return;



    }







    const previousProjectId = focusTask.project?.id ?? null;



    setFocusEditState("saving");



    setFocusEditFeedback(null);







    try {



      const payload = {

        title: focusEditForm.title.trim(),

        type: focusEditForm.type,

        status: focusEditForm.status,

        assignees: focusEditForm.assignees,

        dueDate: convertDateInputToISO(focusEditForm.dueDate),

        projectId: focusEditForm.projectId,

        description: focusEditDescriptionTouched
          ? focusEditForm.description.trim()
            ? focusEditForm.description.trim()
            : null
          : undefined
      };



      const updated = await apiFetch<TaskEntity>(`/projects/${focusTask.project.id}/tasks/${focusTask.id}`, {



        token,



        method: "PUT",



        body: payload



      });



      detailsCacheRef.current.set(updated.id, updated);



      setFocusDetails(updated);



      const projectSnapshot = availableProjects.find((project) => project.id === updated.projectId) ?? null;
      const clientSnapshot: TaskOverviewClient | null =
        projectSnapshot?.clientId ? clientLookup.get(projectSnapshot.clientId) ?? null : null;



      const assigneeDetails = updated.assignees.map((assigneeId) => {



        const member = availableAssignees.find((assignee) => assignee.id === assigneeId);



        return member ?? { id: assigneeId, name: "Sem cadastro", color: null, role: null };



      });



      setAssigneeOverrides((prev) => ({



        ...prev,



        [updated.id]: assigneeDetails



      }));



      setFocusTask((current) => {
        if (!current || current.id !== updated.id) {
          return current;
        }
        return {
          ...current,
          title: updated.title,
          status: updated.status,
          dueDate: updated.dueDate,
          assignees: assigneeDetails,
          project: projectSnapshot
            ? { id: projectSnapshot.id, name: projectSnapshot.name, clientId: projectSnapshot.clientId }
            : current.project,
          client: clientSnapshot ?? current.client
        };
      });
      setFocusEditForm((prev) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          projectId: updated.projectId
        };
      });



      await loadOverview(token, filters);



      setFocusEditFeedback({ type: "success", message: "Tarefa atualizada!" });



      focusEditVersionRef.current = null;



      if (previousProjectId && previousProjectId !== updated.projectId) {



        void loadProjectHours(previousProjectId, { force: true });



      }



      void loadProjectHours(updated.projectId, { force: true });



    } catch (err) {



      const message =



        err instanceof ApiError ? err.message : "Não conseguimos salvar as mudanças.";



      setFocusEditFeedback({ type: "error", message });



    } finally {



      setFocusEditState("idle");



    }



  }, [
    focusTask,
    token,
    focusEditForm,
    focusEditDescriptionTouched,
    loadOverview,
    filters,
    availableProjects,
    availableAssignees,
    clientLookup,
    loadProjectHours
  ]);







  const handleOpenCreateModal = useCallback(() => {



    setCreateFeedback(null);



    setCreateState("idle");



    setCreateForm((prev) => {



      if (prev.projectId || !overview?.filters.projects?.length) {



        return { ...prev, title: "" };



      }



      return { ...prev, title: "", projectId: overview.filters.projects[0].id };



    });



    setCreateModalOpen(true);



  }, [overview]);







  const handleCloseCreateModal = useCallback(() => {



    setCreateModalOpen(false);



    setCreateFeedback(null);



    setCreateState("idle");



    setCreateForm((prev) => ({ ...prev, title: "", notes: "", dueDate: "", assignees: [], checklist: [], checklistInput: "" }));



  }, []);







  const handleCreateFieldChange = useCallback(



    (field: keyof CreateTaskForm, value: string | string[] | CreateTaskForm["checklist"]) => {



      setCreateForm((prev) => ({



        ...prev,



        [field]: value



      }));



    },



    []



  );







  const handleCreateSubmit = useCallback(



    async (event: FormEvent<HTMLFormElement>) => {



      event.preventDefault();



      if (!token) {



        setCreateFeedback("Faça login para criar tarefas.");



        return;



      }



      if (!createForm.projectId) {



        setCreateFeedback("Escolha um projeto para associar a tarefa.");



        return;



      }



      if (!createForm.title.trim()) {



        setCreateFeedback("Dê um nome para a tarefa.");



        return;



      }







      setCreateState("saving");



      setCreateFeedback(null);







      try {



        await apiFetch(`/projects/${createForm.projectId}/tasks`, {



          token,



          method: "POST",



          body: {



            title: createForm.title.trim(),



            status: createForm.status,



            type: createForm.type,



            dueDate: convertDateInputToISO(createForm.dueDate),



            assignees: createForm.assignees,



            description: createForm.notes.trim() ? createForm.notes.trim() : undefined,



            checklist: createForm.checklist.length ? createForm.checklist : undefined



          }



        });



        await loadOverview(token, filters);



        setQuickFeedback("Tarefa criada com sucesso!");



        handleCloseCreateModal();



      } catch (err) {



        const message = err instanceof ApiError ? err.message : "Não conseguimos criar a tarefa.";



        setCreateFeedback(message);



      } finally {



        setCreateState("idle");



      }



    },



    [token, createForm, loadOverview, filters, handleCloseCreateModal]



  );







  const handleBackToTop = useCallback(() => {



    window.scrollTo({ top: 0, behavior: "smooth" });



  }, []);







  const isInitialLoading = fetchState === "loading" && !overview;



  const isRefreshing = Boolean(overview) && fetchState === "loading";



  const lastUpdated = overview?.metadata.generatedAt



    ? FULL_DATE_FORMATTER.format(new Date(overview.metadata.generatedAt))



    : null;







  
  const appliedRange = overview?.metadata.appliedFilters.range ?? null;

  const rangeLabel = appliedRange

    ? `${FULL_DATE_FORMATTER.format(new Date(appliedRange.start))} - ${FULL_DATE_FORMATTER.format(

        new Date(appliedRange.end)

      )}`

    : "Sem filtro de periodo";

  const platformLabelMap = useMemo(() => {



    if (!overview) {



      return new Map<string, string>();



    }



    return new Map(overview.filters.platforms.map((platform) => [platform.value, platform.label]));



  }, [overview]);







  useEffect(() => {



    availableAssigneesRef.current = availableAssignees;



  }, [availableAssignees]);



  useEffect(() => {



    if (!overview) {



      return;



    }



    const projectIds = new Set(



      overview.items



        .map((item) => item.project?.id ?? null)



        .filter((value): value is string => Boolean(value))



    );



    projectIds.forEach((projectId) => {



      const state = projectHoursState[projectId];



      if (!state || state.status === "idle") {



        void loadProjectHours(projectId);



      }



    });



  }, [overview, projectHoursState, loadProjectHours]);









  const canCreateTask = isAuthenticated && projectOptions.length > 0;







  if (!isAuthenticated) {



    return (



      <div className="px-6 py-14">



        <div className="mx-auto max-w-3xl rounded-3xl border border-white/15 bg-white/5 p-10 text-center text-offWhite shadow-2xl shadow-black/30">



          <p className="text-xs uppercase tracking-[0.4em] text-offWhite/60">Tarefas</p>



          <p className="mt-4 text-2xl font-semibold">Conecte-se para acessar o painel</p>



          <p className="mt-3 text-base text-offWhite/80">



            Este módulo precisa do token de autenticação para buscar as tarefas e filtros.



          </p>



        </div>



      </div>



    );



  }







  const hasData = Boolean(overview && overview.items.length > 0);



  const selectedTaskId = focusTask?.id ?? null;



  const disableQuickActions = !token;







  return (



    <div className="px-6 py-8">



      <div className="mx-auto max-w-[1200px] space-y-8">



        <header className="rounded-xl border border-gray-200 bg-gradient-to-br from-deepGreen to-deepGreen/80 p-8 text-white shadow-sm">

          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

            <div className="space-y-3">

              <p className="text-xs uppercase tracking-[0.4em] text-white/70">Módulo de tarefas</p>

              <h1 className="text-2xl font-semibold leading-snug">O que precisa sair do forno hoje?</h1>

              <p className="text-sm text-white/80">

                Use os filtros para concentrar na operação do dia e conclua as entregas sem sair desta tela.

              </p>

            </div>

            <div className="flex flex-col items-start gap-3 text-sm text-white/80 lg:items-end">

              <p className="flex flex-wrap items-center gap-2 text-white/80">

                Atualizado: <span className="font-semibold text-white">{lastUpdated ?? "sincronizando..."}</span>

                {isRefreshing ? (

                  <span className="inline-flex items-center gap-1 rounded-full border border-white/40 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">

                    <svg

                      className="size-3 animate-spin"

                      viewBox="0 0 24 24"

                      fill="none"

                      stroke="currentColor"

                      strokeWidth="2"

                      aria-hidden="true"

                    >

                      <path

                        d="M12 3v3m6.364.636-2.121 2.12M21 12h-3m-.636 6.364-2.12-2.121M12 21v-3M6.364 20.364l2.12-2.121M3 12h3M6.364 3.636l2.12 2.121"

                        strokeLinecap="round"

                        strokeLinejoin="round"

                      />

                    </svg>

                    Atualizando

                  </span>

                ) : null}

              </p>

              <div className="flex flex-wrap gap-2">

                <button

                  type="button"

                  onClick={() => {

                    if (token) {

                      void loadOverview(token, filters);

                    }

                  }}

                  className="inline-flex items-center rounded-full border border-white/40 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"

                >

                  {isRefreshing ? "Atualizando..." : "Atualizar agora"}

                </button>

                <button

                  type="button"

                  onClick={handleOpenCreateModal}

                  disabled={!canCreateTask}

                  className={`inline-flex items-center rounded-full px-5 py-2 text-sm font-semibold transition ${

                    canCreateTask ? "bg-terracota text-white hover:bg-terracota/90" : "bg-white/10 text-white/60 opacity-60"

                  }`}

                >

                  Criar tarefa

                </button>

              </div>

              <div className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium text-white/80">

                {rangeLabel}

              </div>

            </div>

          </div>

        </header>


        <PushOptInCard />



        {error ? (

          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800 shadow-sm">

            <p className="text-base font-semibold">Não conseguimos carregar as tarefas</p>

            <p className="mt-2 text-sm text-rose-700">{error}</p>

            <button

              type="button"

              onClick={() => {

                if (token) {

                  void loadOverview(token, filters);

                }

              }}

              className="mt-4 inline-flex items-center justify-center rounded-full border border-rose-500 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-600 hover:text-white"

            >

              Tentar novamente

            </button>

          </div>

        ) : null}







        <TasksSummaryCards cards={overview?.cards ?? null} isLoading={isInitialLoading} />







        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <p className="text-lg font-semibold text-gray-900">Filtros principais</p>

              <p className="text-sm text-gray-600">Responsáveis, clientes, plataforma e prazo.</p>

            </div>

            <button

              type="button"

              className="text-sm font-semibold text-terracota underline-offset-2 hover:underline"

              onClick={() => {

                setFilters(INITIAL_FILTERS);

                setSearchInput("");

              }}

            >

              Limpar filtros

            </button>

          </div>







          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">



            <FilterSelect



              label="Status"



              value={filters.status}



              onChange={(value) => setFilters((prev) => ({ ...prev, status: value as TasksFiltersState["status"] }))}



              options={[



                { value: "all", label: "Todos" },



                ...Object.entries(TASK_STATUS_LABELS).map(([value, label]) => ({



                  value,



                  label



                }))



              ]}



            />



            <FilterSelect



              label="Tipo"



              value={filters.type}



              onChange={(value) => setFilters((prev) => ({ ...prev, type: value as TasksFiltersState["type"] }))}



              options={[



                { value: "all", label: "Todos" },



                ...TASK_TYPE_OPTIONS



              ]}



            />



            <FilterSelect



              label="Responsável"



              value={filters.assigneeId}



              onChange={(value) => setFilters((prev) => ({ ...prev, assigneeId: value }))}



              options={[



                { value: "all", label: "Todos" },



                ...(overview?.filters.assignees ?? []).map((member) => ({



                  value: member.id,



                  label: member.name



                }))



              ]}



            />



            <FilterSelect



              label="Cliente"



              value={filters.clientId}



              onChange={(value) => setFilters((prev) => ({ ...prev, clientId: value }))}



              options={[



                { value: "all", label: "Todos" },



                ...(overview?.filters.clients ?? []).map((client) => ({



                  value: client.id,



                  label: client.name



                }))



              ]}



            />



            <FilterSelect



              label="Projeto"



              value={filters.projectId}



              onChange={(value) => setFilters((prev) => ({ ...prev, projectId: value }))}



              options={[



                { value: "all", label: "Todos" },



                ...(overview?.filters.projects ?? []).map((project) => ({



                  value: project.id,



                  label: project.name



                }))



              ]}



            />



            <FilterSelect



              label="Plataforma"



              value={filters.platform}



              onChange={(value) => setFilters((prev) => ({ ...prev, platform: value }))}



              options={[



                { value: "all", label: "Todas" },



                ...(overview?.filters.platforms ?? []).map((platform) => ({



                  value: platform.value,



                  label: platform.label



                }))



              ]}



            />



          </div>







          <div className="mt-6 flex flex-wrap gap-2">

            {PERIOD_PRESETS.map((preset) => (

              <button

                key={preset.value}

                type="button"

                onClick={() =>

                  setFilters((prev) => ({

                    ...prev,

                    period: preset.value,

                    from: "",

                    to: ""

                  }))

                }

                className={`rounded-full px-4 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracota/40 ${

                  filters.period === preset.value

                    ? "border border-terracota/30 bg-terracota/10 text-terracota"

                    : "border border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200"

                }`}

              >

                {preset.label}

              </button>

            ))}

          </div>







          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">



            <div>



              <label



                htmlFor={DATE_FROM_INPUT_ID}



                className="text-xs font-semibold uppercase tracking-wide text-gray-500"



              >



                De



              </label>



              <input



                id={DATE_FROM_INPUT_ID}



                type="date"



                value={filters.from}



                onChange={(event) =>



                  setFilters((prev) => {



                    const next = { ...prev, from: event.target.value };



                    if (next.from && next.to) {



                      next.period = "custom";



                    } else if (prev.period === "custom") {



                      next.period = "none";



                    }



                    return next;



                  })



                }



                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"



              />



            </div>



            <div>



              <label



                htmlFor={DATE_TO_INPUT_ID}



                className="text-xs font-semibold uppercase tracking-wide text-gray-500"



              >



                Até



              </label>



              <input



                id={DATE_TO_INPUT_ID}



                type="date"



                value={filters.to}



                onChange={(event) =>



                  setFilters((prev) => {



                    const next = { ...prev, to: event.target.value };



                    if (next.from && next.to) {



                      next.period = "custom";



                    } else if (prev.period === "custom") {



                      next.period = "none";



                    }



                    return next;



                  })



                }



                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"



              />



            </div>



            <div>



              <label



                htmlFor={SEARCH_INPUT_ID}



                className="text-xs font-semibold uppercase tracking-wide text-gray-500"



              >



                Buscar



              </label>



              <input



                id={SEARCH_INPUT_ID}



                type="search"



                placeholder="Título ou palavra-chave"



                value={searchInput}



                onChange={(event) => setSearchInput(event.target.value)}



                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"



              />



            </div>



          </div>



        </section>







        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">

          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">

            <div>

              <p className="text-lg font-semibold text-gray-900">Status geral</p>

              <p className="text-sm text-gray-600">

                {overview

                  ? isRefreshing

                    ? "Atualizando..."

                    : `${overview.metadata.total} tarefas encontradas`

                  : isInitialLoading

                    ? "Sincronizando..."

                    : "Ainda sem dados"}

              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              {overview

                ? TASK_STATUS_ORDER.map((status) => (

                    <span

                      key={status}

                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${TASK_STATUS_STYLES[status]}`}

                    >

                      {TASK_STATUS_LABELS[status]} - {overview.totals.byStatus[status] ?? 0}

                    </span>

                  ))

                : null}

            </div>

          </div>







          <div className="mt-6">



            {quickFeedback ? (



              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-2 text-sm text-amber-900">



                {quickFeedback}



              </div>



            ) : null}



                        <TasksTable
              items={overview?.items ?? []}
              isLoading={isInitialLoading}
              platformLabels={platformLabelMap}
              onSelect={handleSelectTask}
              onFocusRequest={handleSelectTask}
              selectedTaskId={selectedTaskId}
              onMarkDone={handleMarkDone}
              onMarkReview={handleMarkReview}
              onRescheduleOpen={handleRescheduleOpen}
              onRescheduleChange={handleRescheduleDateChange}
              onRescheduleSubmit={handleRescheduleSubmit}
              onRescheduleCancel={handleRescheduleCancel}
              rescheduleState={rescheduleTarget}
              mutationTaskId={mutation?.taskId ?? null}
              disableActions={disableQuickActions}
              assigneeOverrides={assigneeOverrides}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
              taskHours={taskHoursTotals}
              assigneeDirectory={assigneeDirectory}
              teamDirectory={teamDirectoryMap}
              currentUserId={user?.uid ?? null}
              currentUserEmail={user?.email ?? null}
            />



            {!hasData && overview && (



              <p className="mt-4 text-center text-sm text-deepGreen/60">



                Nenhuma tarefa encontrada para os filtros atuais. Reveja filtros ou tente outro período.



              </p>



            )}



          </div>



        </section>



      </div>



      <TaskFocusPanel



        task={focusTask}



        details={focusDetails}



        state={focusState}



        error={focusError}



        onClose={handleCloseFocus}



        onMarkDone={focusTask ? () => handleMarkDone(focusTask) : undefined}



        onMarkReview={focusTask ? () => handleMarkReview(focusTask) : undefined}



        onRescheduleOpen={focusTask ? () => handleRescheduleOpen(focusTask) : undefined}



        onRescheduleChange={handleRescheduleDateChange}



        onRescheduleSubmit={focusTask ? () => handleRescheduleSubmit(focusTask) : undefined}



        onRescheduleCancel={handleRescheduleCancel}



        rescheduleState={rescheduleTarget}



        mutationTaskId={mutation?.taskId ?? null}



        noteText={noteText}



        onNoteChange={setNoteText}



        noteState={noteState}



        noteFeedback={noteFeedback}



        onNoteSubmit={handleAddNote}



        checklistInput={checklistInput}



        onChecklistInputChange={setChecklistInput}



        checklistState={checklistState}



        checklistFeedback={checklistFeedback}



        onChecklistUpdate={handleChecklistUpdate}



        assignees={availableAssignees}



        editForm={focusEditForm}



        onEditChange={handleFocusEditFieldChange}



        onEditSubmit={handleFocusEditSubmit}



        editState={focusEditState}



        editFeedback={focusEditFeedback}



        projects={projectOptions}



        hoursLogged={focusTask ? taskHoursTotals[focusTask.id] ?? 0 : null}



        onStatusChange={focusTask ? (status) => handleStatusChange(focusTask, status) : undefined}



        onDelete={focusTask ? () => handleDeleteTask(focusTask) : undefined}



        disableActions={disableQuickActions}



        onRegisterHours={focusTask?.project?.id ? handleOpenFocusHoursModal : undefined}



        canRegisterHours={Boolean(focusTask?.project?.id)}



        isRegisteringHours={focusHoursSaving}



      />



      <TaskHoursModal



        open={focusHoursModalOpen}



        task={focusHoursTarget?.task ?? null}



        form={focusHoursForm}



        feedback={focusHoursFeedback}



        isSaving={focusHoursSaving}



        onClose={handleCloseFocusHoursModal}



        onChange={handleFocusHoursFieldChange}



        onSubmit={handleFocusHoursSubmit}



      />



      <CreateTaskModal



        open={createModalOpen}



        form={createForm}



        projects={projectOptions}



        assignees={availableAssignees}



        state={createState}



        feedback={createFeedback}



        onClose={handleCloseCreateModal}



        onChange={handleCreateFieldChange}



        onSubmit={handleCreateSubmit}



      />



      {showBackToTop ? (



        <button



          type="button"



          onClick={handleBackToTop}



          className="fixed bottom-6 right-6 z-40 rounded-full bg-deepGreen px-4 py-2 text-sm font-semibold text-white shadow-xl shadow-deepGreen/30 transition hover:bg-deepGreen/90"



        >



          Voltar ao topo



        </button>



      ) : null}



    </div>



  );



}







function buildQueryFromFilters(filters: TasksFiltersState): Record<string, string> {



  const query: Record<string, string> = {};



  if (filters.status !== "all") {



    query.status = filters.status;



  }



  if (filters.type !== "all") {



    query.type = filters.type;



  }



  if (filters.assigneeId !== "all") {



    query.assigneeId = filters.assigneeId;



  }



  if (filters.clientId !== "all") {



    query.clientId = filters.clientId;



  }



  if (filters.projectId !== "all") {



    query.projectId = filters.projectId;



  }



  if (filters.platform !== "all") {



    query.platform = filters.platform;



  }



  if (filters.period !== "none") {



    query.period = filters.period;



  }



  if (filters.from && filters.to) {



    query.from = filters.from;



    query.to = filters.to;



  }



  if (filters.search) {



    query.search = filters.search;



  }



  return query;



}







function TasksSummaryCards({

  cards,

  isLoading

}: {

  cards: TaskOverviewResponse["cards"] | null;

  isLoading: boolean;

}): JSX.Element {

  const cardEntries: Array<{ key: keyof TaskOverviewResponse["cards"]; label: string }> = [

    { key: "today", label: "Hoje" },

    { key: "week", label: "Esta semana" },

    { key: "overdue", label: "Atrasadas" }

  ];

  return (

    <section className="grid gap-4 md:grid-cols-3">

      {cardEntries.map(({ key, label }) => {

        const card = cards?.[key] ?? null;

        return (

          <article

            key={key}

            className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"

          >

            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>

            <p className="mt-3 text-3xl font-semibold text-gray-900">

              {isLoading && !card ? "..." : card?.total ?? 0}

            </p>

            {card ? <CardHighlight highlight={card.highlight ?? null} /> : null}

          </article>

        );

      })}

    </section>

  );

}



function CardHighlight({ highlight }: { highlight: TaskOverviewCard["highlight"] | null }): JSX.Element | null {

  if (!highlight) {

    return <p className="mt-4 text-sm text-gray-500">Nenhuma tarefa nesta lista por enquanto.</p>;

  }

  const clientLabel = highlight.clientName ?? "Sem cliente";

  const dueLabel = highlight.dueDate ? DATE_FORMATTER.format(new Date(highlight.dueDate)) : "Sem prazo";

  const assignees = highlight.assignees ?? [];

  return (

    <div className="mt-4 space-y-3 rounded-lg border border-gray-100 bg-gray-50/90 p-4 text-sm text-gray-800">

      <div className="space-y-1">

        <p className="font-semibold text-gray-900">{highlight.title}</p>

        <p className="text-xs text-gray-600">{dueLabel}</p>

      </div>

      <div className="flex flex-wrap gap-2 text-xs font-medium">

        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-gray-700">

          {clientLabel}

        </span>

        <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-gray-700">

          {dueLabel}

        </span>

      </div>

      {assignees.length > 0 ? (

        <p className="text-xs text-gray-600">

          Com {assignees.slice(0, 2).map((assignee) => assignee.name).join(" e ")}

          {assignees.length > 2 ? ` +${assignees.length - 2}` : ""}

        </p>

      ) : (

        <p className="text-xs text-gray-500">Sem responsável definido</p>

      )}

    </div>

  );

}



function FilterSelect({



  label,



  value,



  onChange,



  options



}: {



  label: string;



  value: string;



  onChange: (value: string) => void;



  options: Array<{ value: string; label: string }>;



}): JSX.Element {



  return (



    <label className="flex flex-col gap-2 text-sm font-medium text-gray-800">

      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>

      <select

        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-terracota/40"

        value={value}

        onChange={(event) => onChange(event.target.value)}

      >

        {options.map((option) => (

          <option key={option.value} value={option.value}>

            {option.label}

          </option>

        ))}

      </select>

    </label>



  );



}







type RescheduleState = { taskId: string; date: string } | null;




type QuickActionBarProps = {

  task: TaskOverviewItem;

  onMarkDone: () => void;

  onMarkReview: () => void;

  onRescheduleOpen: () => void;

  onRescheduleChange: (value: string) => void;

  onRescheduleSubmit: () => void;

  onRescheduleCancel: () => void;

  rescheduleState: RescheduleState;

  isSaving: boolean;

  disabled: boolean;

  onFocus?: () => void;

  onStatusChange?: (status: TaskStatus) => void;

  onDelete?: () => void;

};









function TasksTable({

  items,

  isLoading,

  platformLabels,

  onSelect,

  onFocusRequest,

  selectedTaskId,

  onMarkDone,

  onMarkReview,

  onRescheduleOpen,

  onRescheduleChange,

  onRescheduleSubmit,

  onRescheduleCancel,

  rescheduleState,

  mutationTaskId,

  disableActions,

  assigneeOverrides,

  onStatusChange,

  onDelete,

  taskHours,

  assigneeDirectory,

  teamDirectory,

  currentUserId,

  currentUserEmail

}: {

  items: TaskOverviewItem[];

  isLoading: boolean;

  platformLabels: Map<string, string>;

  onSelect: (task: TaskOverviewItem) => void;

  onFocusRequest: (task: TaskOverviewItem) => void;

  selectedTaskId: string | null;

  onMarkDone: (task: TaskOverviewItem) => void;

  onMarkReview: (task: TaskOverviewItem) => void;

  onRescheduleOpen: (task: TaskOverviewItem) => void;

  onRescheduleChange: (value: string) => void;

  onRescheduleSubmit: (task: TaskOverviewItem) => void;

  onRescheduleCancel: () => void;

  rescheduleState: RescheduleState;

  mutationTaskId: string | null;

  disableActions: boolean;

  assigneeOverrides: Record<string, TaskOverviewAssignee[]>;

  onStatusChange: (task: TaskOverviewItem, status: TaskStatus) => void;

  onDelete: (task: TaskOverviewItem) => void;

  taskHours: Record<string, number>;

  assigneeDirectory: Map<string, string>;

  teamDirectory: Map<string, string>;

  currentUserId: string | null;

  currentUserEmail: string | null;

}): JSX.Element {

  if (isLoading) {

    return (

      <div className="space-y-3">

        {Array.from({ length: 4 }).map((_, index) => (

          <div key={index} className="h-24 animate-pulse rounded-xl border border-gray-200 bg-gray-50" />

        ))}

      </div>

    );

  }



  return (

    <div className="space-y-4">

      {items.map((task) => {

        const isSelected = selectedTaskId === task.id;

        const isMutating = mutationTaskId === task.id;

        const displayAssignees = assigneeOverrides[task.id] ?? task.assignees;

        const loggedMinutes = taskHours[task.id] ?? 0;

        const hasLoggedHours = loggedMinutes > 0;

        const hoursLabel = hasLoggedHours ? formatMinutesAsClock(loggedMinutes) : "Sem horas";

        const dueLabel = task.dueDate ? FULL_DATE_FORMATTER.format(new Date(task.dueDate)) : "Sem prazo";

        const checklistLabel = task.checklist.total > 0 ? `${task.checklist.done}/${task.checklist.total}` : null;
        const createdLabel = task.createdAt ? FULL_DATE_FORMATTER.format(new Date(task.createdAt)) : "N/D";
        const hasExplicitName = task.createdByName && task.createdByName !== task.createdById;
        const createdByFromAssignees =
          task.createdById && displayAssignees.find((assignee) => assignee.id === task.createdById)?.name;
        const createdByLabel =
          (hasExplicitName ? task.createdByName : null) ??
          createdByFromAssignees ??
          (task.createdById
            ? teamDirectory.get(task.createdById) ??
              assigneeDirectory.get(task.createdById) ??
              (currentUserId === task.createdById ? currentUserEmail ?? "Voce" : null) ??
              "Autor desconhecido"
            : "Autor desconhecido");



        const cardClasses = [
          "w-full text-left rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300",
          isSelected ? "ring-2 ring-terracota/40" : "",
          isMutating ? "opacity-70" : ""
        ]
          .filter(Boolean)
          .join(" ");



        return (

          <button

            type="button"

            key={task.id}

            className={cardClasses}

            onClick={() => onSelect(task)}

            onKeyDown={(event) => {

              if (event.key === "Enter" || event.key === " ") {

                event.preventDefault();

                onSelect(task);

              }

            }}

            aria-pressed={isSelected}

          >

            <div className="grid gap-4">

              <div>

                <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-base font-semibold text-gray-900">{task.title}</p>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}
                  >
                    {PRIORITY_LABELS[task.priority]}
                  </span>
                </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${TASK_STATUS_STYLES[task.status]}`}
                >
                  {TASK_STATUS_LABELS[task.status]}
                </span>
              </div>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                  {task.project?.name ?? "Sem projeto"}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium text-gray-700 ${
                    hasLoggedHours ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  Horas: {hoursLabel}
                </span>
                {checklistLabel ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    Checklist: {checklistLabel}
                  </span>
                ) : null}
              </div>

                <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(220px,_1.2fr)_minmax(160px,_1fr)_minmax(220px,_1fr)_minmax(190px,_0.9fr)] lg:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{task.client?.name ?? "Não informado"}</p>
                  <p className="text-xs text-gray-500">{task.client?.segment ?? "Sem segmento"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Responsáveis</p>
                  <div className="mt-1">
                    <AssigneeStack assignees={displayAssignees} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Plataformas</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {task.platforms.length > 0 ? (
                      task.platforms.map((platform) => (
                        <span
                          key={`${task.id}-${platform}`}
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
                            PLATFORM_TONES[platform] ?? PLATFORM_TONES.other
                          }`}
                        >
                          {platformLabels.get(platform) ?? platform}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-500">Sem plataformas</span>
                    )}
                  </div>
                </div>
                  <div className="flex flex-col items-start text-sm text-gray-700 lg:items-end lg:text-right">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Prazo & status</p>
                  <p className="mt-1 font-medium text-gray-900">{dueLabel}</p>
                  <span
                    className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${TASK_STATUS_STYLES[task.status]}`}
                  >
                    {TASK_STATUS_LABELS[task.status]}
                  </span>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Criada em {createdLabel}
                    {createdByLabel ? ` • Por ${createdByLabel}` : ""}
                  </p>
                </div>
              </div>
              </div>



              <QuickActionBar

                task={task}

                onMarkDone={() => onMarkDone(task)}

                onMarkReview={() => onMarkReview(task)}

                onRescheduleOpen={() => onRescheduleOpen(task)}

                onRescheduleChange={onRescheduleChange}

                onRescheduleSubmit={() => onRescheduleSubmit(task)}

                onRescheduleCancel={onRescheduleCancel}

                rescheduleState={rescheduleState}

                isSaving={isMutating}

                disabled={disableActions}

                onFocus={() => onFocusRequest(task)}

                onStatusChange={(status: TaskStatus) => onStatusChange(task, status)}

                onDelete={() => onDelete(task)}

              />

            </div>

          </button>

        );

      })}

    </div>

  );

}



function QuickActionBar({



  task,



  onMarkDone,



  onMarkReview,



  onRescheduleOpen,



  onRescheduleChange,



  onRescheduleSubmit,



  onRescheduleCancel,



  rescheduleState,



  isSaving,



  disabled,



  onFocus,



  onStatusChange,



  onDelete



}: QuickActionBarProps): JSX.Element {



  const isRescheduling = rescheduleState?.taskId === task.id;

  const isTaskDone = task.status === "done";

  const doneButtonClassName = isTaskDone

    ? "inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"

    : "inline-flex items-center rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60";







  const handleClick =



    (action: () => void, extraDisabled = false) =>



    (event: MouseEvent<HTMLButtonElement>) => {



      event.preventDefault();



      event.stopPropagation();



      if (disabled || isSaving || extraDisabled) {



        return;



      }



      action();



    };







  return (



    <div className="mt-4 flex flex-col gap-3">



      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">



        <button



          type="button"



          onClick={handleClick(onMarkDone, isTaskDone)}



          disabled={disabled || isSaving || isTaskDone}



          className={doneButtonClassName}



        >



          {isTaskDone ? (



            <>



              <svg



                aria-hidden="true"



                focusable="false"



                className="size-3"



                viewBox="0 0 20 20"



                fill="none"



                stroke="currentColor"



                strokeWidth="2"



              >



                <path d="M5 10.5 8.5 14 15 6" strokeLinecap="round" strokeLinejoin="round" />



              </svg>



              Concluída



            </>



          ) : (



            "Concluir"



          )}



        </button>



        <button



          type="button"



          onClick={handleClick(onMarkReview)}



          disabled={disabled || isSaving}



          className="inline-flex items-center rounded-full border border-amber-400 px-3 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"



        >



          Precisa revisão



        </button>



        {isRescheduling ? (



          <form



            className="flex flex-wrap items-center gap-2 rounded-full border border-deepGreen/40 px-3 py-1"



            onSubmit={(event) => {



              event.preventDefault();



              event.stopPropagation();



              if (!disabled && !isSaving) {



                onRescheduleSubmit();



              }



            }}



          >



            <input



              type="date"



              value={rescheduleState?.date ?? ""}



              onChange={(event) => onRescheduleChange(event.target.value)}



              onClick={(event) => event.stopPropagation()}



              className="w-32 rounded-md border border-transparent bg-transparent px-2 py-1 text-xs text-deepGreen outline-none focus:border-deepGreen"



              disabled={disabled || isSaving}



            />



            <button



              type="submit"



              className="inline-flex items-center rounded-full bg-deepGreen px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"



              disabled={disabled || isSaving}



            >



              Salvar



            </button>



            <button



              type="button"



              onClick={(event) => {



                event.preventDefault();



                event.stopPropagation();



                onRescheduleCancel();



              }}



              className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600"



            >



              Cancelar



            </button>



          </form>



        ) : (



          <button



            type="button"



            onClick={handleClick(onRescheduleOpen)}



            disabled={disabled || isSaving}



            className="inline-flex items-center rounded-full border border-deepGreen/30 px-3 py-1 text-xs font-medium text-deepGreen transition hover:border-deepGreen/60 disabled:cursor-not-allowed disabled:opacity-60"



          >



            Reagendar



          </button>



        )}



        {onFocus ? (



          <button



            type="button"



            onClick={handleClick(onFocus)}



            disabled={disabled || isSaving}



            className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"



          >



            Modo Focus



          </button>



        ) : null}



        {onDelete ? (



          <button



            type="button"



            onClick={handleClick(onDelete)}



            disabled={disabled || isSaving}



            className="inline-flex items-center rounded-full border border-rose-200 px-3 py-1 text-xs font-medium text-rose-700 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-60"



          >



            Excluir



          </button>



        ) : null}



        {onStatusChange ? (



          <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-600">



            <span>Atualizar status:</span>



            <select



              value={task.status}



              onChange={(event) => onStatusChange(event.target.value as TaskStatus)}



              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700"



              disabled={disabled || isSaving}



            >



              {TASK_STATUS_ORDER.map((status) => (



                <option key={status} value={status}>



                  {TASK_STATUS_LABELS[status]}



                </option>



              ))}



            </select>



          </label>



        ) : null}



      </div>

    </div>



  );



}







type TaskFocusPanelProps = {



  task: TaskOverviewItem | null;



  details: TaskEntity | null;



  state: "idle" | "loading" | "loaded" | "error";



  error: string | null;



  onClose: () => void;



  onMarkDone?: () => void;



  onMarkReview?: () => void;



  onRescheduleOpen?: () => void;



  onRescheduleChange: (value: string) => void;



  onRescheduleSubmit?: () => void;



  onRescheduleCancel: () => void;



  rescheduleState: RescheduleState;



  mutationTaskId: string | null;



  noteText: string;



  onNoteChange: (value: string) => void;



  noteState: "idle" | "saving";



  noteFeedback: string | null;



  onNoteSubmit: (event: FormEvent<HTMLFormElement>) => void;



  checklistInput: string;



  onChecklistInputChange: (value: string) => void;



  checklistState: "idle" | "saving";



  checklistFeedback: string | null;



  onChecklistUpdate: (next: Array<{ id: string; label: string; done: boolean }>) => void;



  assignees: TaskOverviewAssignee[];



  editForm: FocusEditForm | null;



  onEditChange: (field: keyof FocusEditForm, value: string | string[]) => void;



  onEditSubmit: () => void;



  editState: "idle" | "saving";



  editFeedback: { type: "success" | "error"; message: string } | null;



  disableActions: boolean;



  onRegisterHours?: () => void;



  canRegisterHours?: boolean;



  isRegisteringHours?: boolean;



  projects: ProjectOption[];



  hoursLogged: number | null;



  onStatusChange?: (status: TaskStatus) => void;



  onDelete?: () => void;



};







function TaskFocusPanel({



  task,



  details,



  state,



  error,



  onClose,



  onMarkDone,



  onMarkReview,



  onRescheduleOpen,



  onRescheduleChange,



  onRescheduleSubmit,



  onRescheduleCancel,



  rescheduleState,



  mutationTaskId,



  noteText,



  onNoteChange,



  noteState,



  noteFeedback,



  onNoteSubmit,



  checklistInput,



  onChecklistInputChange,



  checklistState,



  checklistFeedback,



  onChecklistUpdate,



  assignees,



  editForm,



  onEditChange,



  onEditSubmit,



  editState,



  editFeedback,



  disableActions,



  onRegisterHours,



  canRegisterHours = false,



  isRegisteringHours = false,



  projects,



  hoursLogged,



  onStatusChange,



  onDelete



}: TaskFocusPanelProps): JSX.Element | null {



  const assigneeOptionsList = useMemo(() => {



    if (!editForm) {



      return assignees;



    }



    const missingIds = editForm.assignees.filter(



      (assigneeId) => !assignees.some((member) => member.id === assigneeId)



    );



    if (missingIds.length === 0) {



      return assignees;



    }



    const fallback = missingIds.map((id) => ({



      id,



      name: "Responsavel não listado",



      color: null,



      role: null



    }));



    return [...assignees, ...fallback];



  }, [assignees, editForm]);



  const isEditingDisabled = disableActions || editState === "saving";







  if (!task) {



    return null;



  }







  const isMutating = mutationTaskId === task.id;



  const dueLabel = task.dueDate ? FULL_DATE_FORMATTER.format(new Date(task.dueDate)) : "Sem prazo";



  const description = details?.description ?? "Nenhum brief cadastrado para esta tarefa.";



  const checklistItems = details?.checklist ?? [];



  const checklistDone = checklistItems.filter((item) => item.done).length;



  const checklistTotal = checklistItems.length;



  const timeline = details?.activityLog ?? [];



  const showReschedule = Boolean(onRescheduleOpen && onRescheduleSubmit);

  const canLogHours = Boolean(onRegisterHours && canRegisterHours);



  const hoursSummaryLabel = hoursLogged && hoursLogged > 0 ? formatMinutesAsClock(hoursLogged) : "Sem registro";







  return (



    <aside className="fixed inset-y-0 right-0 z-40 w-full max-w-md border-l border-slate-200 bg-white shadow-2xl">



      <div className="flex h-full flex-col overflow-hidden">



        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">



          <div>



            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Modo Focus</p>



            <h2 className="text-lg font-semibold text-slate-900">{task.title}</h2>



          </div>



          <button



            type="button"



            onClick={onClose}



            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"



          >



            Fechar



          </button>



        </div>







        <div className="flex-1 overflow-y-auto space-y-6 px-6 py-6">



          <div className="space-y-2 rounded-3xl border border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-700">



            <div className="flex flex-wrap items-center gap-2">



              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${TASK_STATUS_STYLES[task.status]}`}>



                {TASK_STATUS_LABELS[task.status]}



              </span>



              <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${PRIORITY_STYLES[task.priority]}`}>



                {PRIORITY_LABELS[task.priority]}



              </span>



            </div>



            <p>
              Cliente: <span className="font-semibold">{task.client?.name ?? "Não informado"}</span>
            </p>



            <p>



              Projeto: <span className="font-semibold">{task.project?.name ?? "Sem projeto"}</span>



            </p>



            <p>Prazo: {dueLabel}</p>



            <p>



              Horas registradas: <span className="font-semibold">{hoursSummaryLabel}</span>



            </p>



          </div>







          <div className="space-y-3">



            <h3 className="text-sm font-semibold text-slate-900">Editar tarefa</h3>



            {editForm ? (



              <form



                className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4"



                onSubmit={(event) => {



                  event.preventDefault();



                  if (!isEditingDisabled) {



                    onEditSubmit();



                  }



                }}



              >



                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">



                  Titulo



                  <input



                    type="text"



                    value={editForm.title}



                    onChange={(event) => onEditChange("title", event.target.value)}



                    className="rounded-2xl border border-slate-300 px-3 py-2 font-normal text-slate-900 outline-none focus:border-deepGreen"



                    disabled={isEditingDisabled}



                  />



                </label>







                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">



                  Responsaveis



                  {assigneeOptionsList.length > 0 ? (



                    <select



                      multiple



                      value={editForm.assignees}



                      onChange={(event) =>



                        onEditChange(



                          "assignees",



                          Array.from(event.target.selectedOptions).map((option) => option.value)



                        )



                      }



                      className="min-h-[120px] rounded-2xl border border-slate-300 px-3 py-2 font-normal text-slate-900 outline-none focus:border-deepGreen"



                      disabled={isEditingDisabled}



                    >



                      {assigneeOptionsList.map((member) => (



                        <option key={member.id} value={member.id}>



                          {member.name}



                        </option>



                      ))}



                    </select>



                  ) : (



                    <p className="text-xs font-normal text-slate-500">



                      Sem membros ativos. Cadastre responsáveis nos filtros para liberar esta edição.



                    </p>



                  )}



                  <span className="text-xs font-normal text-slate-500">



                    Use Ctrl/Cmd para selecionar mais de um responsável.



                  </span>



                </label>







                <div className="grid gap-3 md:grid-cols-3">



                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">



                    Status



                    <select



                      value={editForm.status}



                      onChange={(event) => onEditChange("status", event.target.value)}



                      className="rounded-2xl border border-slate-300 px-3 py-2 font-normal text-slate-900 outline-none focus:border-deepGreen"



                      disabled={isEditingDisabled}



                    >



                      {TASK_STATUS_ORDER.map((status) => (



                        <option key={status} value={status}>



                          {TASK_STATUS_LABELS[status]}



                        </option>



                      ))}



                    </select>



                  </label>



                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">



                    Tipo



                    <select



                      value={editForm.type}



                      onChange={(event) => onEditChange("type", event.target.value)}



                      className="rounded-2xl border border-slate-300 px-3 py-2 font-normal text-slate-900 outline-none focus:border-deepGreen"



                      disabled={isEditingDisabled}



                    >



                      {TASK_TYPE_OPTIONS.map((option) => (



                        <option key={option.value} value={option.value}>



                          {option.label}



                        </option>



                      ))}



                    </select>



                  </label>



                  <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">



                    Prazo



                    <input



                      type="date"



                      value={editForm.dueDate}



                      onChange={(event) => onEditChange("dueDate", event.target.value)}



                      className="rounded-2xl border border-slate-300 px-3 py-2 font-normal text-slate-900 outline-none focus:border-deepGreen"



                      disabled={isEditingDisabled}



                    />



                  </label>



                </div>



                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">



                  Projeto



                  <select



                    value={editForm.projectId}



                    onChange={(event) => onEditChange("projectId", event.target.value)}



                    className="rounded-2xl border border-slate-300 px-3 py-2 font-normal text-slate-900 outline-none focus:border-deepGreen"



                    disabled={isEditingDisabled}



                  >



                    <option value="">Selecione um projeto</option>



                    {projects.map((project) => (



                      <option key={project.id} value={project.id}>



                        {project.displayName}



                      </option>



                    ))}



                  </select>



                </label>



                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-800">



                  Brief / Observacoes



                  <textarea



                    value={editForm.description}



                    onChange={(event) => onEditChange("description", event.target.value)}



                    rows={4}



                    className="rounded-2xl border border-slate-300 px-3 py-2 font-normal text-slate-900 outline-none focus:border-deepGreen"



                    disabled={isEditingDisabled}



                    placeholder="Contextualize o time sobre esta tarefa..."



                  />



                </label>







                {editFeedback ? (



                  <p



                    className={`text-xs ${



                      editFeedback.type === "success" ? "text-emerald-600" : "text-rose-600"



                    }`}



                  >



                    {editFeedback.message}



                  </p>



                ) : null}







                <button



                  type="submit"



                  disabled={isEditingDisabled}



                  className="w-full rounded-full bg-deepGreen px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"



                >



                  {editState === "saving" ? "Salvando..." : "Salvar mudancas"}



                </button>



              </form>



            ) : (



              <p className="text-sm text-slate-500">Carregando formulário de edição...</p>



            )}



          </div>







          <div className="space-y-3">



            <h3 className="text-sm font-semibold text-slate-900">Ações rápidas</h3>



            <QuickActionBar



              task={task}



              onMarkDone={onMarkDone ?? (() => {})}



              onMarkReview={onMarkReview ?? (() => {})}



              onRescheduleOpen={



                showReschedule && onRescheduleOpen ? onRescheduleOpen : () => {}



              }



              onRescheduleChange={onRescheduleChange}



              onRescheduleSubmit={



                showReschedule && onRescheduleSubmit ? onRescheduleSubmit : () => {}



              }



              onRescheduleCancel={onRescheduleCancel}



              rescheduleState={rescheduleState}



              isSaving={isMutating}



              disabled={disableActions}



              onStatusChange={onStatusChange}



              onDelete={onDelete}



            />



          </div>







          <div className="space-y-2">



            <h3 className="text-sm font-semibold text-slate-900">Brief</h3>



            {state === "loading" ? (



              <p className="text-sm text-slate-500">Carregando detalhes...</p>



            ) : (



              <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                {renderTextWithLinks(description)}
              </p>



            )}



          </div>













          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Checklist</h3>
              {checklistTotal > 0 ? (
                <span className="text-xs font-semibold text-slate-600">Progresso: {checklistDone}/{checklistTotal}</span>
              ) : null}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={checklistInput}
                  onChange={(event) => onChecklistInputChange(event.target.value)}
                  placeholder="Novo item"
                  className="flex-1 min-w-[200px] rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-deepGreen focus:outline-none"
                  disabled={checklistState === "saving"}
                />
                <button
                  type="button"
                  onClick={() => {
                    const value = checklistInput.trim();
                    if (!value) {
                      return;
                    }
                    const nextItem = { id: globalThis.crypto?.randomUUID?.() ?? Date.now().toString(), label: value, done: false };
                    void onChecklistUpdate([...checklistItems, nextItem]);
                  }}
                  disabled={checklistState === "saving"}
                  className="rounded-full bg-deepGreen px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-deepGreen/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Adicionar
                </button>
              </div>
              {checklistFeedback ? <p className="text-sm text-rose-600">{checklistFeedback}</p> : null}
              {checklistItems.length > 0 ? (
                <ul className="space-y-2">
                  {checklistItems.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-3 py-2"
                    >
                      <label className="flex items-center gap-3 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() =>
                            void onChecklistUpdate(
                              checklistItems.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, done: !entry.done } : entry
                              )
                            )
                          }
                          disabled={checklistState === "saving"}
                          className="h-4 w-4 rounded border-slate-300 text-deepGreen focus:ring-deepGreen"
                        />
                        <span className={item.done ? "line-through text-slate-500" : ""}>{item.label}</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          void onChecklistUpdate(checklistItems.filter((entry) => entry.id !== item.id))
                        }
                        disabled={checklistState === "saving"}
                        className="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-60"
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nenhum item cadastrado.</p>
              )}
            </div>
          </div>



          <div className="space-y-3">



            <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>



            {state === "error" ? (



              <p className="text-sm text-rose-600">{error}</p>



            ) : timeline.length > 0 ? (



              <ul className="space-y-3">



                {timeline



                  .slice(-5)



                  .reverse()



                  .map((entry) => (



                    <li



                      key={entry.id}



                      className="rounded-2xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600"



                    >



                      <p className="font-semibold text-slate-800">{entry.message}</p>



                      <p>{new Date(entry.createdAt).toLocaleString("pt-BR")}</p>



                    </li>



                  ))}



              </ul>



            ) : (



              <p className="text-sm text-slate-500">Nenhum evento registrado ainda.</p>



            )}



          </div>







          <div className="space-y-3">



            <h3 className="text-sm font-semibold text-slate-900">Adicionar atualização</h3>



            <form onSubmit={onNoteSubmit} className="space-y-2">



              <textarea



                value={noteText}



                onChange={(event) => onNoteChange(event.target.value)}



                className="min-h-[100px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none focus:border-deepGreen"



                placeholder="Conte rapidamente o que mudou ou qual o próximo passo..."



                disabled={noteState === "saving" || disableActions}



              />



              {noteFeedback ? <p className="text-xs text-rose-600">{noteFeedback}</p> : null}



              <button



                type="submit"



                disabled={noteState === "saving" || disableActions}



                className="rounded-full bg-deepGreen px-4 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"



              >



                {noteState === "saving" ? "Salvando..." : "Enviar atualização"}



              </button>



            </form>



          </div>







          <div className="flex flex-wrap gap-3">



            <p className="text-xs text-slate-500">Horas registradas: {hoursSummaryLabel}</p>



            <button



              type="button"



              onClick={onRegisterHours}



              disabled={!canLogHours || disableActions || isRegisteringHours}



              className="inline-flex items-center rounded-full border border-deepGreen/30 px-4 py-1.5 text-sm font-semibold text-deepGreen transition hover:border-deepGreen/60 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"



            >



              {isRegisteringHours ? "Registrando..." : "Registrar horas"}



            </button>



            <a



              href="/calendar"



              className="inline-flex items-center rounded-full border border-slate-300 px-4 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-500"



            >



              Abrir calendário



            </a>



            <a



              href="/projects"



              className="inline-flex items-center rounded-full border border-terracota px-4 py-1.5 text-sm font-semibold text-terracota hover:bg-terracota/10"



            >



              Abrir projeto



            </a>



          </div>



          {!canLogHours ? (



            <p className="text-xs text-slate-500">Associe a tarefa a um projeto para lançar horas.</p>



          ) : null}



        </div>



      </div>



    </aside>



  );



}



type TaskHoursModalProps = {



  open: boolean;



  task: TaskOverviewItem | null;



  form: HoursFormState;



  isSaving: boolean;



  feedback: string | null;



  onClose: () => void;



  onChange: (field: keyof HoursFormState, value: string) => void;



  onSubmit: (event: FormEvent<HTMLFormElement>) => void;



};



function TaskHoursModal({



  open,



  task,



  form,



  isSaving,



  feedback,



  onClose,



  onChange,



  onSubmit



}: TaskHoursModalProps): JSX.Element | null {



  if (!open || !task) {



    return null;



  }



  return (



    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">



      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">



        <div className="flex items-start justify-between gap-4">



          <div>



            <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Tempo</p>



            <h3 className="text-lg font-semibold text-deepGreen">Registrar horas</h3>



            <p className="text-xs text-deepGreen/60">Registre o esforço desta tarefa sem sair do modo Focus.</p>



          </div>



          <button



            type="button"



            onClick={onClose}



            className="rounded-full border border-deepGreen/20 px-3 py-1 text-xs font-semibold text-deepGreen hover:border-deepGreen/40"



          >



            Fechar



          </button>



        </div>



        <form className="mt-4 space-y-4 text-sm text-deepGreen" onSubmit={onSubmit}>



          <div>



            <p className="font-semibold">{task.title}</p>



            <p className="text-xs text-deepGreen/60">Projeto: {task.project?.name ?? "Sem projeto"}</p>



          </div>



          <label className="block text-xs font-semibold text-deepGreen">



            Data



            <input



              type="date"



              value={form.date}



              onChange={(event) => onChange("date", event.target.value)}



              className="mt-1 w-full rounded-xl border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"



              max={getTodayDateInput()}



            />



          </label>



          <label className="block text-xs font-semibold text-deepGreen">



            Minutos trabalhados



            <input



              type="number"



              min="1"



              step="1"



              value={form.minutes}



              onChange={(event) => onChange("minutes", event.target.value)}



              className="mt-1 w-full rounded-xl border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"



              placeholder="Ex.: 30"



              required



            />



          </label>



          <label className="block text-xs font-semibold text-deepGreen">



            Observações (opcional)



            <textarea



              rows={3}



              value={form.notes}



              onChange={(event) => onChange("notes", event.target.value)}



              className="mt-1 w-full rounded-xl border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"



              placeholder="Resultados, aprendizados ou contexto..."



            />



          </label>



          {feedback ? <p className="text-xs text-rose-600">{feedback}</p> : null}



          <div className="flex items-center justify-end gap-3 pt-2">



            <button



              type="button"



              onClick={onClose}



              className="rounded-full border border-deepGreen/20 px-4 py-2 text-xs font-semibold text-deepGreen hover:border-deepGreen/40"



            >



              Cancelar



            </button>



            <button



              type="submit"



              disabled={isSaving}



              className="rounded-full bg-deepGreen px-5 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"



            >



              {isSaving ? "Registrando..." : "Registrar horas"}



            </button>



          </div>



        </form>



      </div>



    </div>



  );



}







type CreateTaskModalProps = {



  open: boolean;



  form: CreateTaskForm;



  projects: ProjectOption[];



  assignees: TaskOverviewAssignee[];



  state: "idle" | "saving";



  feedback: string | null;



  onClose: () => void;



  onChange: (field: keyof CreateTaskForm, value: string | string[] | CreateTaskForm["checklist"]) => void;



  onSubmit: (event: FormEvent<HTMLFormElement>) => void;



};







function CreateTaskModal({



  open,



  form,



  projects,



  assignees,



  state,



  feedback,



  onClose,



  onChange,



  onSubmit



}: CreateTaskModalProps): JSX.Element | null {



  if (!open) {



    return null;



  }



  const selectedProject = projects.find((project) => project.id === form.projectId) ?? null;







  const handleAssigneeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {



    const values = Array.from(event.target.selectedOptions).map((option) => option.value);



    onChange("assignees", values);



  };







  return (



    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">



      <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl">



        <div className="flex items-start justify-between gap-3">



          <div>



            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Nova tarefa</p>



            <h2 className="text-2xl font-semibold text-slate-900">Adicionar ao pipeline</h2>



            <p className="text-sm text-slate-500">



              Defina o projeto, responsável e prazo para já cair na lista principal.



            </p>



          </div>



          <button



            type="button"



            onClick={onClose}



            className="rounded-full border border-slate-300 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50"



          >



            Fechar



          </button>



        </div>







        <form className="mt-6 space-y-4" onSubmit={onSubmit}>



          <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">



            Nome da tarefa *



            <input



              type="text"



              value={form.title}



              onChange={(event) => onChange("title", event.target.value)}



              className="rounded-2xl border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-deepGreen"



              placeholder="Ex.: Revisar criativos de Natal"



              required



            />



          </label>







          <div className="grid gap-4 md:grid-cols-2">



            <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">



              Projeto *



              <select



                value={form.projectId}



                onChange={(event) => onChange("projectId", event.target.value)}



                className="rounded-2xl border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-deepGreen"



                required



              >



                <option value="">Escolha um projeto do cliente</option>



                {projects.map((project) => (



                  <option key={project.id} value={project.id}>



                    {project.displayName}



                  </option>



                ))}



              </select>



              <span className="text-xs font-normal text-slate-500">



                {selectedProject?.clientName



                  ? `Cliente: ${selectedProject.clientName}`



                  : "Mostramos o cliente ao lado do projeto para facilitar a escolha."}



              </span>



            </label>



            <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">



              Prazo



              <input



                type="date"



                value={form.dueDate}



                onChange={(event) => onChange("dueDate", event.target.value)}



                className="rounded-2xl border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-deepGreen"



              />



            </label>



          </div>







          <div className="grid gap-4 md:grid-cols-2">



            <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">



              Responsáveis



              <select



                multiple



                value={form.assignees}



                onChange={handleAssigneeChange}



                className="min-h-[120px] rounded-2xl border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-deepGreen"



              >



                {assignees.map((member) => (



                  <option key={member.id} value={member.id}>



                    {member.name}



                  </option>



                ))}



              </select>



              <span className="text-xs font-normal text-slate-500">



                Use Ctrl/Cmd + clique para selecionar mais de um.



              </span>



            </label>



            <div className="grid gap-4">



              <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">



                Tipo



                <select



                  value={form.type}



                  onChange={(event) => onChange("type", event.target.value)}



                  className="rounded-2xl border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-deepGreen"



                >



                  {TASK_TYPE_OPTIONS.map((option) => (



                    <option key={option.value} value={option.value}>



                      {option.label}



                    </option>



                  ))}



                </select>



              </label>



              <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">



                Status



                <select



                  value={form.status}



                  onChange={(event) => onChange("status", event.target.value)}



                  className="rounded-2xl border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-deepGreen"



                >



                  {TASK_STATUS_ORDER.map((status) => (



                    <option key={status} value={status}>



                      {TASK_STATUS_LABELS[status]}



                    </option>



                  ))}



                </select>



              </label>



            </div>



          </div>







          <label className="flex flex-col gap-2 text-sm font-medium text-slate-800">



            Notas/brief



            <textarea



              value={form.notes}



              onChange={(event) => onChange("notes", event.target.value)}



              className="min-h-[120px] rounded-2xl border border-slate-300 px-4 py-2 text-slate-900 outline-none focus:border-deepGreen"



              placeholder="Contexto rápido para o responsável..."



            />



          </label>







          <div className="space-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">Checklist (opcional)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={form.checklistInput ?? ""}
                onChange={(event) => onChange("checklistInput" as keyof CreateTaskForm, event.target.value)}
                placeholder="Adicionar item do checklist"
                className="flex-1 min-w-[220px] rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-deepGreen focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const value = String(form.checklistInput ?? "").trim();
                  if (!value) {
                    return;
                  }
                  const nextItem = { id: (globalThis.crypto?.randomUUID?.() ?? Date.now().toString()) as string, label: value, done: false };
                  onChange("checklist" as keyof CreateTaskForm, [...form.checklist, nextItem]);
                  onChange("checklistInput" as keyof CreateTaskForm, "");
                }}
                className="rounded-full bg-deepGreen px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-deepGreen/90"
              >
                Adicionar
              </button>
            </div>
            {form.checklist.length > 0 ? (
              <ul className="space-y-2">
                {form.checklist.map((item, index) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-500">{index + 1}.</span>
                      <span className="text-sm text-slate-800">{item.label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onChange("checklist" as keyof CreateTaskForm, form.checklist.filter((entry) => entry.id !== item.id))
                      }
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Nenhum item adicionado.</p>
            )}
          </div>

          {feedback ? <p className="text-sm text-rose-600">{feedback}</p> : null}







          <div className="flex flex-wrap gap-3">



            <button



              type="submit"



              disabled={state === "saving"}



              className="rounded-full bg-deepGreen px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"



            >



              {state === "saving" ? "Criando..." : "Criar tarefa"}



            </button>



            <button



              type="button"



              onClick={onClose}



              className="rounded-full border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"



            >



              Cancelar



            </button>



          </div>



        </form>



      </div>



    </div>



  );



}







function AssigneeStack({ assignees }: { assignees: TaskOverviewItem["assignees"] }): JSX.Element {



  if (assignees.length === 0) {



    return <p className="text-xs text-slate-500">Defina um responsável</p>;



  }







  return (



    <div className="flex items-center -space-x-2">



      {assignees.slice(0, 3).map((assignee, index) => (



        <span



          key={assignee.id}



          className={`inline-flex size-9 items-center justify-center rounded-full border-2 border-white text-xs font-semibold text-white ${



            assignee.color ? "" : ASSIGNEE_COLORS[index % ASSIGNEE_COLORS.length]



          }`}



          style={assignee.color ? { backgroundColor: assignee.color } : undefined}



          title={assignee.name}



        >



          {getInitials(assignee.name)}



        </span>



      ))}



      {assignees.length > 3 ? (



        <span className="inline-flex size-9 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-xs font-semibold text-slate-700">



          +{assignees.length - 3}



        </span>



      ) : null}



    </div>



  );



}







function getInitials(name: string): string {



  return name



    .split(" ")



    .filter(Boolean)



    .slice(0, 2)



    .map((chunk) => chunk[0]?.toUpperCase() ?? "")



    .join("");



}




































































