import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";
import { getTimeEntriesRepository } from "../repositories/time-entries-repository.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

const suporteToken = Buffer.from(
  JSON.stringify({ uid: "suporte", roles: ["suporte"], orgId: "org-1" })
).toString("base64");

const externoToken = Buffer.from(
  JSON.stringify({ uid: "externo", roles: ["externo"], orgId: "org-1" })
).toString("base64");

describe("reports hours route", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
    const projectsRepo = getProjectsRepository();
    const tasksRepo = getTasksRepository();
    const entriesRepo = getTimeEntriesRepository();

    const project = await projectsRepo.create(
      "org-1",
      { clientId: "client-1", name: "Projeto Report" },
      "gestor"
    );
    const task = await tasksRepo.create(
      "org-1",
      project.id,
      { title: "Auditoria", status: "todo" },
      "gestor"
    );

    await entriesRepo.create(
      "org-1",
      {
        projectId: project.id,
        taskId: task.id,
        date: "2025-11-05",
        reportedMinutes: 120,
        notes: null
      },
      "gestor"
    );
    await entriesRepo.create(
      "org-1",
      {
        projectId: project.id,
        taskId: task.id,
        date: "2025-11-06",
        reportedMinutes: 60,
        notes: null
      },
      "analista"
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("aggregates hours in the given range", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/reports/hours?startDate=2025-11-05&endDate=2025-11-06",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      totals: { minutes: number; perProject: Array<{ id: string; minutes: number }> };
    };
    expect(body.totals.minutes).toBe(180);
    expect(body.totals.perProject[0]).toHaveProperty("minutes");
  });

  it("allows suporte role to view reports", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/reports/hours",
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });
    expect(response.statusCode).toBe(200);
  });

  it("agrupa horas por dia quando solicitado", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/reports/hours?startDate=2025-11-05&endDate=2025-11-06&groupBy=day",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { totals: { perDay?: Array<{ date: string; minutes: number }> } };
    expect(body.totals.perDay).toEqual(
      expect.arrayContaining([
        { date: "2025-11-05", minutes: 120 },
        { date: "2025-11-06", minutes: 60 }
      ])
    );
  });

  it("blocks roles not allowed", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/reports/hours",
      headers: {
        authorization: `Bearer ${externoToken}`
      }
    });
    expect(response.statusCode).toBe(403);
  });
});

describe("reports tasks by client route", () => {
  const app = buildApp();

  beforeAll(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-12-01T10:00:00.000Z"));
    await app.ready();

    const clientsRepo = getClientsRepository();
    const projectsRepo = getProjectsRepository();
    const tasksRepo = getTasksRepository();

    const clientA = await clientsRepo.create("org-1", { name: "Cliente A" }, "gestor");
    const clientB = await clientsRepo.create("org-1", { name: "Cliente B" }, "gestor");

    const projectA = await projectsRepo.create(
      "org-1",
      { clientId: clientA.id, name: "Projeto A" },
      "gestor"
    );
    const projectB = await projectsRepo.create(
      "org-1",
      { clientId: clientB.id, name: "Projeto B" },
      "gestor"
    );

    const reportTask = await tasksRepo.create(
      "org-1",
      projectA.id,
      { title: "Relatorio mensal", type: "report", status: "todo", assignees: ["user-1"] },
      "gestor"
    );
    const creativeTask = await tasksRepo.create(
      "org-1",
      projectA.id,
      { title: "Criativo novo", type: "creative", status: "todo", assignees: ["user-2"] },
      "gestor"
    );
    const meetingTask = await tasksRepo.create(
      "org-1",
      projectB.id,
      { title: "Reuniao de alinhamento", type: "meeting", status: "todo", assignees: ["user-3"] },
      "gestor"
    );

    vi.setSystemTime(new Date("2025-12-05T12:00:00.000Z"));
    await tasksRepo.update("org-1", projectA.id, reportTask.id, { status: "done" }, "gestor");

    vi.setSystemTime(new Date("2025-12-06T12:00:00.000Z"));
    await tasksRepo.update("org-1", projectB.id, meetingTask.id, { status: "done" }, "gestor");

    vi.setSystemTime(new Date("2025-12-07T12:00:00.000Z"));
    await tasksRepo.update("org-1", projectA.id, creativeTask.id, { status: "done" }, "gestor");
  });

  afterAll(async () => {
    vi.useRealTimers();
    await app.close();
  });

  it("returns summary tasks grouped by client", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/reports/tasks-by-client?periodStart=2025-12-01&periodEnd=2025-12-31",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      totals: { clients: number; tasks: number };
      clients: Array<{ clientName: string; tasks: Array<{ type: string }> }>;
    };

    expect(body.totals.clients).toBe(2);
    expect(body.totals.tasks).toBe(2);
    const clientA = body.clients.find((client) => client.clientName === "Cliente A");
    expect(clientA?.tasks.map((task) => task.type)).toEqual(expect.arrayContaining(["report"]));
    expect(clientA?.tasks.some((task) => task.type === "creative")).toBe(false);
  });

  it("respects explicit type filter", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/reports/tasks-by-client?periodStart=2025-12-01&periodEnd=2025-12-31&types=creative",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      totals: { clients: number; tasks: number };
      clients: Array<{ tasks: Array<{ type: string }> }>;
    };

    expect(body.totals.clients).toBe(1);
    expect(body.totals.tasks).toBe(1);
    expect(body.clients[0]?.tasks[0]?.type).toBe("creative");
  });

  it("blocks roles not allowed", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/reports/tasks-by-client?periodStart=2025-12-01&periodEnd=2025-12-31",
      headers: {
        authorization: `Bearer ${externoToken}`
      }
    });

    expect(response.statusCode).toBe(403);
  });
});
