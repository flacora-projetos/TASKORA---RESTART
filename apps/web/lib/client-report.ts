import type { ClientMetricsRange, ClientMetricsSummary } from "../types/client-metrics";
import type { Client } from "../types/clients";
import type { ProjectSummary } from "../types/projects";
import type { HoursReport } from "../types/reports";

export type ClientReportRangeOption = {
  label: string;
  value: ClientMetricsRange;
};

export const CLIENT_METRICS_RANGE_OPTIONS: ClientReportRangeOption[] = [
  { label: "Últimos 7 dias", value: "LAST_7_DAYS" },
  { label: "Últimos 30 dias", value: "LAST_30_DAYS" },
  { label: "Este mês", value: "THIS_MONTH" },
  { label: "Mês anterior", value: "LAST_MONTH" }
];

export type AggregatedHoursTotals = {
  totalMinutes: number;
  perProject: Array<{ id: string; name: string; minutes: number }>;
  perUser: Array<{ id: string; minutes: number }>;
};

function startOfUTCMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function formatUTCDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const clone = new Date(date);
  clone.setUTCDate(clone.getUTCDate() + days);
  return clone;
}

export function resolveMetricsRangeDates(range: ClientMetricsRange): { startDate: string; endDate: string } {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  switch (range) {
    case "LAST_7_DAYS": {
      const end = addUtcDays(todayUtc, -1);
      const start = addUtcDays(todayUtc, -7);
      return { startDate: formatUTCDate(start), endDate: formatUTCDate(end) };
    }
    case "LAST_30_DAYS": {
      const end = addUtcDays(todayUtc, -1);
      const start = addUtcDays(todayUtc, -30);
      return { startDate: formatUTCDate(start), endDate: formatUTCDate(end) };
    }
    case "THIS_MONTH": {
      const start = startOfUTCMonth(todayUtc);
      return { startDate: formatUTCDate(start), endDate: formatUTCDate(todayUtc) };
    }
    case "LAST_MONTH": {
      const currentMonthStart = startOfUTCMonth(todayUtc);
      const lastMonthEnd = addUtcDays(currentMonthStart, -1);
      const lastMonthStart = startOfUTCMonth(lastMonthEnd);
      return { startDate: formatUTCDate(lastMonthStart), endDate: formatUTCDate(lastMonthEnd) };
    }
    default:
      return { startDate: formatUTCDate(todayUtc), endDate: formatUTCDate(todayUtc) };
  }
}

export function summarizeHoursReports(
  entries: Array<{ project: ProjectSummary; report: HoursReport }>
): AggregatedHoursTotals {
  if (entries.length === 0) {
    return {
      totalMinutes: 0,
      perProject: [],
      perUser: []
    };
  }

  const perProject = new Map<string, { id: string; name: string; minutes: number }>();
  const perUser = new Map<string, number>();
  let totalMinutes = 0;

  for (const { project, report } of entries) {
    totalMinutes += report.totals.minutes;
    const currentProject = perProject.get(project.id) ?? { id: project.id, name: project.name, minutes: 0 };
    currentProject.minutes += report.totals.minutes;
    perProject.set(project.id, currentProject);

    for (const item of report.totals.perUser) {
      perUser.set(item.id, (perUser.get(item.id) ?? 0) + item.minutes);
    }
  }

  return {
    totalMinutes,
    perProject: Array.from(perProject.values()).sort((a, b) => {
      if (b.minutes !== a.minutes) {
        return b.minutes - a.minutes;
      }
      return a.name.localeCompare(b.name);
    }),
    perUser: Array.from(perUser.entries())
      .map(([id, minutes]) => ({ id, minutes }))
      .sort((a, b) => {
        if (b.minutes !== a.minutes) {
          return b.minutes - a.minutes;
        }
        return a.id.localeCompare(b.id);
      })
  };
}

export function minutesToHoursString(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0";
  }
  const hours = minutes / 60;
  return hours.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatCurrency(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatNumber(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  return value.toLocaleString("pt-BR");
}

function formatPercentage(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }
  const normalized = value > 1 ? value : value * 100;
  return `${normalized.toFixed(2).replace(".", ",")}%`;
}

function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(";") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildClientReportCsv(params: {
  client: Client;
  rangeLabel: string;
  period: { startDate: string; endDate: string };
  metrics: ClientMetricsSummary;
  hours: AggregatedHoursTotals;
}): string {
  const { client, rangeLabel, period, metrics, hours } = params;
  const rows: string[][] = [];

  rows.push(["Relatório Taskora - Cliente"]);
  rows.push(["Cliente", client.name]);
  rows.push(["ID do cliente", client.id]);
  rows.push(["Período", `${period.startDate} a ${period.endDate}`]);
  rows.push(["Intervalo selecionado", rangeLabel]);
  rows.push(["Gerado em", metrics.generatedAt]);
  rows.push([]);

  rows.push([
    "Plataforma",
    "Status",
    "Investimento (BRL)",
    "Impressões",
    "Cliques",
    "Conversões",
    "Receita",
    "CPC (BRL)",
    "CTR",
    "Última sincronização"
  ]);

  metrics.platforms.forEach((platform) => {
    rows.push([
      platform.platform,
      platform.status,
      formatCurrency(platform.totals.spend),
      formatNumber(platform.totals.impressions),
      formatNumber(platform.totals.clicks),
      formatNumber(platform.totals.conversions),
      formatCurrency(platform.totals.revenue),
      formatCurrency(platform.totals.cpc),
      formatPercentage(platform.totals.ctr),
      platform.lastSynced ?? "-"
    ]);
  });

  rows.push([]);
  rows.push(["Horas totais (minutos)", String(hours.totalMinutes)]);
  rows.push(["Horas totais (horas)", minutesToHoursString(hours.totalMinutes)]);
  rows.push([]);

  rows.push(["Horas por projeto"]);
  rows.push(["Projeto", "Minutos", "Horas"]);
  if (hours.perProject.length === 0) {
    rows.push(["Sem lançamentos no período", "0", "0"]);
  } else {
    hours.perProject.forEach((entry) => {
      rows.push([entry.name, String(entry.minutes), minutesToHoursString(entry.minutes)]);
    });
  }

  rows.push([]);
  rows.push(["Horas por colaborador (userId)"]);
  rows.push(["Colaborador", "Minutos", "Horas"]);
  if (hours.perUser.length === 0) {
    rows.push(["Sem lançamentos no período", "0", "0"]);
  } else {
    hours.perUser.forEach((entry) => {
      rows.push([entry.id, String(entry.minutes), minutesToHoursString(entry.minutes)]);
    });
  }

  return rows.map((row) => row.map(escapeCsvValue).join(";")).join("\n");
}

export function getRangeLabel(range: ClientMetricsRange): string {
  const option = CLIENT_METRICS_RANGE_OPTIONS.find((item) => item.value === range);
  return option?.label ?? range;
}
