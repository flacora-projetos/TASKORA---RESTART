import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import {
  __resetClientMetricsStatusRepository,
  getClientMetricsStatusRepository
} from "../repositories/client-metrics-status-repository.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import * as clientMetricsService from "../services/client-metrics.js";
import type { ClientMetricsSummary } from "../services/client-metrics.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

const suporteToken = Buffer.from(
  JSON.stringify({ uid: "suporte", roles: ["suporte"], orgId: "org-1" })
).toString("base64");

const outsiderToken = Buffer.from(
  JSON.stringify({ uid: "externo", roles: ["viewer"], orgId: "org-1" })
).toString("base64");

describe("client metrics routes", () => {
  const app = buildApp();
  let clientId: string;

  beforeAll(async () => {
    await app.ready();
    const repo = getClientsRepository();
    const client = await repo.create("org-1", { name: "Cliente Metrics" }, "gestor");
    clientId = client.id;
    vi.spyOn(clientMetricsService, "getCachedClientMetricsSummary").mockResolvedValue({
      range: "LAST_30_DAYS",
      generatedAt: "2025-11-07T00:00:00.000Z",
      platforms: []
    } satisfies ClientMetricsSummary);
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    __resetClientMetricsStatusRepository();
    getClientMetricsStatusRepository();
  });

  it("returns metrics summary for allowed roles", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/metrics/summary?range=LAST_30_DAYS`,
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as ClientMetricsSummary;
    expect(body.range).toBe("LAST_30_DAYS");
    expect(clientMetricsService.getCachedClientMetricsSummary).toHaveBeenCalledWith(
      {
        orgId: "org-1",
        clientId,
        clientName: "Cliente Metrics"
      },
      {
        integrations: null,
        googleCustomerIds: [],
        metaAccountIds: [],
        ga4PropertyIds: []
      },
      "LAST_30_DAYS"
    );
  });

  it("allows suporte to read metrics", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/metrics/summary`,
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it("prevents roles without permission", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/metrics/summary`,
      headers: {
        authorization: `Bearer ${outsiderToken}`
      }
    });

    expect(response.statusCode).toBe(403);
  });
});
