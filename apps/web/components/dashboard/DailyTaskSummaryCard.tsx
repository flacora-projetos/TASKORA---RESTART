'use client';

import { useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import type { TaskOverviewItem, TaskOverviewResponse, TaskStatus } from "../../types/tasks";
import { useAuth } from "../auth/AuthProvider";

const STATUS_ORDER: TaskStatus[] = ["todo", "in_progress", "review", "blocked", "done"];

type DailyTaskSnapshot = {
  total: number;
  statuses: Array<{ status: TaskStatus; value: number }>;
  overdue: number;
};

type DailyTaskSummaryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; data: DailyTaskSnapshot }
  | { status: "error"; message: string };

export function useDailyTaskSummary(): DailyTaskSummaryState {
  const { token, status } = useAuth();
  const [state, setState] = useState<DailyTaskSummaryState>({ status: "idle" });

  useEffect(() => {
    if (!token || status !== "authenticated") {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });

    apiFetch<TaskOverviewResponse>("/tasks/overview", {
      token,
      query: { period: "today" }
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        const { start, end } = resolveUtcDayWindow();
        const todaysTasks = filterTasksByWindow(response.items, start, end);
        const overdueTotal =
          response.cards?.overdue?.total ?? response.items.filter((task) => task.priority === "overdue").length;
        const total = response.cards?.today?.total ?? todaysTasks.length;
        const statuses = STATUS_ORDER.map((taskStatus) => ({
          status: taskStatus,
          value: todaysTasks.filter((task) => task.status === taskStatus).length
        }));

        setState({ status: "loaded", data: { total, statuses, overdue: overdueTotal } });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const message =
          error instanceof ApiError ? error.message : "Nao foi possivel carregar as tarefas de hoje.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [token, status]);

  return state;
}

export function DailyTaskSummaryCard(): JSX.Element {
  const summary = useDailyTaskSummary();
  const body = useMemo(() => {
    if (summary.status === "loading") {
      return <p className="text-sm text-offWhite/80">Atualizando tarefas...</p>;
    }
    if (summary.status === "error") {
      return <p className="text-sm text-rose-200">{summary.message}</p>;
    }
    if (summary.status !== "loaded") {
      return <p className="text-sm text-offWhite/80">Conecte-se para acompanhar as tarefas do dia.</p>;
    }
    return (
      <div className="space-y-2">
        <p className="text-3xl font-semibold text-offWhite">{summary.data.total}</p>
        <p className="text-sm text-offWhite/70">Tarefas planejadas hoje</p>
        <p className="text-xs text-offWhite/60">Atrasadas: {summary.data.overdue.toLocaleString("pt-BR")}</p>
      </div>
    );
  }, [summary]);

  return (
    <div className="rounded-3xl border border-white/20 bg-white/10 p-4 text-offWhite shadow-lg shadow-black/30">
      <p className="text-xs uppercase tracking-[0.3em] text-offWhite/70">Tarefas do dia</p>
      {body}
    </div>
  );
}

function resolveUtcDayWindow(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  const end = new Date(start);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end };
}

function filterTasksByWindow(items: TaskOverviewItem[] | undefined, start: Date, end: Date): TaskOverviewItem[] {
  if (!items || items.length === 0) {
    return [];
  }
  return items.filter((task) => {
    if (!task.dueDate) {
      return false;
    }
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) {
      return false;
    }
    return due >= start && due <= end;
  });
}
