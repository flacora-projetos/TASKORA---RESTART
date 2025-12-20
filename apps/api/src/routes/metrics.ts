import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getMetricsSummarySnapshot, getSpendOverviewSnapshot } from "../services/dashboard-data.js";

function hasAllowedRole(roles: string[]): boolean {
  return roles.some((role) => ["gestor", "analista", "suporte"].includes(role));
}

const spendQuerySchema = z.object({
  force: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((value) => value === "true")
});

export async function registerMetricsRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/metrics/summary",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!hasAllowedRole(user.roles)) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const orgId = request.orgId!;
      return getMetricsSummarySnapshot(orgId);
    }
  );

  app.get(
    "/metrics/spend-overview",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!hasAllowedRole(user.roles)) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsed = spendQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw reply.badRequest("Query param force invalido");
      }
      const orgId = request.orgId!;
      return getSpendOverviewSnapshot(orgId, { force: parsed.data.force });
    }
  );
}
