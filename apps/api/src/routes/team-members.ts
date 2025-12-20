import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { isAdminUser } from "../auth/is-admin.js";
import { getTeamMembersRepository } from "../repositories/team-members-repository.js";

const repo = getTeamMembersRepository();

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  role: z.enum(["gestor", "analista", "criativo", "suporte", "outro"]).optional(),
  accessRole: z.enum(["member", "admin"]).optional(),
  phone: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  weeklyCapacityMinutes: z.number().int().nonnegative().nullable().optional(),
  userId: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

const updateSchema = createSchema.partial().refine((value) => Object.keys(value).length > 0, {
  message: "Informe ao menos um campo"
});

const listQuerySchema = z.object({
  status: z.enum(["active", "inactive"]).optional()
});

const deleteQuerySchema = z.object({
  hard: z.union([z.literal("true"), z.literal("false")]).optional()
});

export async function registerTeamMemberRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/team/members",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!isAdminUser(user) && !user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
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

  app.post(
    "/team/members",
    { preHandler: [app.authenticate, app.requireOrg(), app.requireAdmin()] },
    async (request, reply) => {
      const user = request.user!;
      const parsed = createSchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }
      if (parsed.data.accessRole === "admin" && !isAdminUser({ email: parsed.data.email ?? undefined })) {
        throw reply.forbidden("Apenas emails autorizados podem receber papel admin");
      }
      const orgId = request.orgId!;
      const record = await repo.create(orgId, parsed.data, user.uid);
      return reply.code(201).send(record);
    }
  );

  app.put(
    "/team/members/:id",
    { preHandler: [app.authenticate, app.requireOrg(), app.requireAdmin()] },
    async (request, reply) => {
      const user = request.user!;
      const parsed = updateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }
      if (parsed.data.accessRole === "admin" && !isAdminUser({ email: parsed.data.email ?? undefined })) {
        throw reply.forbidden("Apenas emails autorizados podem receber papel admin");
      }
      const { id } = request.params as { id: string };
      const orgId = request.orgId!;
      try {
        const record = await repo.update(orgId, id, parsed.data, user.uid);
        return record;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to update team member");
        throw reply.notFound("Membro nao encontrado");
      }
    }
  );

  app.delete(
    "/team/members/:id",
    { preHandler: [app.authenticate, app.requireOrg(), app.requireAdmin()] },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };
      const parsed = deleteQuerySchema.safeParse(request.query);
      const hard = parsed.success ? parsed.data.hard === "true" : false;
      const orgId = request.orgId!;
      try {
        if (hard) {
          await repo.hardDelete(orgId, id, user.uid);
          return { ok: true, deleted: true };
        }
        const record = await repo.archive(orgId, id, user.uid);
        return record;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to archive team member");
        throw reply.notFound("Membro nao encontrado");
      }
    }
  );
}
