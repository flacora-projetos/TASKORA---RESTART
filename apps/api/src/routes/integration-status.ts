import type { FastifyInstance } from "fastify";

import { getIntegrationStatusSnapshot } from "../services/dashboard-data.js";

export async function registerIntegrationStatusRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/metrics/integrations/status",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const orgId = request.orgId!;
      return getIntegrationStatusSnapshot(orgId);
    }
  );
}
