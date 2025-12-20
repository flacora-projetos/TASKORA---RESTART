import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getClientTimelineRepository } from "../repositories/client-timeline-repository.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

const analistaToken = Buffer.from(
  JSON.stringify({ uid: "analista", roles: ["analista"], orgId: "org-1" })
).toString("base64");

const suporteToken = Buffer.from(
  JSON.stringify({ uid: "suporte", roles: ["suporte"], orgId: "org-1" })
).toString("base64");

describe("tasks routes", () => {
  const app = buildApp();
  const timelineRepository = getClientTimelineRepository();
  let projectId: string;
  let taskId: string;
  let clientId: string;

  beforeAll(async () => {
    await app.ready();
    const clientsRepo = getClientsRepository();
    const projectsRepo = getProjectsRepository();

    const client = await clientsRepo.create("org-1", { name: "Cliente Tasks" }, "gestor");
    const project = await projectsRepo.create(
      "org-1",
      {
        clientId: client.id,
        name: "Projeto Tasks"
      },
      "gestor"
    );

    clientId = client.id;
    projectId = project.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("allows gestor to create a task", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/tasks`,
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        title: "Revisar criativos",
        status: "todo",
        assignees: ["dev-1"],
        checklist: [
          {
            label: "Baixar relatorio"
          }
        ]
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: string };
    expect(body.id).toBeDefined();
    taskId = body.id;
  });

  it("lists tasks for the project", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/projects/${projectId}/tasks`,
      headers: {
        authorization: `Bearer ${suporteToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string }> };
    expect(body.items.some((item) => item.id === taskId)).toBe(true);
  });

  it("allows analista to update status and integration", async () => {
    const dueDate = new Date();
    dueDate.setUTCHours(12, 0, 0, 0);

    const response = await app.inject({
      method: "PUT",
      url: `/projects/${projectId}/tasks/${taskId}`,
      headers: {
        authorization: `Bearer ${analistaToken}`
      },
      payload: {
        status: "in_progress",
        dueDate: dueDate.toISOString(),
        integration: {
          provider: "google",
          externalId: "opt-123",
          syncStatus: "pending"
        }
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; integration: { externalId: string | null } | null };
    expect(body.status).toBe("in_progress");
    expect(body.integration?.externalId).toBe("opt-123");

    const events = await timelineRepository.list("org-1", clientId, { eventType: "task", limit: 10 });
    const taskEvents = events.filter((event) => {
      const metadata = event.metadata as { taskId?: string } | null;
      return metadata?.taskId === taskId;
    });
    expect(taskEvents.some((event) => event.tags.includes("status"))).toBe(true);
    expect(taskEvents.some((event) => event.tags.includes("prazo"))).toBe(true);
    expect(taskEvents.some((event) => event.tags.includes("prioridade"))).toBe(true);
  });

  it("returns the consolidated overview", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/tasks/overview",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      items: Array<{ id: string }>;
      cards: { today: { total: number } };
      filters: { clients: Array<{ id: string }> };
    };

    expect(body.items.some((item) => item.id === taskId)).toBe(true);
    expect(body.cards.today.total).toBeGreaterThanOrEqual(1);
    expect(body.filters.clients.length).toBeGreaterThan(0);
  });

  it("allows gestor to archive a task", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/projects/${projectId}/tasks/${taskId}`,
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { archivedAt: string | null };
    expect(body.archivedAt).toBeTruthy();
  });

  it("prevents suporte from creating tasks", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/projects/${projectId}/tasks`,
      headers: {
        authorization: `Bearer ${suporteToken}`
      },
      payload: {
        title: "Nao deve criar"
      }
    });

    expect(response.statusCode).toBe(403);
  });
});
