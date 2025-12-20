import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getClientMetricsStatusRepository } from "../repositories/client-metrics-status-repository.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getDirectoryClientsRepository } from "../repositories/directory-clients-repository.js";
import type { ClientEntity } from "../types/clients.js";

function makeToken(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

const gestorToken = makeToken({
  uid: "gestor-1",
  email: "gestor@taskora.com",
  roles: ["gestor"],
  orgId: "org-001",
});

const analistaToken = makeToken({
  uid: "analista-1",
  email: "analista@taskora.com",
  roles: ["analista"],
  orgId: "org-001",
});

const otherOrgToken = makeToken({
  uid: "gestor-2",
  email: "gestor2@taskora.com",
  roles: ["gestor"],
  orgId: "org-999",
});

const summaryToken = makeToken({
  uid: "gestor-summary",
  email: "gestor+summary@taskora.com",
  roles: ["gestor"],
  orgId: "org-123",
});

describe("clients routes", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects access without token", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/clients",
    });

    expect(response.statusCode).toBe(401);
  });

  it("allows gestor to create a client", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/clients",
      headers: {
        authorization: `Bearer ${gestorToken}`,
      },
      payload: {
        name: "Acme Corp",
        segment: "E-commerce",
        monthlyBudget: 25000,
        platforms: ["google", "meta"],
        driveLink: "https://drive.google.com/acme",
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: string };
    expect(body.id).toBeDefined();
  });

  it("prevents analista from creating client", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/clients",
      headers: {
        authorization: `Bearer ${analistaToken}`,
      },
      payload: {
        name: "Another Client",
      },
    });

    expect(response.statusCode).toBe(403);
  });

  it("lists clients only for the authenticated tenant", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/clients",
      headers: {
        authorization: `Bearer ${gestorToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string; name: string }> };
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items[0]?.name).toBe("Acme Corp");
  });

  it("prevents other org from seeing records", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/clients",
      headers: {
        authorization: `Bearer ${otherOrgToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<unknown> };
    expect(body.items).toHaveLength(0);
  });

  it("returns a single client by id", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/clients",
      headers: {
        authorization: `Bearer ${gestorToken}`,
      },
    });
    const listBody = listResponse.json() as { items: Array<{ id: string }> };
    const clientId = listBody.items[0]?.id;
    expect(clientId).toBeDefined();

    const response = await app.inject({
      method: "GET",
      url: `/clients/${clientId}`,
      headers: {
        authorization: `Bearer ${gestorToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const client = response.json() as { id: string };
    expect(client.id).toBe(clientId);
  });

  it("allows analista to update client status", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/clients",
      headers: {
        authorization: `Bearer ${gestorToken}`,
      },
    });
    const listBody = listResponse.json() as { items: Array<{ id: string }> };
    const clientId = listBody.items[0]?.id;
    expect(clientId).toBeDefined();

    const updateResponse = await app.inject({
      method: "PUT",
      url: `/clients/${clientId}`,
      headers: {
        authorization: `Bearer ${analistaToken}`,
      },
      payload: {
        status: "active",
        platforms: ["google"],
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json() as { platforms: string[] };
    expect(updated.platforms).toEqual(["google"]);
  });

  it("archives client when gestor requests delete", async () => {
    const listResponse = await app.inject({
      method: "GET",
      url: "/clients",
      headers: {
        authorization: `Bearer ${gestorToken}`,
      },
    });
    const { items } = listResponse.json() as { items: ClientEntity[] };
    const clientId = items[0]?.id;
    expect(clientId).toBeDefined();

    const deleteResponse = await app.inject({
      method: "DELETE",
      url: `/clients/${clientId}`,
      headers: {
        authorization: `Bearer ${gestorToken}`,
      },
    });

    expect(deleteResponse.statusCode).toBe(200);
    const archived = deleteResponse.json() as ClientEntity;
    expect(archived.status).toBe("archived");
    expect(archived.archivedAt).toBeTruthy();
  });

  it("retorna dados consolidados para o dashboard", async () => {
    const createClient = async (payload: Record<string, unknown>): Promise<string> => {
      const response = await app.inject({
        method: "POST",
        url: "/clients",
        headers: {
          authorization: `Bearer ${summaryToken}`,
        },
        payload,
      });
      expect(response.statusCode).toBe(201);
      const body = response.json() as { id: string };
      return body.id;
    };

    const noIdsId = await createClient({
      name: "Cliente Sem IDs",
      segment: "Teste",
    });
    const withMetricsId = await createClient({
      name: "Cliente Completo",
      googleCustomerIds: ["123-456-7890"],
    });
    const idsPendingMetricsId = await createClient({
      name: "Cliente IDs sem metricas",
      metaAccountIds: ["act_987"],
    });

    const now = new Date().toISOString();
    const clientsRepo = getClientsRepository();
    await clientsRepo.updateIntegrations(
      "org-123",
      withMetricsId,
      { directoryId: "dir-200", syncedAt: now },
      "gestor-summary",
    );
    await clientsRepo.updateIntegrations(
      "org-123",
      idsPendingMetricsId,
      { directoryId: "dir-201", syncedAt: now },
      "gestor-summary",
    );

    const directoryRepo = getDirectoryClientsRepository();
    await directoryRepo.deleteWhereSyncedBefore("9999-12-31T23:59:59.000Z");
    await directoryRepo.upsertMany([
      {
        id: "dir-199",
        name: "Lead 1",
        nameLowercase: "lead 1",
        aliases: [],
        platforms: [],
        googleCustomerIds: [],
        metaAccountIds: [],
        ga4PropertyIds: [],
        searchText: "lead",
        directorySnapshot: null,
        syncedAt: now,
        updatedAt: now,
      },
      {
        id: "dir-200",
        name: "Cliente Completo",
        nameLowercase: "cliente completo",
        aliases: [],
        platforms: ["google"],
        googleCustomerIds: ["123-456-7890"],
        metaAccountIds: [],
        ga4PropertyIds: [],
        searchText: "cliente completo",
        directorySnapshot: null,
        syncedAt: now,
        updatedAt: now,
      },
      {
        id: "dir-201",
        name: "Cliente IDs sem metricas",
        nameLowercase: "cliente ids sem metricas",
        aliases: [],
        platforms: ["meta"],
        googleCustomerIds: [],
        metaAccountIds: ["act_987"],
        ga4PropertyIds: [],
        searchText: "cliente ids sem metricas",
        directorySnapshot: null,
        syncedAt: now,
        updatedAt: now,
      },
    ]);

    const metricsRepo = getClientMetricsStatusRepository();
    await metricsRepo.upsert("org-123", withMetricsId, "Cliente Completo", "google", "connected");
    await metricsRepo.upsert(
      "org-123",
      idsPendingMetricsId,
      "Cliente IDs sem metricas",
      "meta",
      "pending",
    );

    const response = await app.inject({
      method: "GET",
      url: "/clients/summary",
      headers: {
        authorization: `Bearer ${summaryToken}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      totals: { active: number; withIds: number; withMetrics: number };
      pipeline: Array<{ id: string; count: number }>;
      highlights: {
        missingIds: Array<{ id: string }>;
        missingMetrics: Array<{ id: string }>;
      };
      metadata: { directoryLastSync: string | null };
    };

    expect(body.pipeline).toHaveLength(4);
    expect(body.totals.active).toBeGreaterThanOrEqual(3);
    expect(body.totals.withIds).toBe(2);
    expect(body.totals.withMetrics).toBe(1);
    expect(body.highlights.missingIds.map((item) => item.id)).toContain(noIdsId);
    expect(body.highlights.missingMetrics.map((item) => item.id)).toContain(
      idsPendingMetricsId,
    );
    expect(body.metadata.directoryLastSync).toBe(now);

    await directoryRepo.deleteWhereSyncedBefore("9999-12-31T23:59:59.000Z");
  });
});
