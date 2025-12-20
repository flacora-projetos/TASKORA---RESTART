import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { getClientsRepository } from "../repositories/clients-repository.js";
import { getClientMetricsStatusRepository } from "../repositories/client-metrics-status-repository.js";
import { getDirectoryClientsRepository } from "../repositories/directory-clients-repository.js";
import type { PlatformKey, PlatformSummary } from "../services/client-metrics.js";
import type { ClientEntity, ClientStatus } from "../types/clients.js";
import { emitOrgNotification } from "../services/notifications.js";

const clientsRepository = getClientsRepository();
const directoryRepository = getDirectoryClientsRepository();
const metricsStatusRepository = getClientMetricsStatusRepository();

const identifiersArraySchema = z
  .array(
    z
      .string()
      .min(1)
      .max(64)
      .transform((value) => value.trim()),
  )
  .max(20)
  .optional();

const clientBodySchema = z.object({
  name: z.string().min(1),
  segment: z.string().min(1).nullable().optional(),
  monthlyBudget: z.coerce.number().positive().nullable().optional(),
  platforms: z
    .array(z.enum(["google", "meta", "pinterest", "tiktok", "other"]))
    .max(6)
    .optional(),
  driveLink: z.string().url().nullable().optional(),
  whatsappGroup: z.string().url().nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
  googleCustomerIds: identifiersArraySchema,
  metaAccountIds: identifiersArraySchema,
  ga4PropertyIds: identifiersArraySchema,
  pinterestAccountIds: identifiersArraySchema,
  responsibleId: z.string().min(1).max(200).nullable().optional(),
});

const clientUpdateSchema = clientBodySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "É necessário informar pelo menos um campo para atualizar",
  },
);

const listQuerySchema = z.object({
  status: z.enum(["active", "archived"]).optional(),
  q: z.string().optional(),
  responsibleId: z.string().min(1).optional(),
});

function actorLabel(user: { email?: string | null; uid?: string | null }): string {
  return user.email ?? user.uid ?? "Alguem";
}

function hasRole(userRoles: string[], allowed: string[]): boolean {
  return allowed.some((role) => userRoles.includes(role));
}

function ensureRoleOrThrow(reply: FastifyReply, userRoles: string[], allowed: string[]) {
  if (!hasRole(userRoles, allowed)) {
    throw reply.forbidden("Insufficient role");
  }
}

export async function registerClientRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/",
    {
      preHandler: [app.authenticate, app.requireOrg()],
    },
    async (request, reply) => {
      const user = request.user!;
      ensureRoleOrThrow(reply, user.roles, ["gestor", "analista", "suporte"]);

      const parsedQuery = listQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw reply.badRequest(parsedQuery.error.issues.map((item) => item.message).join(", "));
      }

      const orgId = request.orgId!;
      const items = await clientsRepository.list(orgId, {
        status: parsedQuery.data.status as ClientStatus | undefined,
        query: parsedQuery.data.q,
        responsibleId: parsedQuery.data.responsibleId,
      });

      return { items };
    },
  );

  app.get(
    "/summary",
    {
      preHandler: [app.authenticate, app.requireOrg()],
    },
    async (request, reply) => {
      const user = request.user!;
      ensureRoleOrThrow(reply, user.roles, ["gestor", "analista", "suporte"]);

      const orgId = request.orgId!;
      const [clients, directoryStats, metricsStatuses] = await Promise.all([
        clientsRepository.list(orgId),
        directoryRepository.getStats(),
        metricsStatusRepository.listByOrg(orgId),
      ]);

      const activeClients = clients.filter((client) => client.status === "active");
      const archivedClients = clients.filter((client) => client.status === "archived");
      const hasIdentifiers = (client: ClientEntity) =>
        client.googleCustomerIds.length > 0 ||
        client.metaAccountIds.length > 0 ||
        client.ga4PropertyIds.length > 0 ||
        client.pinterestAccountIds.length > 0;

      const clientsWithIds = activeClients.filter((client) => hasIdentifiers(client));
      const clientsWithoutIds = activeClients.filter((client) => !hasIdentifiers(client));

      const directoryLinked = new Set(
        activeClients
          .map((client) => client.integrations?.directoryId)
          .filter((id): id is string => Boolean(id)),
      );
      const contactsTotal = directoryStats.total ?? 0;
      const leadsPending = Math.max(contactsTotal - directoryLinked.size, 0);

      const statusByClient = new Map<
        string,
        Array<{ platform: PlatformKey; status: PlatformSummary["status"]; updatedAt: string }>
      >();
      const connectedClients = new Set<string>();

      metricsStatuses.forEach((status) => {
        const list =
          statusByClient.get(status.clientId) ??
          [];
        list.push({
          platform: status.platform,
          status: status.status,
          updatedAt: status.updatedAt,
        });
        statusByClient.set(status.clientId, list);
        if (status.status === "connected") {
          connectedClients.add(status.clientId);
        }
      });

      const missingIdsHighlights = clientsWithoutIds.slice(0, 5).map((client) => ({
        id: client.id,
        name: client.name,
        missing: [
          ...(client.googleCustomerIds.length === 0 ? ["google"] : []),
          ...(client.metaAccountIds.length === 0 ? ["meta"] : []),
          ...(client.ga4PropertyIds.length === 0 ? ["ga4"] : []),
        ],
      }));

      const missingMetricsHighlights = activeClients
        .filter((client) => hasIdentifiers(client))
        .filter((client) => !connectedClients.has(client.id))
        .slice(0, 5)
        .map((client) => ({
          id: client.id,
          name: client.name,
          statuses: statusByClient.get(client.id) ?? [],
        }));

      const pipeline = [
        {
          id: "contact",
          label: "Contato",
          count: contactsTotal,
          helper:
            leadsPending > 0
              ? `${leadsPending} aguardam cadastro`
              : "Todos importados do MCP",
        },
        {
          id: "cadastro",
          label: "Cadastro",
          count: activeClients.length,
          helper: `${archivedClients.length} arquivados`,
        },
        {
          id: "ids",
          label: "IDs conectados",
          count: clientsWithIds.length,
          helper: `${clientsWithoutIds.length} pendentes`,
        },
        {
          id: "metrics",
          label: "Metricas",
          count: connectedClients.size,
          helper: `${Math.max(clientsWithIds.length - connectedClients.size, 0)} aguardam sync`,
        },
      ];

      return {
        totals: {
          contacts: contactsTotal,
          leadsPending,
          active: activeClients.length,
          archived: archivedClients.length,
          withIds: clientsWithIds.length,
          withoutIds: clientsWithoutIds.length,
          withMetrics: connectedClients.size,
          withoutMetrics: Math.max(clientsWithIds.length - connectedClients.size, 0),
        },
        pipeline,
        highlights: {
          missingIds: missingIdsHighlights,
          missingMetrics: missingMetricsHighlights,
        },
        metadata: {
          directoryLastSync: directoryStats.lastSyncedAt,
        },
      };
    },
  );

  app.get(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireOrg()],
    },
    async (request, reply) => {
      const user = request.user!;
      ensureRoleOrThrow(reply, user.roles, ["gestor", "analista", "suporte"]);

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;
      const client = await clientsRepository.findById(orgId, id);
      if (!client) {
        throw reply.notFound("Cliente não encontrado");
      }
      return client;
    },
  );

  app.post(
    "/",
    {
      preHandler: [app.authenticate, app.requireOrg()],
    },
    async (request, reply) => {
      const user = request.user!;
      ensureRoleOrThrow(reply, user.roles, ["gestor"]);

      const parsed = clientBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((item) => item.message).join(", "));
      }

      const orgId = request.orgId!;
      const record = await clientsRepository.create(orgId, parsed.data, user.uid);
      void emitOrgNotification(
        {
          orgId,
          title: `Novo cliente: ${record.name}`,
          body: `${actorLabel(user)} criou o cliente`,
          eventType: "client_created",
          entityId: record.id,
          entityType: "client",
          actorId: user.uid ?? null,
          actorName: user.email ?? null
        },
        { logger: request.log }
      );
      return reply.code(201).send(record);
    },
  );

  app.put(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireOrg()],
    },
    async (request, reply) => {
      const user = request.user!;
      ensureRoleOrThrow(reply, user.roles, ["gestor", "analista"]);

      const parsedBody = clientUpdateSchema.safeParse(request.body);
      if (!parsedBody.success) {
        throw reply.badRequest(parsedBody.error.issues.map((item) => item.message).join(", "));
      }

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;

      try {
        const updated = await clientsRepository.update(orgId, id, parsedBody.data, user.uid);
        void emitOrgNotification(
          {
            orgId,
            title: `Cliente atualizado: ${updated.name}`,
            body: `${actorLabel(user)} editou dados do cliente`,
            eventType: "client_updated",
            entityId: updated.id,
            entityType: "client",
            actorId: user.uid ?? null,
            actorName: user.email ?? null
          },
          { logger: request.log }
        );
        return updated;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to update client");
        throw reply.notFound("Cliente não encontrado");
      }
    },
  );

  app.delete(
    "/:id",
    {
      preHandler: [app.authenticate, app.requireOrg()],
    },
    async (request, reply) => {
      const user = request.user!;
      ensureRoleOrThrow(reply, user.roles, ["gestor"]);

      const { id } = request.params as { id: string };
      const orgId = request.orgId!;

      try {
        const archived = await clientsRepository.archive(orgId, id, user.uid);
        void emitOrgNotification(
          {
            orgId,
            title: `Cliente arquivado: ${archived.name}`,
            body: `${actorLabel(user)} arquivou o cliente`,
            eventType: "client_archived",
            entityId: archived.id,
            entityType: "client",
            actorId: user.uid ?? null,
            actorName: user.email ?? null
          },
          { logger: request.log }
        );
        return archived;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to archive client");
        throw reply.notFound("Cliente não encontrado");
      }
    },
  );
}
