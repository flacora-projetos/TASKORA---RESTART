import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "agent-gestor", roles: ["gestor"], orgId: "agent-org" })
).toString("base64");

describe("agent routes", () => {
  const app = buildApp();
  const clientsRepo = getClientsRepository();
  const projectsRepo = getProjectsRepository();
  const tasksRepo = getTasksRepository();
  let projectId: string;

  beforeAll(async () => {
    await app.ready();
    const client = await clientsRepo.create("agent-org", { name: "Agente" }, "agent-gestor");
    const project = await projectsRepo.create(
      "agent-org",
      {
        clientId: client.id,
        name: "Projeto Assistente"
      },
      "agent-gestor"
    );
    projectId = project.id;

    await tasksRepo.create(
      "agent-org",
      projectId,
      {
        title: "Revisar briefing",
        status: "todo",
        dueDate: "2025-12-01T10:00:00.000Z",
        assignees: ["agent-gestor"]
      },
      "agent-gestor"
    );

    await tasksRepo.create(
      "agent-org",
      projectId,
      {
        title: "Enviar relatorio semanal",
        status: "in_progress",
        dueDate: "2025-12-02T12:00:00.000Z",
        assignees: ["agent-gestor"]
      },
      "agent-gestor"
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("responde com o snapshot e um texto stub quando Vertex nao esta configurado", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/agent/query",
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        prompt: "Quais tarefas estao em andamento?",
        tools: [
          {
            kind: "internal_tasks",
            limit: 2
          }
        ],
        history: [
          {
            role: "assistant",
            content: "Ola, posso ajudar com tarefas e integracoes."
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      context: Array<{ kind: string; summary: string; data: { items: unknown[] } }>;
      response: { stubbed: boolean; text: string };
    };

    expect(body.context).toHaveLength(1);
    expect(body.context[0].kind).toBe("internal_tasks");
    expect(body.context[0].data.items.length).toBeGreaterThanOrEqual(1);
    expect(body.response.stubbed).toBe(true);
    expect(body.response.text).toContain("Credenciais do Vertex");
  });

  it("foca em criacao de tarefa e traz apenas os projetos quando nao ha tool task_create", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/agent/query",
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        prompt: "Crie uma tarefa para o cliente Agente",
        tools: [
          {
            kind: "internal_tasks",
            limit: 2
          },
          {
            kind: "external_api",
            path: "/metrics/summary"
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { context: Array<{ id: string; kind: string; data?: Record<string, unknown> }> };

    expect(body.context).toHaveLength(1);
    expect(body.context[0].id).toBe("task_create_hint");
    expect(body.context[0].kind).toBe("internal_tasks");
    expect(body.context[0].data?.["projects"]).toBeTruthy();
    expect(Array.isArray(body.context[0].data?.["projects"])).toBe(true);
  });

  it("cria tarefa via ferramenta task_create quando autorizado", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/agent/query",
      headers: {
        authorization: `Bearer ${gestorToken}`
      },
      payload: {
        prompt: "Crie uma tarefa teste",
        tools: [
          {
            kind: "task_create",
            projectId,
            title: "Tarefa criada pelo agente",
            dueDate: "2025-12-31",
            status: "todo",
            type: "other"
          }
        ]
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { context: Array<{ kind: string; ok: boolean; data?: Record<string, unknown> }> };
    const createResult = body.context.find((item) => item.kind === "task_create");
    expect(createResult?.ok).toBe(true);
    expect(createResult?.data?.["title"]).toBe("Tarefa criada pelo agente");

    const tasks = await tasksRepo.list("agent-org", projectId, {});
    const created = tasks.find((task) => task.title === "Tarefa criada pelo agente");
    expect(created).toBeTruthy();
  });
});
