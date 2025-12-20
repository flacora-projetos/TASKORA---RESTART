'use client';

import Link from "next/link";

import type { DashboardAlert } from "../../types/dashboard";

type Props = {
  alert: DashboardAlert;
};

const TONE_STYLE: Record<DashboardAlert["tone"], string> = {
  info: "border-deepGreen/15 bg-white/90 text-deepGreen",
  warning: "border-amber-200 bg-amber-50 text-amber-900"
};

export function DashboardAlertCard({ alert }: Props): JSX.Element {
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${TONE_STYLE[alert.tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-current/70">Precisa de atenção</p>
          <h3 className="text-base font-semibold">{alert.title}</h3>
        </div>
        {alert.actionLabel ? (
          <Link
            href={alert.href}
            className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold text-current hover:bg-current/10"
          >
            {alert.actionLabel}
          </Link>
        ) : null}
      </div>
      <p className="mt-1 text-sm">{alert.description}</p>
      {alert.timestamp ? (
        <p className="mt-2 text-[11px] text-current/70">
          Atualizado em {new Date(alert.timestamp).toLocaleString("pt-BR")}
        </p>
      ) : null}
    </article>
  );
}
