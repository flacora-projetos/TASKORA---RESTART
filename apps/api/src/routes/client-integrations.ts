import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getClientTimelineRepository } from "../repositories/client-timeline-repository.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getDirectoryClientsRepository } from "../repositories/directory-clients-repository.js";
import { callExternalApi } from "../services/external-clients.js";
import {
  buildPinterestAuthorizationUrl,
  createPinterestState,
  exchangePinterestCode,
  isPinterestConfigured,
  isRedirectAllowed,
  verifyPinterestState
} from "../services/pinterest-auth.js";
import type { PinterestStatePayload } from "../services/pinterest-auth.js";
import type { ClientIntegrationInfo } from "../types/clients.js";

const linkBodySchema = z.object({
  directoryClientId: z.string().min(1)
});

const pinterestStartSchema = z.object({
  redirectUri: z.string().url()
});

const pinterestCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  redirectUri: z.string().url()
});

export async function registerClientIntegrationRoutes(app: FastifyInstance): Promise<void> {
  const repo = getClientsRepository();
  const timelineRepository = getClientTimelineRepository();
  const directoryRepository = getDirectoryClientsRepository();

  app.get(
    "/:id/integrations",
    {
      preHandler: [app.authenticate, app.requireOrg(), app.requireAdmin()]
    },
    async (request, reply) => {
      const user = request.user!;
      const orgId = request.orgId!;
      const { id } = request.params as { id: string };

      const client = await repo.findById(orgId, id);
      if (!client) {
        throw reply.notFound("Cliente nao encontrado");
      }

      if (!["gestor", "analista", "suporte"].some((role) => user.roles.includes(role))) {
        throw reply.forbidden("Acesso negado");
      }

      return {
        integrations: client.integrations
      };
    }
  );

  app.post(
    "/:id/integrations/link-directory",
    {
      preHandler: [app.authenticate, app.requireOrg(), app.requireAdmin()]
    },
    async (request, reply) => {
      const user = request.user!;
      const orgId = request.orgId!;
      const { id } = request.params as { id: string };

      const client = await repo.findById(orgId, id);
      if (!client) {
        throw reply.notFound("Cliente nao encontrado");
      }

      const parsed = linkBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const directoryClientId = parsed.data.directoryClientId;
      let directoryData: Record<string, unknown> | null = null;
      const cachedEntry = await directoryRepository.findById(directoryClientId);

      if (cachedEntry) {
        directoryData =
          cachedEntry.directorySnapshot ?? ({
            id: cachedEntry.id,
            clientName: cachedEntry.name,
            googleCustomerIds: cachedEntry.googleCustomerIds,
            metaAccountIds: cachedEntry.metaAccountIds,
            ga4PropertyIds: cachedEntry.ga4PropertyIds
          } as Record<string, unknown>);
      }

      if (!directoryData) {
        try {
          directoryData = (await callExternalApi({
            path: `/directory/clients/${directoryClientId}`
          })) as Record<string, unknown>;
        } catch (error) {
          request.log.error({ err: error }, "Failed to fetch directory client");
          throw reply.badGateway("Erro ao buscar cliente no diretorio externo");
        }
      }

      const googleIds =
        cachedEntry?.googleCustomerIds?.length
          ? cachedEntry.googleCustomerIds
          : extractIds(directoryData, ["googleCustomerIds", "googleCustomerId"]);
      const metaIds =
        cachedEntry?.metaAccountIds?.length
          ? cachedEntry.metaAccountIds
          : extractIds(directoryData, ["metaAccountIds", "metaAccountId"]);
      const ga4Ids =
        cachedEntry?.ga4PropertyIds?.length
          ? cachedEntry.ga4PropertyIds
          : extractIds(directoryData, ["ga4PropertyIds", "ga4PropertyId", "gaPropertyIds"]);

      const now = new Date().toISOString();
      const integrationInfo: ClientIntegrationInfo = {
        ...(client.integrations ?? { syncedAt: now }),
        directoryId: directoryClientId,
        directorySnapshot: directoryData,
        syncedAt: now
      };

      const mergedGoogle = mergeIdentifiers(client.googleCustomerIds, googleIds);
      const mergedMeta = mergeIdentifiers(client.metaAccountIds, metaIds);
      const mergedGa4 = mergeIdentifiers(client.ga4PropertyIds, ga4Ids);

      if (mergedGoogle) {
        integrationInfo.googleCustomerIds = mergedGoogle;
      }
      if (mergedMeta) {
        integrationInfo.metaAccountIds = mergedMeta;
      }
      if (mergedGa4) {
        integrationInfo.ga4PropertyIds = mergedGa4;
      }

      const updated = await repo.updateIntegrations(orgId, id, integrationInfo, user.uid);
      await timelineRepository.add(
        orgId,
        id,
        {
          eventType: "integration",
          title: "Diretorio vinculado",
          description: `Cliente vinculado ao registro ${integrationInfo.directoryId ?? ""}.`,
          metadata: {
            directoryId: integrationInfo.directoryId,
            googleCustomerIds: integrationInfo.googleCustomerIds ?? [],
            metaAccountIds: integrationInfo.metaAccountIds ?? [],
            ga4PropertyIds: integrationInfo.ga4PropertyIds ?? []
          },
          tags: ["diretorio", "integracao"],
          source: "client-integrations"
        },
        { id: user.uid ?? null, label: user.email ?? user.uid ?? null }
      );
      return {
        integrations: updated.integrations
      };
    }
  );

  app.post(
    "/:id/integrations/pinterest/start",
    {
      preHandler: [app.authenticate, app.requireOrg(), app.requireAdmin()]
    },
    async (request, reply) => {
      const user = request.user!;
      const orgId = request.orgId!;
      const { id } = request.params as { id: string };

      if (!isPinterestConfigured()) {
        request.log.error("Pinterest OAuth nao configurado");
        throw reply.internalServerError("Pinterest OAuth nao esta configurado no ambiente atual.");
      }

      const client = await repo.findById(orgId, id);
      if (!client) {
        throw reply.notFound("Cliente nao encontrado");
      }

      const parsed = pinterestStartSchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const redirectUri = parsed.data.redirectUri;
      if (!isRedirectAllowed(redirectUri)) {
        throw reply.badRequest("Redirect URI nao autorizado para Pinterest");
      }

      const { state, payload } = createPinterestState({
        orgId,
        clientId: id,
        userId: user.uid ?? null,
        redirectUri
      });

      const authorizationUrl = buildPinterestAuthorizationUrl(redirectUri, state);
      return {
        authorizationUrl,
        state,
        expiresAt: new Date(payload.exp).toISOString()
      };
    }
  );

  app.post(
    "/integrations/pinterest/callback",
    {
      preHandler: [app.authenticate, app.requireOrg(), app.requireAdmin()]
    },
    async (request, reply) => {
      const user = request.user!;
      const orgId = request.orgId!;

      if (!isPinterestConfigured()) {
        request.log.error("Pinterest OAuth nao configurado");
        throw reply.internalServerError("Pinterest OAuth nao esta configurado no ambiente atual.");
      }

      const parsed = pinterestCallbackSchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const { code, state, redirectUri } = parsed.data;
      if (!isRedirectAllowed(redirectUri)) {
        throw reply.badRequest("Redirect URI nao autorizado para Pinterest");
      }

      let statePayload: PinterestStatePayload;
      try {
        statePayload = verifyPinterestState(state);
      } catch (error) {
        request.log.warn({ err: error }, "Invalid Pinterest state");
        throw reply.badRequest("State de autorizacao invalido ou expirado");
      }

      if (statePayload.orgId !== orgId) {
        throw reply.badRequest("State nao corresponde ao tenant atual");
      }

      if (statePayload.redirectUri !== redirectUri) {
        throw reply.badRequest("Redirect URI divergente do state original");
      }

      const client = await repo.findById(orgId, statePayload.clientId);
      if (!client) {
        throw reply.notFound("Cliente nao encontrado");
      }

      let tokenResponse;
      try {
        tokenResponse = await exchangePinterestCode({ code, redirectUri });
      } catch (error) {
        request.log.error({ err: error }, "Pinterest token exchange failed");
        throw reply.badGateway("Nao foi possivel autorizar a conta do Pinterest");
      }

      const now = new Date().toISOString();
      const baseIntegrations: ClientIntegrationInfo = client.integrations ?? { syncedAt: now };
      const integrationInfo: ClientIntegrationInfo = {
        ...baseIntegrations,
        syncedAt: baseIntegrations.syncedAt ?? now,
        pinterest: {
          accessToken: tokenResponse.accessToken,
          refreshToken: tokenResponse.refreshToken,
          tokenType: tokenResponse.tokenType,
          scope: tokenResponse.scope,
          expiresAt: tokenResponse.expiresAt,
          refreshTokenExpiresAt: tokenResponse.refreshTokenExpiresAt,
          linkedAt: now
        }
      };

      const updated = await repo.updateIntegrations(orgId, statePayload.clientId, integrationInfo, user.uid ?? "unknown");
      await timelineRepository.add(
        orgId,
        statePayload.clientId,
        {
          eventType: "integration",
          title: "Pinterest conectado",
          description: "Conta Pinterest autorizada para sincronizar metricas.",
          metadata: {
            integration: "pinterest",
            scope: tokenResponse.scope,
            expiresAt: tokenResponse.expiresAt
          },
          tags: ["integracao", "pinterest"],
          source: "client-integrations"
        },
        { id: user.uid ?? null, label: user.email ?? user.uid ?? null }
      );

      return {
        integrations: updated.integrations
      };
    }
  );
}

function mergeIdentifiers(current: string[], incoming: string[]): string[] | undefined {
  if (!incoming || incoming.length === 0) {
    return undefined;
  }
  const base = Array.isArray(current) ? current : [];
  return Array.from(
    new Set(
      [...base, ...incoming].filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    )
  );
}

function extractIds(source: Record<string, unknown>, keys: string[]): string[] {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) {
      return [value];
    }
    if (Array.isArray(value)) {
      return value.filter((item) => typeof item === "string") as string[];
    }
  }
  return [];
}
