'use client';

import type { DashboardJob } from "../../types/dashboard";

type Props = {
  jobs: DashboardJob[];
  status: "idle" | "loading" | "loaded" | "error";
  message?: string | null;
  variant?: "default" | "compact";
};

const STATUS_STYLE: Record<DashboardJob["status"], string> = {
  success: "text-emerald-800",
  warning: "text-amber-700",
  error: "text-red-700",
  pending: "text-deepGreen/70"
};

export function JobsStatusCard({ jobs, status, message, variant = "default" }: Props): JSX.Element {
  const isCompact = variant === "compact";
  const containerClass = isCompact
    ? "rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-4 space-y-3"
    : "card space-y-4 p-6";
  const titleClass = isCompact ? "text-base font-semibold text-deepGreen" : "text-xl font-semibold text-deepGreen";
  const listWrapperClass = isCompact ? "grid gap-3 sm:grid-cols-2" : "space-y-3";
  const jobCardClass = isCompact
    ? "h-full rounded-2xl border border-deepGreen/10 bg-white/90 px-3 py-2 text-xs text-deepGreen shadow-sm"
    : "rounded-2xl border border-deepGreen/10 bg-offWhite/80 px-4 py-3 text-sm text-deepGreen";
  const titleTextClass = isCompact ? "text-sm font-semibold" : "font-semibold";
  const descriptionClass = isCompact ? "text-[11px] text-deepGreen/60" : "text-xs text-deepGreen/60";
  const messageClass = isCompact ? "text-[11px] text-deepGreen/55" : "text-xs text-deepGreen/60";
  const timestampClass = isCompact ? "text-[10px] text-deepGreen/50" : "text-[11px] text-deepGreen/50";

  return (
    <section className={containerClass}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Jobs em produção</p>
          <h2 className={titleClass}>Status dos agendamentos</h2>
        </div>
        {status === "error" ? (
          <span className="text-xs font-semibold text-red-600">
            {message ?? "Falha ao consultar o status dos jobs."}
          </span>
        ) : null}
      </div>

      {status === "loading" ? (
        <p className="text-sm text-deepGreen/60">Consultando execução dos jobs...</p>
      ) : null}

      {jobs.length === 0 && status !== "loading" ? (
        <p className="text-sm text-deepGreen/60">
          Nenhum job registrado agora. Garanta que directory-cache-sync, metrics-sync e GA4 estejam
          agendados no Cloud Run.
        </p>
      ) : (
        <div className={listWrapperClass}>
          {jobs.map((job) => (
            <article key={job.id} className={jobCardClass}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className={titleTextClass}>{job.label}</h3>
                  <p className={descriptionClass}>{job.description}</p>
                </div>
                <span className={`text-[11px] font-semibold ${STATUS_STYLE[job.status]}`}>
                  {friendlyStatus(job.status)}
                </span>
              </div>
              <p className={`mt-1 ${messageClass}`}>{job.message ?? "Sem observações."}</p>
              <p className={`mt-1 ${timestampClass}`}>
                Última execução:{" "}
                {job.lastRunAt
                  ? new Date(job.lastRunAt).toLocaleString("pt-BR")
                  : "Aguardando primeira execução"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function friendlyStatus(status: DashboardJob["status"]): string {
  switch (status) {
    case "success":
      return "Atualizado";
    case "warning":
      return "Verificar";
    case "error":
      return "Falhou";
    case "pending":
    default:
      return "Aguardando";
  }
}
