'use client';

import { useEffect, useMemo, useState } from "react";

import { AdSpendTable } from "./AdSpendTable";
import { ClientOnboardingCard } from "./ClientOnboardingCard";
import { useDailyTaskSummary } from "./DailyTaskSummaryCard";
import { DashboardAlertCard } from "./DashboardAlertCard";
import { HoursTrendCard } from "./HoursTrendCard";
import { IntegrationAlertsCard } from "./IntegrationAlertsCard";
import { JobsStatusCard } from "./JobsStatusCard";
import { PlatformIntegrationsCard } from "./PlatformIntegrationsCard";
import { buildSummaryCardData } from "./SummaryCards";
import { TaskListCard } from "./TaskListCard";
import { TASK_STATUS_LABELS } from "../../constants/tasks";
import { useDashboardSummary } from "../../hooks/useDashboardSummary";
import type { HealthPayload } from "../../lib/health";
import type { TaskStatus } from "../../types/tasks";
import { useAuth } from "../auth/AuthProvider";

type DashboardShellProps = {
  health: {
    status: "ok" | "warning" | "error";
    payload: HealthPayload | null;
  };
};

export function DashboardShell({ health: _health }: DashboardShellProps): JSX.Element {
  const { user, status, token } = useAuth();
  const heroHint =
    status === "authenticated" && user
      ? `Conectado como ${user.email ?? user.uid}`
      : 'Use o botao "Entrar" para liberar os dados em tempo real.';

  const [todayLabel, setTodayLabel] = useState<string>("--");
  useEffect(() => {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "short"
    });
    setTodayLabel(formatter.format(new Date()));
  }, []);

  const {
    metrics,
    metricsStatus,
    metricsMessage,
    hours,
    hoursStatus,
    hoursMessage,
    alerts,
    jobs,
    jobsStatus,
    jobsMessage
  } = useDashboardSummary(token);

  const heroStatusLabel =
    metrics && status === "authenticated"
      ? `${metrics.clients.active} clientes ativos - ${metrics.projects.active} projetos em andamento`
      : "Conecte os IDs oficiais para destravar as metricas em tempo real.";

  const dailyTasksSummary = useDailyTaskSummary();

  const heroCards = useMemo(() => {
    const baseCards = buildSummaryCardData({
      metrics,
      metricsStatus,
      hoursReport: hours,
      hoursStatus,
      hoursMessage
    }).map((card) => ({
      label: card.label,
      value: card.value,
      helper: card.helper
    }));

    const overdueValue =
      dailyTasksSummary.status === "loaded"
        ? dailyTasksSummary.data.overdue.toLocaleString("pt-BR")
        : dailyTasksSummary.status === "error"
          ? "--"
          : "...";

    const statusHelpers: Record<TaskStatus, string> = {
      backlog: "Planejamento",
      todo: "A fazer hoje",
      in_progress: "Em andamento hoje",
      review: "Em revisao hoje",
      blocked: "Bloqueadas hoje",
      done: "Concluidas hoje"
    };

    const statusOrder: TaskStatus[] = ["backlog", "todo", "in_progress", "review", "blocked", "done"];

    baseCards.push({
      label: "Tarefas atrasadas",
      value: overdueValue,
      helper:
        dailyTasksSummary.status === "error"
          ? "Erro ao carregar atrasadas."
          : "Abertas e vencidas, independente do filtro de periodo."
    });

    statusOrder.forEach((taskStatus) => {
      let value = "...";
      if (dailyTasksSummary.status === "loaded") {
        const entry = dailyTasksSummary.data.statuses.find((item) => item.status === taskStatus);
        value = entry ? entry.value.toLocaleString("pt-BR") : "0";
      } else if (dailyTasksSummary.status === "error") {
        value = "--";
      }

      baseCards.push({
        label: TASK_STATUS_LABELS[taskStatus],
        value,
        helper:
          dailyTasksSummary.status === "error"
            ? "Erro ao carregar tarefas."
            : statusHelpers[taskStatus]
      });
    });

    return baseCards;
  }, [
    metrics,
    metricsStatus,
    hours,
    hoursStatus,
    hoursMessage,
    dailyTasksSummary
  ]);

  return (
    <div className="space-y-10 bg-slate-50 px-4 py-6 lg:px-8">
      <section className="space-y-6 rounded-xl bg-gradient-to-br from-emerald-950 to-emerald-800 p-8 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-offWhite/80">Visao diaria</p>
            <h1 className="text-3xl font-semibold leading-tight">Visao geral da operacao</h1>
            <p className="text-sm text-offWhite/80">{heroStatusLabel}</p>
            <p className="text-sm text-offWhite/70">{heroHint}</p>
          </div>
          <div className="text-right text-xs uppercase tracking-[0.3em] text-white/70">
            <p>{todayLabel}</p>
            <p>Operacao Dacora</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {heroCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-white/20 bg-white/10 p-4 text-white shadow-sm backdrop-blur"
            >
              <p className="text-xs uppercase tracking-wide text-white/70">{card.label}</p>
              <p className="text-3xl font-semibold">{card.value}</p>
              <p className="text-xs text-white/70">{card.helper}</p>
            </div>
          ))}
        </div>
        {metricsStatus === "error" && metricsMessage ? (
          <p className="text-xs font-semibold text-red-200">{metricsMessage}</p>
        ) : null}
        {metricsStatus === "idle" && !metrics ? (
          <p className="text-xs text-white/80">
            Conecte-se no topo da pagina para liberar os indicadores em tempo real.
          </p>
        ) : null}
        {dailyTasksSummary.status === "error" ? (
          <p className="text-xs text-amber-200">Nao foi possivel carregar as tarefas do dia.</p>
        ) : null}
      </section>

      <section>
        <AdSpendTable />
      </section>

      <section>
        <TaskListCard />
      </section>

      <section>
        <HoursTrendCard />
      </section>

      <section className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Suporte operacional</p>
          <h2 className="text-xl font-semibold text-deepGreen">Integracoes, jobs e saude do sistema</h2>
          <p className="text-sm text-deepGreen/60">Esses indicadores ajudam o time tecnico a garantir estabilidade apos cada revisao.</p>
        </header>

        {(() => {
          const hasRelevantJobs =
            jobs.length > 0 &&
            jobs.some((job) => job.status !== "pending" || job.lastRunAt || (job.message && job.message.length > 0));
          if (!hasRelevantJobs) {
            return null;
          }
          return (
            <JobsStatusCard jobs={jobs} status={jobsStatus} message={jobsMessage} variant="compact" />
          );
        })()}

        <ClientOnboardingCard />

        <div className="space-y-6">
          <IntegrationAlertsCard />
          <PlatformIntegrationsCard />
        </div>

        {alerts.length ? (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Clientes que precisam de atencao</p>
            <div className="grid gap-3 md:grid-cols-3">
              {alerts.map((alert) => (
                <DashboardAlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
