import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import {
  __resetClientMetricsStatusRepository,
  getClientMetricsStatusRepository
} from "../repositories/client-metrics-status-repository.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

const suporteToken = Buffer.from(
  JSON.stringify({ uid: "suporte", roles: ["suporte"], orgId: "org-1" })
).toString("base64");

const outsiderToken = Buffer.from(
  JSON.stringify({ uid: "externo", roles: ["viewer"], orgId: "org-1" })
).toString("base64");

describe("integration status routes", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    __resetClientMetricsStatusRepository();
    const repo = getClientMetricsStatusRepository();
    await repo.upsert("org-1", "client-1", "Cliente 1", "google", "connected");
    await repo.upsert("org-1", "client-2", "Cliente 2", "google", "pending");
    await repo.upsert("org-1", "client-3", "Cliente 3", "meta", "error");
    await repo.upsert("org-2", "client-9", "Outro", "google", "error"); // outra org nao deve aparecer
  });

  it("retorna agregados por plataforma e lista alertas", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/metrics/integrations/status",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      platforms: Array<{ platform: string; statusCounts: Record<string, number> }>;
      alerts: Array<{ clientId: string; status: string }>;
    };

    const googleSummary = body.platforms.find((platform) => platform.platform === "google");
    expect(googleSummary?.statusCounts.connected).toBe(1);
    expect(googleSummary?.statusCounts.pending).toBe(1);

    expect(body.alerts.length).toBe(2);
    const alertIds = body.alerts.map((alert) => alert.clientId);
    expect(alertIds).toEqual(expect.arrayContaining(["client-2", "client-3"]));
  });

  it("permite suporte consultar", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/metrics/integrations/status",
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });

    expect(response.statusCode).toBe(200);
  });

  it("bloqueia roles sem permissão", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/metrics/integrations/status",
      headers: {
        authorization: `Bearer ${outsiderToken}`
      }
    });

    expect(response.statusCode).toBe(403);
  });
});
