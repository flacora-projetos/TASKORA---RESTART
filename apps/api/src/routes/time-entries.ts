import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { getClientTimelineRepository } from "../repositories/client-timeline-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";
import { getTimeEntriesRepository } from "../repositories/time-entries-repository.js";
import { emitOrgNotification } from "../services/notifications.js";

const repo = getTimeEntriesRepository();
const projectsRepo = getProjectsRepository();
const tasksRepo = getTasksRepository();
const timelineRepo = getClientTimelineRepository();

const dateSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: "Data invalida"
  });

const entryBodySchema = z.object({
  projectId: z.string().min(1),
  taskId: z.string().min(1),
  userId: z.string().min(1).optional(),
  date: dateSchema,
  reportedMinutes: z.coerce.number().int().positive().max(24 * 60),
  notes: z.string().max(1000).nullable().optional()
});

const entryUpdateSchema = entryBodySchema.partial().refine((data) => Object.keys(data).length > 0, {
  message: "Informe ao menos um campo"
});

const listQuerySchema = z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  userId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});

const summaryQuerySchema = z.object({
  projectId: z.string().min(1, "Projeto obrigatorio")
});

function ensureWriter(roles: string[]): boolean {
  return roles.some((role) => ["gestor", "analista"].includes(role));
}

function ensureReader(roles: string[]): boolean {
  return roles.some((role) => ["gestor", "analista", "suporte"].includes(role));
}

function actorLabel(user: { email?: string | null; uid?: string | null }): string {
  return user.email ?? user.uid ?? "Alguem";
}

export async function registerTimeEntryRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/time-entries",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!ensureReader(user.roles)) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const orgId = request.orgId!;
      const items = await repo.list(orgId, parsed.data);
      return { items };
    }
  );

  app.get(
    "/time-entries/summary",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!ensureReader(user.roles)) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsed = summaryQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const orgId = request.orgId!;
      const totals = await repo.summarizeByProject(orgId, parsed.data.projectId);
      return { totals };
    }
  );

  app.post(
    "/time-entries",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!ensureWriter(user.roles)) {
        throw reply.forbidden("Somente gestores ou analistas podem registrar horas");
      }

      const parsed = entryBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const orgId = request.orgId!;
      const { project, task } = await ensureProjectAndTask(orgId, parsed.data.projectId, parsed.data.taskId, reply);
      const record = await repo.create(orgId, parsed.data, user.uid);

      if (project.clientId) {
        await timelineRepo.add(
          orgId,
          project.clientId,
          {
            eventType: "hour",
            title: "Horas registradas",
            description: `Registradas ${record.reportedMinutes} min na tarefa "${task.title}".`,
            tags: ["horas", "tarefas"],
            metadata: {
              projectId: project.id,
              projectName: project.name,
              taskId: task.id,
              taskTitle: task.title,
              minutes: record.reportedMinutes,
              date: record.date,
              assigneeId: record.userId,
              assignees: [record.userId]
            },
            source: "hours",
            occurredAt: record.date
          },
          { id: user.uid ?? null, label: user.email ?? user.uid ?? null }
        );
      }

      void emitOrgNotification(
        {
          orgId,
          title: `Horas registradas: ${task.title}`,
          body: `${actorLabel(user)} registrou ${record.reportedMinutes} min`,
          eventType: "time_entry_created",
          entityId: record.id,
          entityType: "time-entry",
          actorId: user.uid ?? null,
          actorName: user.email ?? null,
          data: {
            projectId: record.projectId,
            taskId: record.taskId,
            minutes: record.reportedMinutes,
            date: record.date
          }
        },
        { logger: request.log }
      );

      return reply.code(201).send(record);
    }
  );

  app.put(
    "/time-entries/:id",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!ensureWriter(user.roles)) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsedBody = entryUpdateSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw reply.badRequest(parsedBody.error.issues.map((issue) => issue.message).join(", "));
      }
      const changes = parsedBody.data;

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;
      const current = await repo.findById(orgId, id);
      if (!current) {
        throw reply.notFound("Lancamento nao encontrado");
      }

      const nextProjectId = changes.projectId ?? current.projectId;
      const nextTaskId = changes.taskId ?? current.taskId;
      const { project, task } = await ensureProjectAndTask(orgId, nextProjectId, nextTaskId, reply);

      try {
        const updated = await repo.update(orgId, id, changes, user.uid);

        if (project.clientId) {
          const changesDescription: string[] = [];
          if (changes.reportedMinutes !== undefined && changes.reportedMinutes !== current.reportedMinutes) {
            changesDescription.push(
              `minutos: ${current.reportedMinutes} → ${changes.reportedMinutes ?? current.reportedMinutes}`
            );
          }
          if (changes.date && changes.date !== current.date) {
            changesDescription.push("data ajustada");
          }
          if (changes.projectId && changes.projectId !== current.projectId) {
            changesDescription.push("projeto alterado");
          }
          if (changes.taskId && changes.taskId !== current.taskId) {
            changesDescription.push("tarefa alterada");
          }

          await timelineRepo.add(
            orgId,
            project.clientId,
            {
              eventType: "hour",
              title: "Horas atualizadas",
              description:
                changesDescription.length > 0
                  ? `Lancamento de horas ajustado (${changesDescription.join(", ")}).`
                  : "Lancamento de horas ajustado.",
              tags: ["horas", "tarefas", "ajuste"],
              metadata: {
                projectId: project.id,
                projectName: project.name,
                taskId: task.id,
                taskTitle: task.title,
                minutes: updated.reportedMinutes,
                date: updated.date,
                assigneeId: updated.userId,
                assignees: [updated.userId]
              },
              source: "hours",
              occurredAt: updated.date
            },
            { id: user.uid ?? null, label: user.email ?? user.uid ?? null }
          );
        }

        void emitOrgNotification(
          {
            orgId,
            title: `Horas atualizadas: ${task.title}`,
            body: `${actorLabel(user)} ajustou para ${updated.reportedMinutes} min`,
            eventType: "time_entry_updated",
            entityId: updated.id,
            entityType: "time-entry",
            actorId: user.uid ?? null,
            actorName: user.email ?? null,
            data: {
              projectId: updated.projectId,
              taskId: updated.taskId,
              minutes: updated.reportedMinutes,
              date: updated.date
            }
          },
          { logger: request.log }
        );

        return updated;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to update time entry");
        throw reply.notFound("Lancamento nao encontrado");
      }
    }
  );

  app.delete(
    "/time-entries/:id",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!ensureWriter(user.roles)) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;

      try {
        await repo.delete(orgId, id);
        void emitOrgNotification(
          {
            orgId,
            title: "Horas removidas",
            body: `${actorLabel(user)} excluiu um lancamento de horas`,
            eventType: "time_entry_deleted",
            entityId: id,
            entityType: "time-entry",
            actorId: user.uid ?? null,
            actorName: user.email ?? null
          },
          { logger: request.log }
        );
        return { success: true };
      } catch (error) {
        request.log.warn({ err: error }, "Failed to delete time entry");
        throw reply.notFound("Lancamento nao encontrado");
      }
    }
  );
}

async function ensureProjectAndTask(
  orgId: string,
  projectId: string,
  taskId: string,
  reply: FastifyReply
) {
  const project = await projectsRepo.findById(orgId, projectId);
  if (!project) {
    throw reply.badRequest("Projeto invalido");
  }
  const task = await tasksRepo.findById(orgId, projectId, taskId);
  if (!task) {
    throw reply.badRequest("Tarefa invalida");
  }
  return { project, task };
}
