import type { FastifyInstance } from "fastify";

import { pickActiveOrgId, listOrganizationsForUser } from "../services/organizations.js";

export async function registerOrganizationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/organizations",
    {
      preHandler: app.authenticate
    },
    async (request) => {
      const user = request.user;
      const requestedOrgId = (request.headers["x-org-id"] as string | undefined) ?? user?.orgId ?? null;

      const organizations = await listOrganizationsForUser(user!);
      const activeOrgId = pickActiveOrgId(requestedOrgId, organizations, user?.orgId);

      return {
        organizations,
        activeOrgId
      };
    }
  );
}
