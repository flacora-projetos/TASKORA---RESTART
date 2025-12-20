import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { callExternalApi } from "../services/external-clients.js";

vi.mock("../services/external-clients.js", () => ({
  callExternalApi: vi.fn()
}));

const callExternalApiMock = callExternalApi as unknown as vi.Mock;

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

const externoToken = Buffer.from(
  JSON.stringify({ uid: "externo", roles: ["externo"], orgId: "org-1" })
).toString("base64");

describe("metrics routes", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
    const clientsRepo = getClientsRepository();
    const projectsRepo = getProjectsRepository();

    const activeClient = await clientsRepo.create(
      "org-1",
      { name: "Ativo", status: "active", metaAccountIds: ["act_123456"] },
      "gestor"
    );
    await clientsRepo.create(
      "org-1",
      { name: "Arquivado", status: "archived", googleCustomerIds: ["1234567890"] },
      "gestor"
    );
    await clientsRepo.updateIntegrations(
      "org-1",
      activeClient.id,
      { directoryId: "dir-abc", syncedAt: new Date().toISOString() },
      "gestor"
    );

    await projectsRepo.create(
      "org-1",
      { clientId: "c1", name: "Projeto ativo", status: "active" },
      "gestor"
    );
    await projectsRepo.create(
      "org-1",
      { clientId: "c1", name: "Projeto pausado", status: "paused" },
      "gestor"
    );
  });

  beforeEach(() => {
    callExternalApiMock.mockReset();
  });

  afterAll(async () => {
    await app.close();
  });

  it("retorna agregados de clientes e projetos", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/metrics/summary",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      clients: { total: 2, active: 1, archived: 1 },
      projects: { total: 2, active: 1, paused: 1 },
      onboarding: { pendingDirectory: 0, pendingIds: 0, ready: 1 }
    });
  });

  it("bloqueia roles nao autorizadas", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/metrics/summary",
      headers: {
        authorization: `Bearer ${externoToken}`
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("retorna saldos das plataformas", async () => {
    callExternalApiMock.mockImplementation(async ({ path }: { path: string }) => {
      if (path === "/meta/accounts") {
        return {
          accounts: [
            {
              id: "act_123456",
              name: "Meta Pre",
              isPrepaid: true,
              balanceMinor: 12345,
              currentMonthCostMinor: 9876,
              averageDailySpendMinor: 3500,
              spendCapMinor: 250000
            }
          ]
        };
      }
      if (path === "/google/accounts") {
        return {
          accounts: [
            {
              id: "1234567890",
              name: "Google Conta",
              metrics: {
                currentMonthCostMicros: 300_000_000,
                averageDailyCostMicros: 15_000_000
              }
            }
          ]
        };
      }
      return { accounts: [] };
    });

    const response = await app.inject({
      method: "GET",
      url: "/metrics/spend-overview",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    const metaItem = body.items.find((item) => item.platform === "meta");
    expect(metaItem).toMatchObject({
      platform: "meta",
      clientName: "Ativo",
      creditLimit: 2500
    });
    expect(metaItem?.balanceAvailable).toBeCloseTo(123.45);
    expect(metaItem?.monthToDateSpend).toBeCloseTo(98.76);
    expect(metaItem?.averageDailySpend).toBeCloseTo(35);
    expect(body.items.find((item) => item.platform === "google")).toBeUndefined();
    expect(callExternalApiMock).toHaveBeenCalled();
  });
});
