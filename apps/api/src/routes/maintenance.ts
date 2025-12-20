import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { syncDirectoryClients } from "../services/directory-sync.js";
import { syncMetricsCacheForOrg } from "../services/metrics-sync.js";

const JOB_DEFINITIONS = [
  {
    id: "directory-cache-sync",
    label: "Sincronizacao do diretorio",
    description: "Atualiza o cache interno com os clientes do diretorio legado."
  },
  {
    id: "metrics-sync",
    label: "Atualizacao do cache de metricas",
    description: "Recalcula Google/Meta/GA4 para cada cliente."
  },
  {
    id: "ga4-properties-sync",
    label: "GA4 properties sync",
    description: "Busca as propriedades GA4 liberadas no MCP."
  }
] as const;

type JobStatus = {
  jobId: string;
  status: "success" | "warning" | "error" | "pending";
  lastRunAt: string | null;
  message?: string | null;
};

function parseJobsStatusFromEnv(): Record<string, JobStatus> {
  const source = process.env.TASKORA_JOBS_STATUS;
  if (!source) {
    return {};
  }
  try {
    const parsed = JSON.parse(source);
    if (Array.isArray(parsed)) {
      return Object.fromEntries(
        parsed
          .map((item) => {
            if (item && typeof item === "object" && typeof item.jobId === "string") {
              return [
                item.jobId,
                {
                  jobId: item.jobId,
                  status: item.status ?? "pending",
                  lastRunAt: item.lastRunAt ?? null,
                  message: item.message ?? null
                } as JobStatus
              ];
            }
            return null;
          })
          .filter(Boolean) as Array<[string, JobStatus]>
      );
    }
  } catch {
    // ignore parse errors
  }
  return {};
}

const syncBodySchema = z.object({
  batchSize: z.number().int().min(1).max(200).optional(),
  maxEntries: z.number().int().min(1).max(5000).optional()
});

const metricsSyncBodySchema = z.object({
  ranges: z
    .array(z.enum(["LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"]))
    .min(1)
    .max(4)
    .optional()
});

export async function registerMaintenanceRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/maintenance/integrations/directory/sync",
    {
      preHandler: [app.authenticate, app.requireRoles(["gestor"])]
    },
    async (request, reply) => {
      const orgId = request.orgId;
      if (!orgId) {
        throw reply.badRequest("orgId is required");
      }

      const parsed = syncBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const body = parsed.data;
      const result = await syncDirectoryClients({
        orgId,
        actorId: request.user!.uid,
        batchSize: body.batchSize,
        maxEntries: body.maxEntries,
        logger: {
          log: request.log.info.bind(request.log),
          warn: request.log.warn.bind(request.log),
          error: request.log.error.bind(request.log)
        }
      });

      return {
        ok: true,
        ...result
      };
    }
  );

  app.post(
    "/maintenance/metrics/sync",
    {
      preHandler: [app.authenticate, app.requireOrg(), app.requireRoles(["gestor"])]
    },
    async (request, reply) => {
      const orgId = request.orgId;
      if (!orgId) {
        throw reply.badRequest("orgId is required");
      }

      const parsed = metricsSyncBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const result = await syncMetricsCacheForOrg({
        orgId,
        ranges: parsed.data.ranges,
        logger: request.log
      });

      return {
        ok: true,
        ...result
      };
    }
  );

  app.get(
    "/maintenance/jobs/status",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const mocked = parseJobsStatusFromEnv();
      const jobs = JOB_DEFINITIONS.map((definition) => {
        const status = mocked[definition.id];
        return {
          id: definition.id,
          label: definition.label,
          description: definition.description,
          status: status?.status ?? "pending",
          lastRunAt: status?.lastRunAt ?? null,
          message: status?.message ?? "Sem registros no ambiente atual."
        };
      });

      return { jobs };
    }
  );
}
