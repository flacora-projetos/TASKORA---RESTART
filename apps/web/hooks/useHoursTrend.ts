import { useEffect, useState } from "react";

import { apiFetch, ApiError } from "../lib/api";
import type { HoursReport } from "../types/reports";

export type HoursTrendPoint = {
  date: string;
  minutes: number;
};

export type HoursTrendState = {
  status: "idle" | "loading" | "loaded" | "error";
  message: string | null;
  points: HoursTrendPoint[];
  totalMinutes: number;
  period: {
    startDate: string | null;
    endDate: string | null;
  };
};

type Options = {
  token?: string | null;
  enabled?: boolean;
  days?: number;
};

const INITIAL_STATE: HoursTrendState = {
  status: "idle",
  message: null,
  points: [],
  totalMinutes: 0,
  period: {
    startDate: null,
    endDate: null
  }
};

export function useHoursTrend({ token, enabled = true, days = 14 }: Options): HoursTrendState {
  const [state, setState] = useState<HoursTrendState>(INITIAL_STATE);

  useEffect(() => {
    if (!token || !enabled) {
      setState(INITIAL_STATE);
      return;
    }

    let isMounted = true;
    const end = new Date();
    const start = new Date();
    const safeDays = Math.max(days ?? 14, 1);
    start.setDate(end.getDate() - (safeDays - 1));

    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);

    setState((prev) => ({
      ...prev,
      status: "loading",
      message: null
    }));

    apiFetch<HoursReport>("/reports/hours", {
      token,
      query: {
        startDate,
        endDate,
        groupBy: "day"
      }
    })
      .then((report) => {
        if (!isMounted) {
          return;
        }
        setState({
          status: "loaded",
          message: null,
          points: report.totals.perDay ?? [],
          totalMinutes: report.totals.minutes ?? 0,
          period: report.period
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        const message =
          error instanceof ApiError
            ? error.message
            : "Nao foi possivel carregar a tendencia de horas.";
        setState({
          status: "error",
          message,
          points: [],
          totalMinutes: 0,
          period: {
            startDate,
            endDate
          }
        });
      });

    return () => {
      isMounted = false;
    };
  }, [token, enabled, days]);

  return state;
}
