import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getInsightsRepository } from "../repositories/insights-repository.js";
import type { FeedbackStatus, FeedbackType } from "../types/insights.js";
import { emitOrgNotification } from "../services/notifications.js";

const feedbackCreateSchema = z.object({
  type: z.enum(["bug", "melhoria", "ideia"]),
  title: z.string().min(2),
  description: z.string().min(2),
  imageUrl: z.string().url().max(2048).optional().nullable()
});

const feedbackUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().min(2).optional(),
  status: z.enum(["aberto", "em_analise", "em_desenvolvimento", "entregue"]).optional(),
  imageUrl: z.string().url().max(2048).optional().nullable()
});

const insightCreateSchema = z.object({
  text: z.string().min(2),
  imageUrl: z.string().url().max(2048).optional().nullable(),
  clientId: z.string().min(1).optional().nullable(),
  projectId: z.string().min(1).optional().nullable(),
  taskId: z.string().min(1).optional().nullable()
});

const insightUpdateSchema = insightCreateSchema.partial().refine(
  (data) => data.text !== undefined || data.imageUrl !== undefined || data.clientId !== undefined || data.projectId !== undefined || data.taskId !== undefined,
  { message: "Nenhum campo para atualizar" }
);

const commentCreateSchema = z.object({
  text: z.string().min(1)
});

function actorLabel(user: { email?: string | null; uid?: string | null }): string {
  return user.email ?? user.uid ?? "Alguem";
}

export async function registerInsightsRoutes(app: FastifyInstance): Promise<void> {
  const repository = getInsightsRepository();

  app.addHook("preHandler", app.authenticate);
  app.addHook("preHandler", app.requireOrg());

  app.get("/insights/feedback", async (request) => {
    const querySchema = z.object({
      type: z.enum(["bug", "melhoria", "ideia"]).optional(),
      status: z.enum(["aberto", "em_analise", "em_desenvolvimento", "entregue"]).optional(),
      limit: z.coerce.number().optional()
    });
    const query = querySchema.parse(request.query);
    return repository.listFeedback(request.orgId!, {
      type: query.type as FeedbackType | undefined,
      status: query.status as FeedbackStatus | undefined,
      limit: query.limit
    });
  });

  app.post("/insights/feedback", async (request) => {
    const body = feedbackCreateSchema.parse(request.body ?? {});
    const record = await repository.createFeedback(request.orgId!, body, request.user!.uid);
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: `Novo feedback (${record.type})`,
        body: `${actorLabel(request.user!)}: ${record.title}`,
        eventType: "insight_created",
        entityId: record.id,
        entityType: "feedback",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null
      },
      { logger: request.log }
    );
    return record;
  });

  app.patch("/insights/feedback/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = feedbackUpdateSchema.parse(request.body ?? {});
    const current = await repository.findFeedbackById(request.orgId!, params.id);
    if (!current || current.authorId !== request.user!.uid) {
      throw app.httpErrors.forbidden("Apenas o autor pode editar este feedback.");
    }
    const updated = await repository.updateFeedback(request.orgId!, params.id, body, request.user!.uid);
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: `Feedback atualizado: ${updated.title}`,
        body: `${actorLabel(request.user!)} ajustou status/descricao`,
        eventType: "insight_updated",
        entityId: updated.id,
        entityType: "feedback",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null,
        data: {
          status: updated.status
        }
      },
      { logger: request.log }
    );
    return updated;
  });

  app.delete("/insights/feedback/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const current = await repository.findFeedbackById(request.orgId!, params.id);
    if (!current || current.authorId !== request.user!.uid) {
      throw app.httpErrors.forbidden("Apenas o autor pode excluir este feedback.");
    }
    await repository.deleteFeedback(request.orgId!, params.id, request.user!.uid);
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: "Feedback removido",
        body: `${actorLabel(request.user!)} excluiu ${current.title}`,
        eventType: "insight_deleted",
        entityId: params.id,
        entityType: "feedback",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null
      },
      { logger: request.log }
    );
    return { ok: true };
  });

  app.post("/insights/feedback/:id/vote", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const result = await repository.toggleVote(request.orgId!, params.id, request.user!.uid);
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: result.voted ? "Voto adicionado" : "Voto removido",
        body: `${actorLabel(request.user!)} ${result.voted ? "votou" : "removeu voto"} em um feedback`,
        eventType: "insight_voted",
        entityId: params.id,
        entityType: "feedback",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null
      },
      { logger: request.log }
    );
    return result;
  });

  app.get("/insights/feedback/:id/comments", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().optional() }).parse(request.query);
    return repository.listComments(request.orgId!, "feedback", params.id, query.limit);
  });

  app.post("/insights/feedback/:id/comments", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = commentCreateSchema.parse(request.body ?? {});
    const comment = await repository.addComment(request.orgId!, "feedback", params.id, body.text, request.user!.uid);
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: "Novo comentario em feedback",
        body: `${actorLabel(request.user!)} comentou: ${body.text}`,
        eventType: "insight_commented",
        entityId: params.id,
        entityType: "feedback",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null
      },
      { logger: request.log }
    );
    return comment;
  });

  app.get("/insights/posts", async (request) => {
    const querySchema = z.object({
      clientId: z.string().min(1).optional(),
      projectId: z.string().min(1).optional(),
      taskId: z.string().min(1).optional(),
      authorId: z.string().min(1).optional(),
      limit: z.coerce.number().optional()
    });
    const query = querySchema.parse(request.query);
    return repository.listInsights(request.orgId!, {
      clientId: query.clientId,
      projectId: query.projectId,
      taskId: query.taskId,
      authorId: query.authorId,
      limit: query.limit
    });
  });

  app.post("/insights/posts", async (request) => {
    const body = insightCreateSchema.parse(request.body ?? {});
    const hasRelation = body.clientId || body.projectId || body.taskId;
    if (!hasRelation) {
      throw app.httpErrors.badRequest("Informe pelo menos cliente, projeto ou tarefa");
    }
    const record = await repository.createInsight(request.orgId!, body, request.user!.uid);
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: "Novo insight publicado",
        body: `${actorLabel(request.user!)} adicionou um insight`,
        eventType: "insight_created",
        entityId: record.id,
        entityType: "insight",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null,
        data: {
          projectId: body.projectId ?? "",
          clientId: body.clientId ?? "",
          taskId: body.taskId ?? ""
        }
      },
      { logger: request.log }
    );
    return record;
  });

  app.patch("/insights/posts/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = insightUpdateSchema.parse(request.body ?? {});
    const current = await repository.findInsightById(request.orgId!, params.id);
    if (!current || current.authorId !== request.user!.uid) {
      throw app.httpErrors.forbidden("Apenas o autor pode editar este insight.");
    }
    const updated = await repository.updateInsight(request.orgId!, params.id, body, request.user!.uid);
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: "Insight atualizado",
        body: `${actorLabel(request.user!)} editou um insight`,
        eventType: "insight_updated",
        entityId: updated.id,
        entityType: "insight",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null
      },
      { logger: request.log }
    );
    return updated;
  });

  app.delete("/insights/posts/:id", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const current = await repository.findInsightById(request.orgId!, params.id);
    if (!current || current.authorId !== request.user!.uid) {
      throw app.httpErrors.forbidden("Apenas o autor pode excluir este insight.");
    }
    await repository.deleteInsight(request.orgId!, params.id, request.user!.uid);
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: "Insight removido",
        body: `${actorLabel(request.user!)} excluiu um insight`,
        eventType: "insight_deleted",
        entityId: params.id,
        entityType: "insight",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null
      },
      { logger: request.log }
    );
    return { ok: true };
  });

  app.get("/insights/posts/:id/comments", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const query = z.object({ limit: z.coerce.number().optional() }).parse(request.query);
    return repository.listComments(request.orgId!, "insight", params.id, query.limit);
  });

  app.post("/insights/posts/:id/comments", async (request) => {
    const params = z.object({ id: z.string().min(1) }).parse(request.params);
    const body = commentCreateSchema.parse(request.body ?? {});
    const comment = await repository.addComment(
      request.orgId!,
      "insight",
      params.id,
      body.text,
      request.user!.uid
    );
    void emitOrgNotification(
      {
        orgId: request.orgId!,
        title: "Novo comentario em insight",
        body: `${actorLabel(request.user!)} comentou: ${body.text}`,
        eventType: "insight_commented",
        entityId: params.id,
        entityType: "insight",
        actorId: request.user!.uid ?? null,
        actorName: request.user!.email ?? null
      },
      { logger: request.log }
    );
    return comment;
  });
}
