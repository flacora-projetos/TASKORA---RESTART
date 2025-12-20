'use client';

import { useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type { ProjectSummary, ProjectStatus } from "../../types/projects";
import { useAuth } from "../auth/AuthProvider";

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: "Rascunho",
  active: "Em andamento",
  paused: "Pausado",
  completed: "Concluido"
};

type State =
  | { status: "idle"; items: ProjectSummary[] }
  | { status: "loading"; items: ProjectSummary[] }
  | { status: "loaded"; items: ProjectSummary[] }
  | { status: "error"; items: ProjectSummary[]; message: string };

type Props = {
  clientId: string;
};

export function ClientProjectsCard({ clientId }: Props): JSX.Element {
  const { token, status: authStatus } = useAuth();
  const [state, setState] = useState<State>({ status: "idle", items: [] });

  useEffect(() => {
    if (!token || authStatus !== "authenticated") {
      setState({ status: "idle", items: [] });
      return;
    }

    let isMounted = true;
    setState((prev) => ({ ...prev, status: "loading" }));

    apiFetch<{ items: ProjectSummary[] }>("/projects", {
      token,
      query: { clientId }
    })
      .then((response) => {
        if (!isMounted) {
          return;
        }
        setState({ status: "loaded", items: response.items });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        const message = error instanceof ApiError ? error.message : "Não foi possivel carregar os projetos.";
        setState({ status: "error", items: [], message });
      });

    return () => {
      isMounted = false;
    };
  }, [authStatus, clientId, token]);

  const stats = useMemo(() => {
    const counters: Record<ProjectStatus, number> = {
      draft: 0,
      active: 0,
      paused: 0,
      completed: 0
    };
    state.items.forEach((project) => {
      counters[project.status] += 1;
    });
    return counters;
  }, [state.items]);

  const recentProjects = useMemo(
    () => state.items.slice(0, 5).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [state.items]
  );

  return (
    <section className="rounded-2xl border border-deepGreen/15 bg-white/95 p-6 shadow-sm">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Projetos</p>
          <h2 className="text-xl font-semibold text-deepGreen">Projetos do cliente</h2>
          <p className="text-sm text-deepGreen/60">
            Saiba quantos projetos estao em andamento e quais foram atualizados mais recentemente.
          </p>
        </div>
        {state.status === "error" ? (
          <span className="text-xs font-semibold text-red-600">{state.message}</span>
        ) : null}
      </header>

      {authStatus !== "authenticated" ? (
        <p className="mt-4 rounded-lg border border-dashed border-deepGreen/20 px-4 py-3 text-sm text-deepGreen/60">
          Entre no dashboard para visualizar os projetos deste cliente.
        </p>
      ) : null}

      {state.status === "loading" && state.items.length === 0 ? (
        <p className="mt-4 text-sm text-deepGreen/60">Buscando projetos...</p>
      ) : null}

      {state.items.length === 0 && state.status === "loaded" ? (
        <div className="mt-4 rounded-lg border border-dashed border-deepGreen/20 px-4 py-4 text-sm text-deepGreen/60">
          <p>Ainda não existe nenhum projeto para este cliente.</p>
          <a
            href={`/projects?clientId=${clientId}`}
            className="mt-3 inline-flex items-center justify-center rounded-full border border-terracota/40 px-4 py-1 text-xs font-semibold text-terracota"
          >
            Abrir módulo de projetos
          </a>
        </div>
      ) : null}

      {state.items.length > 0 ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(Object.keys(stats) as ProjectStatus[]).map((status) => (
              <div key={status} className="rounded-xl border border-deepGreen/10 bg-offWhite/70 p-3 text-center">
                <p className="text-xs text-deepGreen/60">{STATUS_LABELS[status]}</p>
                <p className="text-2xl font-semibold text-deepGreen">{stats[status]}</p>
                <p className="text-[11px] text-deepGreen/50">projetos</p>
              </div>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-deepGreen">Mais recentes</h3>
              <span className="text-xs text-deepGreen/60">{state.items.length} projeto(s)</span>
            </div>
            <ul className="space-y-3">
              {recentProjects.map((project) => (
                <li key={project.id} className="rounded-xl border border-deepGreen/10 bg-white px-4 py-3 text-sm text-deepGreen">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold">{project.name}</p>
                    <span className="rounded-full border border-deepGreen/15 px-3 py-0.5 text-xs font-semibold text-deepGreen/70">
                      {STATUS_LABELS[project.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-deepGreen/60">
                    Atualizado em{" "}
                    {new Date(project.updatedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}
