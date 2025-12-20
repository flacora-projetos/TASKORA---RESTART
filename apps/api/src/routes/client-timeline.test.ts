import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getClientsRepository } from "../repositories/clients-repository.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1", email: "gestor@taskora.com" })
).toString("base64");

const analistaToken = Buffer.from(
  JSON.stringify({ uid: "analista", roles: ["analista"], orgId: "org-1" })
).toString("base64");

const suporteToken = Buffer.from(
  JSON.stringify({ uid: "suporte", roles: ["suporte"], orgId: "org-1" })
).toString("base64");

describe("client timeline routes", () => {
  const app = buildApp();
  let clientId: string;

  beforeAll(async () => {
    await app.ready();
    const repo = getClientsRepository();
    const client = await repo.create("org-1", { name: "Cliente Timeline" }, "gestor");
    clientId = client.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows gestor to create timeline events", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/clients/${clientId}/timeline`,
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        title: "Kickoff realizado",
        description: "Reuniao de alinhamento inicial com o cliente",
        eventType: "meeting",
        tags: ["kickoff", "reuniao"]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: string; eventType: string; actorLabel: string | null };
    expect(body.id).toBeDefined();
    expect(body.eventType).toBe("meeting");
    expect(body.actorLabel).toBe("gestor@taskora.com");
  });

  it("lists timeline events for readers", async () => {
    const second = await app.inject({
      method: "POST",
      url: `/clients/${clientId}/timeline`,
      headers: {
        authorization: `Bearer ${analistaToken}`
      },
      payload: {
        title: "Atualizacao de criativos",
        eventType: "task"
      }
    });
    expect(second.statusCode).toBe(201);

    const response = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/timeline`,
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ title: string }> };
    expect(body.items.length).toBeGreaterThanOrEqual(2);
    expect(body.items[0].title).toBe("Atualizacao de criativos");
  });

  it("supports filtering by event type and cursor", async () => {
    await app.inject({
      method: "POST",
      url: `/clients/${clientId}/timeline`,
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        title: "Reuniao semanal",
        eventType: "meeting",
        occurredAt: "2025-11-10T10:00:00.000Z"
      }
    });

    await app.inject({
      method: "POST",
      url: `/clients/${clientId}/timeline`,
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        title: "Checklist GA4",
        eventType: "task",
        occurredAt: "2025-11-09T10:00:00.000Z"
      }
    });

    const filtered = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/timeline?eventType=meeting&limit=5`,
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json() as { items: Array<{ eventType: string; title: string }> };
    expect(body.items.every((item) => item.eventType === "meeting")).toBe(true);

    const cursorResponse = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/timeline?before=2025-11-10T09:00:00.000Z&limit=5`,
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });
    expect(cursorResponse.statusCode).toBe(200);
    const cursorBody = cursorResponse.json() as { items: Array<{ title: string }> };
    expect(cursorBody.items.some((item) => item.title === "Checklist GA4")).toBe(true);
  });

  it("prevents suporte from creating events", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/clients/${clientId}/timeline`,
      headers: {
        authorization: `Bearer ${suporteToken}`
      },
      payload: {
        title: "Nao deve criar",
        eventType: "note"
      }
    });

    expect(response.statusCode).toBe(403);
  });
});
