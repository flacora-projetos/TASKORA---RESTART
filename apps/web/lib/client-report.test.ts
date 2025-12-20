import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  buildClientReportCsv,
  minutesToHoursString,
  resolveMetricsRangeDates,
  summarizeHoursReports
} from "./client-report";
import type { ClientMetricsSummary } from "../types/client-metrics";
import type { Client } from "../types/clients";
import type { ProjectSummary } from "../types/projects";
import type { HoursReport } from "../types/reports";

describe("resolveMetricsRangeDates", () => {
  beforeAll(() => {
    vi.setSystemTime(new Date("2025-11-10T12:00:00.000Z"));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("returns the last 7 days range in UTC", () => {
    const dates = resolveMetricsRangeDates("LAST_7_DAYS");
    expect(dates).toEqual({ startDate: "2025-11-03", endDate: "2025-11-09" });
  });

  it("returns the current month when THIS_MONTH is selected", () => {
    const dates = resolveMetricsRangeDates("THIS_MONTH");
    expect(dates).toEqual({ startDate: "2025-11-01", endDate: "2025-11-10" });
  });
});

describe("summarizeHoursReports", () => {
  const sampleProjects: ProjectSummary[] = [
    { id: "proj-1", name: "Projeto Alfa", clientId: "client-1", status: "active", updatedAt: "2025-11-01T00:00:00.000Z" },
    { id: "proj-2", name: "Projeto Beta", clientId: "client-1", status: "active", updatedAt: "2025-11-02T00:00:00.000Z" }
  ];

  const sampleReports: HoursReport[] = [
    {
      period: { startDate: null, endDate: null },
      filters: { projectId: "proj-1", userId: null },
      totals: {
        minutes: 120,
        perProject: [{ id: "proj-1", minutes: 120 }],
        perUser: [
          { id: "user-a", minutes: 60 },
          { id: "user-b", minutes: 60 }
        ]
      }
    },
    {
      period: { startDate: null, endDate: null },
      filters: { projectId: "proj-2", userId: null },
      totals: {
        minutes: 90,
        perProject: [{ id: "proj-2", minutes: 90 }],
        perUser: [
          { id: "user-a", minutes: 30 },
          { id: "user-c", minutes: 60 }
        ]
      }
    }
  ];

  it("aggregates minutes by project and user", () => {
    const totals = summarizeHoursReports([
      { project: sampleProjects[0], report: sampleReports[0] },
      { project: sampleProjects[1], report: sampleReports[1] }
    ]);

    expect(totals.totalMinutes).toBe(210);
    expect(totals.perProject).toEqual([
      { id: "proj-1", name: "Projeto Alfa", minutes: 120 },
      { id: "proj-2", name: "Projeto Beta", minutes: 90 }
    ]);
    expect(totals.perUser).toEqual([
      { id: "user-a", minutes: 90 },
      { id: "user-b", minutes: 60 },
      { id: "user-c", minutes: 60 }
    ]);
  });

  it("returns zeroed aggregates when there are no entries", () => {
    const totals = summarizeHoursReports([]);
    expect(totals).toEqual({ totalMinutes: 0, perProject: [], perUser: [] });
  });
});

describe("buildClientReportCsv", () => {
  const client: Client = {
    id: "client-1",
    name: "Cliente Exemplo",
    segment: "E-commerce",
    monthlyBudget: 50000,
    platforms: ["google", "meta"],
    driveLink: null,
    whatsappGroup: null,
    status: "active",
    createdAt: "2025-10-01T00:00:00.000Z",
    updatedAt: "2025-11-01T00:00:00.000Z",
    integrations: null
  };

  const metrics: ClientMetricsSummary = {
    range: "LAST_7_DAYS",
    generatedAt: "2025-11-10T12:00:00.000Z",
    platforms: [
      {
        platform: "google",
        status: "connected",
        totals: {
          spend: 1000,
          impressions: 5000,
          clicks: 200,
          conversions: 15,
          cpc: 5,
          ctr: 0.04,
          revenue: 2500
        },
        lastSynced: "2025-11-10T11:30:00.000Z"
      },
      {
        platform: "meta",
        status: "missing",
        message: "Nenhuma conta",
        totals: {
          spend: null,
          impressions: null,
          clicks: null,
          conversions: null,
          cpc: null,
          ctr: null,
          revenue: null
        },
        lastSynced: null
      }
    ]
  };

  const hours = summarizeHoursReports([
    {
      project: { id: "proj-1", name: "Projeto Alfa", clientId: "client-1", status: "active", updatedAt: "2025-11-01T00:00:00.000Z" },
      report: {
        period: { startDate: null, endDate: null },
        filters: { projectId: "proj-1", userId: null },
        totals: {
          minutes: 180,
          perProject: [{ id: "proj-1", minutes: 180 }],
          perUser: [{ id: "user-a", minutes: 120 }]
        }
      }
    }
  ]);

  it("includes client, metrics and hours data in the CSV", () => {
    const csv = buildClientReportCsv({
      client,
      rangeLabel: "Últimos 7 dias",
      period: { startDate: "2025-11-03", endDate: "2025-11-09" },
      metrics,
      hours
    });

    expect(csv).toContain("Cliente;Cliente Exemplo");
    expect(csv).toContain("Plataforma;Status;Investimento (BRL);Impressões;Cliques;Conversões;Receita;CPC (BRL);CTR;Última sincronização");
    expect(csv).toContain("google;connected;R$ 1.000,00;5.000;200;15;R$ 2.500,00;R$ 5,00;4,00%;2025-11-10T11:30:00.000Z");
    expect(csv).toContain("Horas totais (minutos);180");
    expect(csv).toContain(`Horas totais (horas);${minutesToHoursString(180)}`);
  });
});
