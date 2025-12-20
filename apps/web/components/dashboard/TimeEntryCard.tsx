'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import { formatMinutesAsClock } from "../../lib/datetime";
import type { ProjectSummary } from "../../types/projects";
import type { TaskEntity } from "../../types/tasks";
import type { TimeEntry } from "../../types/time-entries";
import { useAuth } from "../auth/AuthProvider";

type FetchState =
  | { status: "idle"; items: TimeEntry[] }
  | { status: "loading"; items: TimeEntry[] }
  | { status: "loaded"; items: TimeEntry[] }
  | { status: "error"; items: TimeEntry[]; message: string };

type ComboState<T> =
  | { status: "idle"; items: T[]; message?: string }
  | { status: "loading"; items: T[]; message?: string }
  | { status: "loaded"; items: T[]; message?: string }
  | { status: "error"; items: T[]; message: string };

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TimeEntryCard() {
  const { token, status: authStatus } = useAuth();
  const [entriesState, setEntriesState] = useState<FetchState>({ status: "idle", items: [] });
  const [projectsState, setProjectsState] = useState<ComboState<ProjectSummary>>({
    status: "idle",
    items: []
  });
  const [tasksState, setTasksState] = useState<ComboState<TaskEntity>>({ status: "idle", items: [] });
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [date, setDate] = useState(getToday());
  const [minutes, setMinutes] = useState("60");
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAuthenticated = authStatus === "authenticated" && Boolean(token);

  const loadEntries = useCallback(async (currentToken: string) => {
    setEntriesState((prev) => ({ ...prev, status: "loading" }));
    const response = await apiFetch<{ items: TimeEntry[] }>("/time-entries", {
      token: currentToken,
      query: { limit: 5 }
    });
    setEntriesState({ status: "loaded", items: response.items });
  }, []);

  const loadProjects = useCallback(async (currentToken: string) => {
    setProjectsState({ status: "loading", items: [] });
    const response = await apiFetch<{ items: ProjectSummary[] }>("/projects", { token: currentToken });
    setProjectsState({ status: "loaded", items: response.items });
    setProjectId((current) => (current ? current : response.items[0]?.id ?? ""));
  }, []);

  const loadTasks = useCallback(async (currentToken: string, currentProjectId: string) => {
    setTasksState({ status: "loading", items: [] });
    const response = await apiFetch<{ items: TaskEntity[] }>(
      `/projects/${currentProjectId}/tasks`,
      { token: currentToken }
    );
    setTasksState({ status: "loaded", items: response.items });
    if (response.items.length > 0) {
      setTaskId(response.items[0].id);
    } else {
      setTaskId("");
    }
  }, []);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setEntriesState({ status: "idle", items: [] });
      setProjectsState({ status: "idle", items: [] });
      setTasksState({ status: "idle", items: [] });
      setProjectId("");
      setTaskId("");
      return;
    }

    let cancelled = false;

    loadEntries(token).catch((error) => {
      if (cancelled) return;
      const message =
        error instanceof ApiError ? error.message : "Não foi possivel carregar os lançamentos.";
      setEntriesState({ status: "error", items: [], message });
    });

    loadProjects(token).catch((error) => {
      if (cancelled) return;
      const message =
        error instanceof ApiError ? error.message : "Não foi possivel carregar os projetos.";
      setProjectsState({ status: "error", items: [], message });
    });

    return () => {
      cancelled = true;
    };
  }, [token, isAuthenticated, loadEntries, loadProjects]);

  useEffect(() => {
    if (!token || !isAuthenticated || !projectId) {
      setTasksState({ status: "idle", items: [] });
      setTaskId("");
      return;
    }

    loadTasks(token, projectId).catch((error) => {
      const message =
        error instanceof ApiError ? error.message : "Não foi possivel carregar as tarefas.";
      setTasksState({ status: "error", items: [], message });
    });
  }, [token, isAuthenticated, projectId, loadTasks]);

  const items = entriesState.items;

  const totalToday = useMemo(() => {
    if (!items.length) {
      return 0;
    }
    const today = getToday();
    return items
      .filter((entry) => entry.date.startsWith(today))
      .reduce((acc, entry) => acc + entry.reportedMinutes, 0);
  }, [items]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !isAuthenticated) {
      return;
    }
    if (!projectId || !taskId) {
      setFeedback("Selecione um projeto e uma tarefa");
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      await apiFetch("/time-entries", {
        token,
        method: "POST",
        body: {
          projectId,
          taskId,
          date,
          reportedMinutes: Number(minutes),
          notes: notes.trim() ? notes.trim() : undefined
        }
      });
      setMinutes("60");
      setNotes("");
      await loadEntries(token);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possivel registrar as horas.";
      setFeedback(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token || !isAuthenticated) {
      return;
    }
    setDeletingId(id);
    setFeedback(null);
    try {
      await apiFetch(`/time-entries/${id}`, {
        token,
        method: "DELETE"
      });
      await loadEntries(token);
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "Não foi possivel excluir o lançamento.";
      setFeedback(message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Produtividade</p>
          <h2 className="text-xl font-semibold text-deepGreen">Lançamentos de horas</h2>
          {items.length > 0 ? (
            <p className="text-xs text-deepGreen/60">Hoje: {formatMinutesAsClock(totalToday)}</p>
          ) : null}
        </div>
      </div>

      {!isAuthenticated ? (
        <p className="text-sm text-deepGreen/70">
          Faca login para lancar horas e acompanhar os registros da equipe.
        </p>
      ) : (
        <>
          {feedback ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {feedback}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-deepGreen">
                Projeto
                <select
                  value={projectId}
                  onChange={(event) => {
                    setProjectId(event.target.value);
                    setTaskId("");
                  }}
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 bg-white px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                  disabled={isSaving || projectsState.status === "loading"}
                >
                  {projectsState.items.length === 0 ? (
                    <option value="">Nenhum projeto disponível</option>
                  ) : null}
                  {projectsState.items.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                {projectsState.status === "error" ? (
                  <p className="text-[11px] text-red-600">{projectsState.message}</p>
                ) : null}
              </label>
              <label className="text-xs font-semibold text-deepGreen">
                Tarefa
                <select
                  value={taskId}
                  onChange={(event) => setTaskId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 bg-white px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                  disabled={isSaving || tasksState.status === "loading" || !projectId}
                >
                  {tasksState.items.length === 0 ? (
                    <option value="">Selecione um projeto</option>
                  ) : null}
                  {tasksState.items.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
                {tasksState.status === "error" ? (
                  <p className="text-[11px] text-red-600">{tasksState.message}</p>
                ) : null}
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-deepGreen">
                Data
                <input
                  type="date"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                  disabled={isSaving}
                />
              </label>
              <label className="text-xs font-semibold text-deepGreen">
                Minutos trabalhados
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                  disabled={isSaving}
                />
              </label>
            </div>
            <label className="text-xs font-semibold text-deepGreen">
              Notas (opcional)
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
                placeholder="Descrição do trabalho realizado"
                disabled={isSaving}
              />
            </label>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-full bg-terracota px-5 py-2 text-sm font-semibold text-offWhite shadow shadow-terracota/40 transition hover:bg-terracota/90 disabled:opacity-60"
            >
              {isSaving ? "Registrando..." : "Registrar horas"}
            </button>
          </form>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-deepGreen/50">
              Últimos lançamentos
            </p>
            {entriesState.status === "loading" ? (
              <p className="text-sm text-deepGreen/70">Carregando...</p>
            ) : null}
            {entriesState.status === "error" ? (
              <p className="text-sm text-red-600">{entriesState.message}</p>
            ) : null}
            {items.length === 0 && entriesState.status === "loaded" ? (
              <p className="text-sm text-deepGreen/70">Nenhum lançamento registrado ainda.</p>
            ) : null}
            <ul className="space-y-2">
              {items.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-deepGreen/15 bg-white/80 px-3 py-2 text-sm text-deepGreen/80"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-deepGreen">
                        {entry.reportedMinutes} min - {new Date(entry.date).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-deepGreen/60">
                        Projeto {entry.projectId} - Tarefa {entry.taskId}
                      </p>
                      {entry.notes ? (
                        <p className="text-xs text-deepGreen/70">{entry.notes}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(entry.id)}
                      disabled={deletingId === entry.id}
                      className="text-xs font-semibold text-terracota underline-offset-4 hover:underline disabled:opacity-50"
                    >
                      {deletingId === entry.id ? "Removendo..." : "Remover"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}

