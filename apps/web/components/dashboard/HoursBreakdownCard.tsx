"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import { formatMinutesAsClock } from "../../lib/datetime";
import type { HoursReport } from "../../types/reports";
import { useAuth } from "../auth/AuthProvider";

type PeriodOption = "today" | "last7";

type ReportState =
  | { status: "idle"; data: HoursReport | null }
  | { status: "loading"; data: HoursReport | null }
  | { status: "loaded"; data: HoursReport }
  | { status: "error"; data: HoursReport | null; message: string };

function getRange(option: PeriodOption): { startDate: string; endDate: string } {
  const end = new Date();
  if (option === "last7") {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return { startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10) };
  }
  return {
    startDate: end.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function formatHours(minutes: number): string {
  return formatMinutesAsClock(minutes);
}

export function HoursBreakdownCard(): JSX.Element {
  const { token, status: authStatus } = useAuth();
  const [period, setPeriod] = useState<PeriodOption>("today");
  const [state, setState] = useState<ReportState>({ status: "idle", data: null });

  const isAuthenticated = authStatus === "authenticated" && Boolean(token);

  useEffect(() => {
    if (!token || !isAuthenticated) {
      setState({ status: "idle", data: null });
      return;
    }

    const { startDate, endDate } = getRange(period);
    setState((prev) => ({ ...prev, status: "loading" }));

    apiFetch<HoursReport>("/reports/hours", {
      token,
      query: { startDate, endDate }
    })
      .then((data) => {
        setState({ status: "loaded", data });
      })
      .catch((error) => {
        const message =
          error instanceof ApiError ? error.message : "Nao foi possivel carregar os relatorios de horas.";
        setState({ status: "error", data: null, message });
      });
  }, [token, isAuthenticated, period]);

  const report = state.data;

  const perProject = useMemo(() => {
    if (!report) {
      return [];
    }
    return report.totals.perProject.slice(0, 5);
  }, [report]);

  const perUser = useMemo(() => {
    if (!report) {
      return [];
    }
    return report.totals.perUser.slice(0, 5);
  }, [report]);

  return (
    <section className="card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Horas registradas</p>
          <h2 className="text-xl font-semibold text-deepGreen">Resumo por projeto e usuário</h2>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(event) => setPeriod(event.target.value as PeriodOption)}
            className="rounded-full border border-deepGreen/20 bg-white px-3 py-1 text-xs font-semibold text-deepGreen shadow-sm focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
            disabled={!isAuthenticated}
          >
            <option value="today">Hoje</option>
            <option value="last7">Últimos 7 dias</option>
          </select>
          <Link
            href="/calendar"
            className="rounded-full border border-deepGreen/20 px-3 py-1 text-xs font-semibold text-deepGreen transition hover:border-deepGreen/60"
          >
            Registrar horas
          </Link>
        </div>
      </div>

      {!isAuthenticated ? (
        <p className="text-sm text-deepGreen/70">Faça login para ver o detalhamento das horas.</p>
      ) : (
        <>
          {state.status === "loading" ? (
            <p className="text-sm text-deepGreen/70">Carregando lançamentos...</p>
          ) : null}
          {state.status === "error" ? (
            <p className="text-sm text-red-600">{state.message}</p>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-deepGreen/50">Por projeto</p>
              {perProject.length === 0 && state.status === "loaded" ? (
                <p className="text-sm text-deepGreen/70">Nenhum lançamento no período.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {perProject.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded border border-deepGreen/15 bg-white/80 px-3 py-2 text-sm text-deepGreen/80"
                    >
                      <span className="font-medium text-deepGreen">{item.id}</span>
                      <span className="text-xs font-semibold text-deepGreen/80">{formatHours(item.minutes)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-deepGreen/50">Por usuário</p>
              {perUser.length === 0 && state.status === "loaded" ? (
                <p className="text-sm text-deepGreen/70">Nenhum lançamento no período.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {perUser.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center justify-between rounded border border-deepGreen/15 bg-white/80 px-3 py-2 text-sm text-deepGreen/80"
                    >
                      <span className="font-medium text-deepGreen">{item.id}</span>
                      <span className="text-xs font-semibold text-deepGreen/80">{formatHours(item.minutes)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
