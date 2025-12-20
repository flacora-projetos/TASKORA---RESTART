import { afterEach, describe, expect, it, vi } from "vitest";

import type { ClientIntegrationInfo } from "../types/clients.js";

const originalGa4Token = process.env.EXTERNAL_GA4_TOKEN;

describe("client-metrics service", () => {
  afterEach(() => {
    process.env.EXTERNAL_GA4_TOKEN = originalGa4Token;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("usa o serviço dedicado de GA4 quando o token está configurado", async () => {
    process.env.EXTERNAL_GA4_TOKEN = "test-ga4-token";

    const callExternalGa4 = vi.fn(async () => ({
      ok: true,
      data: {
        rows: [
          {
            metricValues: [{ value: "12" }, { value: "3" }, { value: "250" }]
          }
        ],
        metricHeaders: [{ name: "sessions" }, { name: "conversions" }, { name: "purchaseRevenue" }],
        updatedAt: "2025-11-08T12:00:00.000Z"
      }
    }));

    const callExternalApi = vi.fn(async () => ({
      metrics: { spend: 100, impressions: 4000, clicks: 300, conversionValue: 64000 }
    }));

    const callExternalMcp = vi.fn(async () => ({
      metrics: { spend: 50 }
    }));

    vi.doMock("./external-clients.js", () => ({
      callExternalApi,
      callExternalGa4,
      callExternalMcp
    }));

    const { fetchClientMetricsSummary } = await import("./client-metrics.js");

    const summary = await fetchClientMetricsSummary(
      {
        orgId: "org-1",
        clientId: "client-1",
        clientName: "Cliente Metrics"
      },
      {
        integrations: {
          googleCustomerIds: ["123"],
          metaAccountIds: ["456"],
          ga4PropertyIds: ["properties/789"],
          syncedAt: new Date().toISOString()
        } as ClientIntegrationInfo,
        googleCustomerIds: ["123"],
        metaAccountIds: ["456"],
        ga4PropertyIds: ["properties/789"]
      },
      "LAST_7_DAYS"
    );

    expect(callExternalGa4).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/ga4/properties/789/runReport",
        method: "POST"
      })
    );
    const ga4Call = callExternalGa4.mock.calls[0]?.[0] as { body?: { metrics?: Array<{ name?: string }> } } | undefined;
    expect(ga4Call?.body?.metrics?.map((metric) => metric?.name)).toEqual([
      "sessions",
      "newUsers",
      "screenPageViews",
      "eventCount",
      "conversions",
      "purchaseRevenue"
    ]);

    const ga4Summary = summary.platforms.find((platform) => platform.platform === "ga4");
    expect(ga4Summary?.totals.clicks).toBe(12);
    expect(ga4Summary?.totals.conversions).toBe(3);
    expect(ga4Summary?.totals.revenue).toBe(250);
    expect(ga4Summary?.status).toBe("connected");
    expect(ga4Summary?.kpis?.some((kpi) => kpi.key === "sessions")).toBe(true);

    expect(callExternalMcp).not.toHaveBeenCalled();
    const google = summary.platforms.find((platform) => platform.platform === "google");
    expect(google?.totals.revenue).toBe(64000);
    expect(google?.kpis?.some((kpi) => kpi.label === "Receita" && kpi.value === 64000)).toBe(true);
  });

  it("cai para o MCP quando o GA4 direto falha", async () => {
    process.env.EXTERNAL_GA4_TOKEN = "test-ga4-token";

    const callExternalApi = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          metrics: {
            totals: {
              costMicros: 2_500_000,
              impressions: 1000,
              clicks: 80,
              conversionValue: 64000
            }
          }
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          metrics: {
            impressions: 500,
            clicks: 45,
            total_revenue: 1800,
            actions: [
              { action_type: "onsite_conversion.messaging_first_reply", value: "12" },
              { action_type: "link_click", value: "30" },
              { action_type: "purchase", value: "3" }
            ]
          }
        }
      });

    const callExternalGa4 = vi.fn(() => {
      throw new Error("ga4 indisponivel");
    });

    const callExternalMcp = vi.fn(async () => ({
      metrics: {
        totals: {
          spend: 40,
          conversions: 8,
          revenue: 320,
          sessions: 90
        }
      },
      metricHeaders: [
        { name: "sessions" },
        { name: "conversions" },
        { name: "purchaseRevenue" }
      ],
      updatedAt: "2025-11-10T08:00:00.000Z"
    }));

    vi.doMock("./external-clients.js", () => ({
      callExternalApi,
      callExternalGa4,
      callExternalMcp
    }));

    const { fetchClientMetricsSummary } = await import("./client-metrics.js");

    const summary = await fetchClientMetricsSummary(
      {
        orgId: "org-1",
        clientId: "client-1",
        clientName: "Cliente Metrics"
      },
      {
        integrations: {
          directorySnapshot: { googleLoginCustomerId: "999" },
          googleCustomerIds: ["321"],
          metaAccountIds: ["act_12345"],
          ga4PropertyIds: ["properties/555"]
        } as ClientIntegrationInfo,
        googleCustomerIds: ["321"],
        metaAccountIds: ["act_12345"],
        ga4PropertyIds: ["properties/555"]
      },
      "LAST_7_DAYS"
    );

    expect(callExternalApi).toHaveBeenCalledTimes(2);
    const google = summary.platforms.find((platform) => platform.platform === "google");
    expect(google?.totals.spend).toBe(2.5);
    expect(google?.totals.revenue).toBe(64000);
    expect(google?.kpis?.some((kpi) => kpi.label === "Receita" && kpi.value === 64000)).toBe(true);
    expect(google?.kpis?.some((kpi) => kpi?.label === "Receita")).toBe(true);

    const meta = summary.platforms.find((platform) => platform.platform === "meta");
    expect(meta?.totals.conversions).toBe(45);
    expect(meta?.totals.revenue).toBe(1800);
    const metaKpis = meta?.kpis ?? [];
    expect(metaKpis.some((kpi) => kpi.label === "Receita")).toBe(true);
    expect(metaKpis.find((kpi) => kpi.label === "Mensagens")?.value).toBe(12);
    expect(metaKpis.find((kpi) => kpi.label === "Cliques qualificados")?.value).toBe(30);
    expect(metaKpis.find((kpi) => kpi.label === "Vendas")?.value).toBe(3);

    expect(callExternalGa4).toHaveBeenCalled();
    expect(callExternalMcp).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/tools/ga4_summary/call",
        method: "POST"
      })
    );

    const ga4 = summary.platforms.find((platform) => platform.platform === "ga4");
    expect(ga4?.status).toBe("connected");
    expect(ga4?.totals.revenue).toBe(320);
    expect(ga4?.kpis?.some((kpi) => kpi.key === "sessions")).toBe(true);
  });

  it("considera arrays de actions aninhadas nas respostas da Meta Ads", async () => {
    process.env.EXTERNAL_GA4_TOKEN = "test-ga4-token";

    const callExternalApi = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          metrics: {
            totals: {
              costMicros: 1_000_000,
              impressions: 500,
              clicks: 50
            }
          }
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          totals: {
            impressions: 300,
            clicks: 30,
            actions: [
              { action_type: "lead", value: "6" },
              { action_type: "purchase", value: "2" }
            ]
          },
          data: [
            {
              actions: [
                { action_type: "messaging_conversation_started_7d", value: "4" },
                { action_type: "link_click", value: "20" }
              ]
            }
          ]
        }
      });

    const callExternalGa4 = vi.fn(async () => ({
      ok: true,
      data: {
        rows: [],
        metricHeaders: []
      }
    }));

    const callExternalMcp = vi.fn();

    vi.doMock("./external-clients.js", () => ({
      callExternalApi,
      callExternalGa4,
      callExternalMcp
    }));

    const { fetchClientMetricsSummary } = await import("./client-metrics.js");

    const summary = await fetchClientMetricsSummary(
      {
        orgId: "org-1",
        clientId: "client-2",
        clientName: "Cliente Nested"
      },
      {
        integrations: {
          googleCustomerIds: ["999"],
          metaAccountIds: ["act_987"]
        } as ClientIntegrationInfo,
        googleCustomerIds: ["999"],
        metaAccountIds: ["act_987"],
        ga4PropertyIds: []
      },
      "LAST_7_DAYS"
    );

    const meta = summary.platforms.find((platform) => platform.platform === "meta");
    expect(meta?.totals.conversions).toBe(32);
    const metaKpis = meta?.kpis ?? [];
    expect(metaKpis.find((kpi) => kpi.label === "Leads")?.value).toBe(6);
    expect(metaKpis.find((kpi) => kpi.label === "Mensagens")?.value).toBe(4);
    expect(metaKpis.find((kpi) => kpi.label === "Vendas")?.value).toBe(2);
    expect(metaKpis.find((kpi) => kpi.label === "Cliques qualificados")?.value).toBe(20);
  });

  it("interpreta actions no formato objeto e calcula CPC medio a partir de micros", async () => {
    process.env.EXTERNAL_GA4_TOKEN = "test-ga4-token";

    const callExternalApi = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        data: {
          metrics: {
            totals: {
              impressions: 1500,
              clicks: 120,
              costMicros: 3_750_000,
              averageCpcMicros: 31_250
            }
          }
        }
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          metrics: {
            impressions: 800,
            clicks: 90,
            actions: {
              purchase: 4,
              lead: 12,
              messaging_conversation_started_7d: 5,
              landing_page_view: 120
            }
          }
        }
      });

    const callExternalGa4 = vi.fn(async () => ({
      ok: true,
      data: {
        rows: [],
        metricHeaders: []
      }
    }));

    const callExternalMcp = vi.fn();

    vi.doMock("./external-clients.js", () => ({
      callExternalApi,
      callExternalGa4,
      callExternalMcp
    }));

    const { fetchClientMetricsSummary } = await import("./client-metrics.js");

    const summary = await fetchClientMetricsSummary(
      {
        orgId: "org-1",
        clientId: "client-3",
        clientName: "Cliente Objetivos"
      },
      {
        integrations: {
          googleCustomerIds: ["111"],
          metaAccountIds: ["act_222"]
        } as ClientIntegrationInfo,
        googleCustomerIds: ["111"],
        metaAccountIds: ["act_222"],
        ga4PropertyIds: []
      },
      "LAST_7_DAYS"
    );

    const google = summary.platforms.find((platform) => platform.platform === "google");
    expect(google?.totals.spend).toBe(3.75);
    expect(google?.totals.cpc).toBeCloseTo(0.03125);

    const meta = summary.platforms.find((platform) => platform.platform === "meta");
    expect(meta?.totals.conversions).toBe(141);
    const metaKpis = meta?.kpis ?? [];
    expect(metaKpis.find((kpi) => kpi.label === "Vendas")?.value).toBe(4);
    expect(metaKpis.find((kpi) => kpi.label === "Leads")?.value).toBe(12);
    expect(metaKpis.find((kpi) => kpi.label === "Mensagens")?.value).toBe(5);
    expect(metaKpis.find((kpi) => kpi.label === "Cliques qualificados")?.value).toBe(120);
  });
});
