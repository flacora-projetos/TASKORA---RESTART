import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getClientsRepository } from "../repositories/clients-repository.js";

const repo = getClientsRepository();

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

const analistaToken = Buffer.from(
  JSON.stringify({ uid: "analista", roles: ["analista"], orgId: "org-1" })
).toString("base64");

describe("projects routes", () => {
  const app = buildApp();
  let clientId: string;
  let projectId: string;

  beforeAll(async () => {
    await app.ready();
    const client = await repo.create("org-1", { name: "Cliente Projetos" }, "gestor");
    clientId = client.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows gestor to create a project", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/projects",
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        clientId,
        name: "Projeto Alpha",
        status: "active"
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: string };
    expect(body.id).toBeDefined();
    projectId = body.id;
  });

  it("lists projects for the org", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/projects",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string }> };
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("allows analista to update a project", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}`,
      headers: {
        authorization: `Bearer ${analistaToken}`
      },
      payload: {
        status: "paused"
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string };
    expect(body.status).toBe("paused");
  });

  it("allows gestor to archive a project", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/projects/${projectId}`,
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; archivedAt: string | null };
    expect(body.status).toBe("completed");
    expect(body.archivedAt).toBeTruthy();
  });
});
