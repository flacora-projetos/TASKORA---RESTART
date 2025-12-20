import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { getClientTimelineRepository } from "../repositories/client-timeline-repository.js";
import { getClientsRepository } from "../repositories/clients-repository.js";

const repo = getClientTimelineRepository();
const clientsRepository = getClientsRepository();

const listQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).optional(),
  eventType: z.enum(["note", "meeting", "integration", "task", "hour", "report", "alert"]).optional(),
  before: z.string().datetime().optional()
});

const createSchema = z.object({
  title: z.string().min(3).max(160),
  description: z.string().max(2000).nullable().optional(),
  eventType: z.enum(["note", "meeting", "integration", "task", "hour", "report", "alert"]).default("note"),
  tags: z.array(z.string().min(1).max(32)).max(6).optional(),
  metadata: z.record(z.any()).nullable().optional(),
  occurredAt: z.string().datetime().optional(),
  source: z.string().max(120).nullable().optional()
});

function ensureTimelineAccess(reply: FastifyReply, roles: string[]) {
  if (!roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
    throw reply.forbidden("Acesso negado");
  }
}

function ensureWriteAccess(reply: FastifyReply, roles: string[]) {
  if (!roles.some((role) => ["gestor", "analista"].includes(role))) {
    throw reply.forbidden("Somente gestores ou analistas podem registrar eventos");
  }
}

export async function registerClientTimelineRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/:id/timeline",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      ensureTimelineAccess(reply, user.roles);

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;
      const client = await clientsRepository.findById(orgId, id);
      if (!client) {
        throw reply.notFound("Cliente nǜo encontrado");
      }

      const parsedQuery = listQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw reply.badRequest(parsedQuery.error.issues.map((issue) => issue.message).join(", "));
      }

      const items = await repo.list(orgId, id, {
        limit: parsedQuery.data.limit,
        eventType: parsedQuery.data.eventType,
        before: parsedQuery.data.before
      });
      return { items };
    }
  );

  app.post(
    "/:id/timeline",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      ensureWriteAccess(reply, user.roles);

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;
      const client = await clientsRepository.findById(orgId, id);
      if (!client) {
        throw reply.notFound("Cliente nǜo encontrado");
      }

      const parsedBody = createSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw reply.badRequest(parsedBody.error.issues.map((issue) => issue.message).join(", "));
      }

      const event = await repo.add(
        orgId,
        client.id,
        parsedBody.data,
        { id: user.uid ?? null, label: user.email ?? user.uid ?? null }
      );

      return reply.code(201).send(event);
    }
  );
}
