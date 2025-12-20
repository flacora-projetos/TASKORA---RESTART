import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { firestoreConfigured } from "../firebase.js";
import { externalEntryToSummary, refreshDirectoryCache, searchDirectoryCache } from "../services/directory-cache.js";
import { callExternalApi } from "../services/external-clients.js";
import { env } from "../env.js";
import type { ExternalDirectoryResponse } from "../types/directory.js";

const listQuerySchema = z.object({
  q: z.string().max(200).optional(),
  platform: z.enum(["google", "meta"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

export async function registerDirectoryIntegrationRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/directory/clients",
    {
      preHandler: [app.authenticate, app.requireRoles(["gestor", "analista", "suporte"])]
    },
    async (request, reply) => {
      const parsed = listQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const { q, platform, limit } = parsed.data;
      const logger = {
        log: request.log.info.bind(request.log),
        warn: request.log.warn.bind(request.log),
        error: request.log.error.bind(request.log)
      };

      if (!firestoreConfigured) {
        try {
          const response = (await callExternalApi({
            path: "/directory/clients",
            query: parsed.data
          })) as ExternalDirectoryResponse;
          const items = response?.data?.items ?? [];
          return {
            items: items.map((entry) => externalEntryToSummary(entry))
          };
        } catch (error) {
          request.log.error({ err: error }, "Failed to call directory clients endpoint");
          throw reply.badGateway("Erro ao consultar diretório externo");
        }
      }

      let result = await searchDirectoryCache({ query: q, platform, limit });

      if ((result.items.length === 0 || result.stats.stale) && parsed.data.limit !== 0 && env.EXTERNAL_API_BEARER) {
        try {
          await refreshDirectoryCache({ logger });
          result = await searchDirectoryCache({ query: q, platform, limit });
        } catch (error) {
          request.log.warn({ err: error }, "Failed to refresh directory cache");
        }
      }

      return {
        items: result.items,
        cache: {
          total: result.stats.total,
          lastSyncedAt: result.stats.lastSyncedAt,
          stale: result.stats.stale
        }
      };
    }
  );
}
