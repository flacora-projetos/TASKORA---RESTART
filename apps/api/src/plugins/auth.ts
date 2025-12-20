import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { isAdminUser } from "../auth/is-admin.js";
import type { AuthenticatedUser } from "../services/auth.js";
import { verifyAccessToken } from "../services/auth.js";
import { isUserMemberOfOrg } from "../services/organizations.js";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRoles: (roles: string[]) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireOrg: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireAdmin: () => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: AuthenticatedUser | null;
    orgId?: string | null;
  }
}

function userHasRoles(user: AuthenticatedUser, requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) {
    return true;
  }
  return requiredRoles.some((role) => user.roles.includes(role));
}

export default fp(async function authPlugin(app: FastifyInstance) {
  app.decorateRequest("user", null);

  app.decorate("authenticate", async function authenticate(request: FastifyRequest, reply: FastifyReply) {
    if (request.method === "OPTIONS") {
      // Preflight requests don't carry auth headers; let CORS plugin handle them.
      return;
    }

    const authorization = request.headers.authorization;

    if (!authorization) {
      throw reply.unauthorized("Missing Authorization header");
    }

    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw reply.unauthorized("Invalid Authorization header format");
    }

    try {
      const user = await verifyAccessToken(token);
      request.user = user;
      request.orgId = user.orgId ?? null;
    } catch (error) {
      request.log.warn({ err: error }, "Token verification failed");
      throw reply.unauthorized("Invalid or expired token");
    }
  });

  app.decorate("requireRoles", function requireRolesDecorator(requiredRoles: string[]) {
    return async function requireRolesHandler(request: FastifyRequest, reply: FastifyReply) {
      if (!request.user) {
        throw reply.unauthorized("User not authenticated");
      }

      if (!userHasRoles(request.user, requiredRoles)) {
        throw reply.forbidden("Insufficient role");
      }
    };
  });

  app.decorate("requireOrg", function requireOrgDecorator() {
    return async function requireOrgHandler(request: FastifyRequest, reply: FastifyReply) {
      if (!request.user) {
        throw reply.unauthorized("User not authenticated");
      }

      const requestedOrgId =
        (request.headers["x-org-id"] as string | undefined) ?? request.user.orgId ?? null;

      if (!requestedOrgId) {
        throw reply.forbidden("Organization not assigned to user");
      }

      const isMember = await isUserMemberOfOrg(requestedOrgId, request.user);
      if (!isMember) {
        throw reply.forbidden("User not member of organization");
      }

      request.orgId = requestedOrgId;
    };
  });

  app.decorate("requireAdmin", function requireAdminDecorator() {
    return async function requireAdminHandler(request: FastifyRequest, reply: FastifyReply) {
      if (!request.user) {
        throw reply.unauthorized("User not authenticated");
      }
      if (!isAdminUser(request.user)) {
        throw reply.forbidden("Apenas administradores podem acessar esta rota");
      }
    };
  });
});
