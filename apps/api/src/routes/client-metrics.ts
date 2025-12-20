import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { getClientTimelineRepository } from "../repositories/client-timeline-repository.js";
import { getClientMetricsStatusRepository } from "../repositories/client-metrics-status-repository.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { fetchClientMetricsSummary, getCachedClientMetricsSummary } from "../services/client-metrics.js";

const metricsQuerySchema = z.object({
  range: z.enum(["LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"]).optional()
});

const PLATFORM_LABELS: Record<"google" | "meta" | "ga4", string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  ga4: "GA4"
};

function ensureMetricsAccess(reply: FastifyReply, roles: string[]) {
  if (!roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
    throw reply.forbidden("Acesso negado");
  }
}

async function recordMetricsStatus({
  summary,
  orgId,
  clientId,
  clientName,
  user
}: {
  summary: Awaited<ReturnType<typeof getCachedClientMetricsSummary>>;
  orgId: string;
  clientId: string;
  clientName: string;
  user: { uid?: string | null; email?: string | null };
}) {
  const metricsStatusRepository = getClientMetricsStatusRepository();
  const timelineRepository = getClientTimelineRepository();

  await Promise.all(
    summary.platforms.map(async (platformSummary) => {
      const previous = await metricsStatusRepository.get(orgId, clientId, platformSummary.platform);
      await metricsStatusRepository.upsert(orgId, clientId, clientName, platformSummary.platform, platformSummary.status);

      if (!previous || previous.status !== platformSummary.status) {
        if (platformSummary.status === "connected" || platformSummary.status === "error") {
          const statusMessage = platformSummary.status === "connected" ? "sincronizado com sucesso" : "com erro";
          await timelineRepository.add(
            orgId,
            clientId,
            {
              eventType: "integration",
              title: `Status ${PLATFORM_LABELS[platformSummary.platform]}`,
              description: `Conector ${PLATFORM_LABELS[platformSummary.platform]} está ${statusMessage}.`,
              metadata: {
                platform: platformSummary.platform,
                status: platformSummary.status
              },
              tags: ["integracao", platformSummary.platform],
              source: "client-metrics"
            },
            { id: user.uid ?? null, label: user.email ?? user.uid ?? null }
          );
        }
      }
    })
  );
}

export async function registerClientMetricsRoutes(app: FastifyInstance): Promise<void> {
  const clientsRepository = getClientsRepository();

  app.get(
    "/:id/metrics/summary",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      ensureMetricsAccess(reply, user.roles);

      const parsedQuery = metricsQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw reply.badRequest(parsedQuery.error.issues.map((issue) => issue.message).join(", "));
      }

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;
      const client = await clientsRepository.findById(orgId, id);
      if (!client) {
        throw reply.notFound("Cliente não encontrado");
      }

      const range = parsedQuery.data.range ?? "LAST_7_DAYS";

      const summary = await getCachedClientMetricsSummary(
        {
          orgId,
          clientId: client.id,
          clientName: client.name
        },
        {
          integrations: client.integrations,
          googleCustomerIds: client.googleCustomerIds,
          metaAccountIds: client.metaAccountIds,
          ga4PropertyIds: client.ga4PropertyIds
        },
        range
      );

      await recordMetricsStatus({ summary, orgId, clientId: id, clientName: client.name, user });

      return summary;
    }
  );

  app.post(
    "/:id/metrics/refresh",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      ensureMetricsAccess(reply, user.roles);

      const parsedQuery = metricsQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw reply.badRequest(parsedQuery.error.issues.map((issue) => issue.message).join(", "));
      }

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;
      const client = await clientsRepository.findById(orgId, id);
      if (!client) {
        throw reply.notFound("Cliente não encontrado");
      }

      const range = parsedQuery.data.range ?? "LAST_7_DAYS";

      const summary = await fetchClientMetricsSummary(
        {
          orgId,
          clientId: client.id,
          clientName: client.name
        },
        {
          integrations: client.integrations,
          googleCustomerIds: client.googleCustomerIds,
          metaAccountIds: client.metaAccountIds,
          ga4PropertyIds: client.ga4PropertyIds
        },
        range
      );

      await recordMetricsStatus({ summary, orgId, clientId: id, clientName: client.name, user });

      return summary;
    }
  );
}
