import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

const analistaToken = Buffer.from(
  JSON.stringify({ uid: "analista", roles: ["analista"], orgId: "org-1" })
).toString("base64");

const suporteToken = Buffer.from(
  JSON.stringify({ uid: "suporte", roles: ["suporte"], orgId: "org-1" })
).toString("base64");

describe("time entries routes", () => {
  const app = buildApp();
  let entryId: string;
  let projectId: string;
  let taskId: string;

  beforeAll(async () => {
    await app.ready();
    const projectsRepo = getProjectsRepository();
    const tasksRepo = getTasksRepository();
    const project = await projectsRepo.create(
      "org-1",
      { clientId: "client-test", name: "Projeto Teste" },
      "gestor"
    );
    projectId = project.id;
    const task = await tasksRepo.create(
      "org-1",
      projectId,
      { title: "Setup", description: null, status: "todo" },
      "gestor"
    );
    taskId = task.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("permite criar lancamento", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/time-entries",
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        projectId,
        taskId,
        date: "2025-11-06",
        reportedMinutes: 120,
        notes: "Campanha de Black Friday"
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: string };
    expect(body.id).toBeDefined();
    entryId = body.id;
  });

  it("permite listar lancamentos", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/time-entries",
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string }> };
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("permite editar lancamento", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/time-entries/${entryId}`,
      headers: {
        authorization: `Bearer ${analistaToken}`
      },
      payload: {
        reportedMinutes: 150
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { reportedMinutes: number };
    expect(body.reportedMinutes).toBe(150);
  });

  it("retorna resumo por projeto", async () => {
    const secondEntry = await app.inject({
      method: "POST",
      url: "/time-entries",
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        projectId,
        taskId,
        date: "2025-11-07",
        reportedMinutes: 30,
        notes: "Follow-up"
      }
    });
    expect(secondEntry.statusCode).toBe(201);

    const response = await app.inject({
      method: "GET",
      url: `/time-entries/summary?projectId=${projectId}`,
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { totals: Record<string, number> };
    expect(body.totals[taskId]).toBeGreaterThan(0);
  });

  it("permite remover lancamento", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/time-entries/${entryId}`,
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true });
  });

  it("bloqueia suporte ao criar", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/time-entries",
      headers: {
        authorization: `Bearer ${suporteToken}`
      },
      payload: {
        projectId,
        taskId,
        date: "2025-11-06",
        reportedMinutes: 60
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("rejeita projeto ou tarefa invalidos", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/time-entries",
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        projectId: "invalid",
        taskId,
        date: "2025-11-06",
        reportedMinutes: 30
      }
    });

    expect(response.statusCode).toBe(400);
  });
});
