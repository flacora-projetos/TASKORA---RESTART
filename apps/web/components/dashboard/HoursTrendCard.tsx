'use client';

import Link from "next/link";
import { useMemo } from "react";

import { useHoursTrend } from "../../hooks/useHoursTrend";
import { useAuth } from "../auth/AuthProvider";

const formatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

const formatMinutesLabel = (minutes: number): string => {
  if (!minutes || minutes <= 0) {
    return "0min";
  }
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (rest > 0) {
    parts.push(`${rest}min`);
  }
  return parts.join(" ");
};

function buildChart(points: Array<{ date: string; minutes: number }>): {
  line: string;
  area: string;
} {
  if (!points.length) {
    return { line: "", area: "" };
  }
  const maxValue = Math.max(...points.map((point) => point.minutes), 1);
  const chartWidth = 100;
  const chartHeight = 40;
  const padding = 4;
  const divisor = points.length > 1 ? points.length - 1 : 1;
  const coords = points.map((point, index) => {
    const x = (index / divisor) * chartWidth;
    const valueRatio = point.minutes / maxValue;
    const y = chartHeight - padding - valueRatio * (chartHeight - padding * 2);
    return { x, y };
  });

  const line = coords.map((coord) => `${coord.x},${coord.y}`).join(" ");
  const area = `0,${chartHeight} ${coords.map((coord) => `${coord.x},${coord.y}`).join(" ")} ${chartWidth},${chartHeight}`;
  return { line, area };
}

export function HoursTrendCard(): JSX.Element {
  const { token, status } = useAuth();
  const isAuthenticated = status === "authenticated" && Boolean(token);
  const trend = useHoursTrend({ token, enabled: isAuthenticated, days: 14 });

  const chartPoints = useMemo(() => buildChart(trend.points), [trend.points]);
  const latestPoints = useMemo(() => trend.points.slice(-5).reverse(), [trend.points]);

  return (
    <section className="card space-y-4 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Horas trabalhadas</p>
          <h2 className="text-xl font-semibold text-deepGreen">Horas registradas (14 dias)</h2>
          <p className="text-sm text-deepGreen/60">
            Acompanhe a produtividade recente e incentive o time a registrar o tempo logo apos concluir cada tarefa.
          </p>
        </div>
        {isAuthenticated ? (
          <div className="text-right">
            <p className="text-xs text-deepGreen/60">Total do periodo</p>
            <p className="text-xl font-semibold text-deepGreen">{formatMinutesLabel(trend.totalMinutes)}</p>
          </div>
        ) : null}
      </header>

      {!isAuthenticated ? (
        <p className="text-sm text-deepGreen/70">
          Entre no Taskora para visualizar a tendencia de horas registrada pelo time.
        </p>
      ) : (
        <>
          {trend.status === "loading" ? (
            <p className="text-sm text-deepGreen/70">Carregando tendencia...</p>
          ) : null}
          {trend.status === "error" ? (
            <p className="text-sm text-red-600">{trend.message}</p>
          ) : null}

          {trend.status === "loaded" && trend.points.length > 0 ? (
            <div className="space-y-4">
              <div className="h-32 w-full overflow-hidden rounded-2xl bg-gradient-to-b from-emerald-50 to-white p-3">
                <svg
                  viewBox="0 0 100 40"
                  preserveAspectRatio="none"
                  className="h-full w-full text-emerald-600"
                  aria-label="Grafico de tendencia de horas"
                >
                  <polygon points={chartPoints.area} fill="currentColor" fillOpacity={0.1} />
                  <polyline
                    points={chartPoints.line}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {latestPoints.map((point) => (
                  <li
                    key={point.date}
                    className="flex items-center justify-between rounded-xl border border-deepGreen/10 bg-offWhite/80 px-3 py-2 text-xs text-deepGreen/70"
                  >
                    <span className="font-medium text-deepGreen">{formatter.format(new Date(point.date))}</span>
                    <span className="text-sm font-semibold text-deepGreen">{formatMinutesLabel(point.minutes)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {trend.status === "loaded" && trend.points.length === 0 ? (
            <p className="text-sm text-deepGreen/70">
              Ainda nao ha registros neste periodo. Incentive o time a usar o botao &quot;Registrar horas&quot;
              no modulo Projetos.
            </p>
          ) : null}

          <Link
            href="/projects"
            className="inline-flex w-full items-center justify-center rounded-full border border-deepGreen/20 px-4 py-2 text-sm font-semibold text-deepGreen transition hover:border-deepGreen/50"
          >
            Abrir modulo Projetos
          </Link>
        </>
      )}
    </section>
  );
}
