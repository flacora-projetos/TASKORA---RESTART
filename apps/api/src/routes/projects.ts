import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { emitOrgNotification } from "../services/notifications.js";

const repo = getProjectsRepository();
const clientsRepo = getClientsRepository();

const projectBodySchema = z.object({
  clientId: z.string().min(1),
  name: z.string().min(1),
  ownerId: z.string().nullable().optional(),
  budget: z.number().positive().nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional(),
  notes: z.string().nullable().optional()
});

const projectUpdateSchema = projectBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "Informe ao menos um campo para atualizar"
  }
);

const listQuerySchema = z.object({
  clientId: z.string().optional(),
  status: z.enum(["draft", "active", "paused", "completed"]).optional()
});

function actorLabel(user: { email?: string | null; uid?: string | null }): string {
  return user.email ?? user.uid ?? "Alguem";
}

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/projects",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissão insuficiente");
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

  app.post(
    "/projects",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.includes("gestor")) {
        throw reply.forbidden("Somente gestores podem criar projetos");
      }

      const parsed = projectBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const orgId = request.orgId!;
      const client = await clientsRepo.findById(orgId, parsed.data.clientId);
      if (!client) {
        throw reply.badRequest("Cliente inválido");
      }

      const record = await repo.create(orgId, parsed.data, user.uid);
      void emitOrgNotification(
        {
          orgId,
          title: `Novo projeto: ${record.name}`,
          body: `${actorLabel(user)} criou para ${client.name}`,
          eventType: "project_created",
          entityId: record.id,
          entityType: "project",
          actorId: user.uid ?? null,
          actorName: user.email ?? null,
          data: {
            clientId: client.id
          }
        },
        { logger: request.log }
      );
      return reply.code(201).send(record);
    }
  );

  app.put(
    "/projects/:id",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista"].includes(role))) {
        throw reply.forbidden("Permissão insuficiente");
      }

      const { id } = request.params as { id: string };
      const parsed = projectUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const orgId = request.orgId!;
      if (parsed.data.clientId) {
        const client = await clientsRepo.findById(orgId, parsed.data.clientId);
        if (!client) {
          throw reply.badRequest("Cliente inválido");
        }
      }

      try {
        const updated = await repo.update(orgId, id, parsed.data, user.uid);
        void emitOrgNotification(
          {
            orgId,
            title: `Projeto atualizado: ${updated.name}`,
            body: `${actorLabel(user)} editou o projeto`,
            eventType: "project_updated",
            entityId: updated.id,
            entityType: "project",
            actorId: user.uid ?? null,
            actorName: user.email ?? null,
            data: {
              clientId: updated.clientId
            }
          },
          { logger: request.log }
        );
        return updated;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to update project");
        throw reply.notFound("Projeto não encontrado");
      }
    }
  );

  app.delete(
    "/projects/:id",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.includes("gestor")) {
        throw reply.forbidden("Permissão insuficiente");
      }

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;

      try {
        const archived = await repo.archive(orgId, id, user.uid);
        void emitOrgNotification(
          {
            orgId,
            title: "Projeto arquivado",
            body: `${actorLabel(user)} arquivou um projeto`,
            eventType: "project_archived",
            entityId: archived.id,
            entityType: "project",
            actorId: user.uid ?? null,
            actorName: user.email ?? null
          },
          { logger: request.log }
        );
        return archived;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to archive project");
        throw reply.notFound("Projeto não encontrado");
      }
    }
  );
}
