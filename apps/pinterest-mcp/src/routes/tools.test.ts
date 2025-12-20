import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import { env } from "../env.js";

vi.mock("../services/client-repository.js");
vi.mock("../services/pinterest-api.js");

const { findClientPinterestIntegration } = await import("../services/client-repository.js");
const { fetchPinterestAnalytics } = await import("../services/pinterest-api.js");

const mockFindClientPinterestIntegration = vi.mocked(findClientPinterestIntegration);
const mockFetchPinterestAnalytics = vi.mocked(fetchPinterestAnalytics);

describe("MCP tools routes", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
    mockFindClientPinterestIntegration.mockReset();
    mockFetchPinterestAnalytics.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it("bloqueia requisições sem token", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/tools/health/call",
      payload: {}
    });

    expect(response.statusCode).toBe(401);
  });

  it("retorna status ok no health", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/tools/health/call",
      headers: {
        "x-internal-token": env.MCP_INTERNAL_TOKEN
      },
      payload: {}
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      data: {
        service: "pinterest-mcp"
      }
    });
  });

  it("retorna 404 para ferramentas desconhecidas", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/tools/unknown_tool/call",
      headers: {
        "x-internal-token": env.MCP_INTERNAL_TOKEN
      },
      payload: {}
    });

    expect(response.statusCode).toBe(404);
  });

  it("valida argumentos obrigatórios na ferramenta pinterest_summary", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/tools/pinterest_summary/call",
      headers: {
        "x-internal-token": env.MCP_INTERNAL_TOKEN
      },
      payload: {
        args: {}
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "error",
      error: "Informe o clientId para consultar as métricas do Pinterest."
    });
  });

  it("retorna métricas agregadas quando clientId é válido", async () => {
    mockFindClientPinterestIntegration.mockResolvedValue({
      clientId: "client-123",
      orgId: "org-1",
      clientName: "Cliente Teste",
      pinterestAccountIds: ["549769130861"],
      pinterest: {
        accessToken: "pin-access",
        refreshToken: null,
        tokenType: "bearer",
        scope: "ads:read",
        expiresAt: "2025-12-01T00:00:00.000Z",
        refreshTokenExpiresAt: null,
        linkedAt: "2025-11-19T00:00:00.000Z"
      }
    });
    mockFetchPinterestAnalytics.mockResolvedValue([
      {
        DATE: "2025-11-10",
        PAID_IMPRESSION: 1000,
        TOTAL_CLICKTHROUGH: 120,
        SPEND_IN_DOLLAR: 45.5,
        TOTAL_CHECKOUT: 3
      },
      {
        DATE: "2025-11-11",
        PAID_IMPRESSION: 800,
        TOTAL_CLICKTHROUGH: 80,
        SPEND_IN_DOLLAR: 30,
        TOTAL_CHECKOUT: 2
      }
    ]);

    const response = await app.inject({
      method: "POST",
      url: "/tools/pinterest_summary/call",
      headers: {
        "x-internal-token": env.MCP_INTERNAL_TOKEN
      },
      payload: {
        args: {
          clientId: "client-123",
          range: "LAST_7_DAYS"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      status: string;
      data: {
        totals: {
          impressions: number;
          clicks: number;
          spend: { amount: number };
          conversions: number;
        };
        averages: { ctr: number; cpc: number; cpa: number };
      };
    };
    expect(body.status).toBe("ok");
    expect(body.data.totals.impressions).toBe(1800);
    expect(body.data.totals.clicks).toBe(200);
    expect(body.data.totals.spend.amount).toBeCloseTo(75.5);
    expect(body.data.totals.conversions).toBe(5);
    expect(body.data.averages.ctr).toBeCloseTo(200 / 1800);
    expect(body.data.averages.cpc).toBeCloseTo(75.5 / 200);
    expect(body.data.averages.cpa).toBeCloseTo(75.5 / 5);
  });
});
