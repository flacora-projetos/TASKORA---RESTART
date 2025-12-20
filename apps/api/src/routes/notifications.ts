import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getFirestoreDb, firestoreConfigured } from "../firebase.js";
import { env } from "../env.js";
import { emitOrgNotification, sendDailyDigests } from "../services/notifications.js";

const pushSubscriptionSchema = z.object({
  token: z.string().min(10),
  platform: z.string().max(120).optional(),
  userAgent: z.string().max(512).optional()
});

const pushLogSchema = z.object({
  message: z.string().min(3),
  stage: z.string().max(120).optional(),
  detail: z.any().optional(),
  platform: z.string().max(120).optional(),
  userAgent: z.string().max(512).optional()
});

export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  if (!firestoreConfigured) {
    app.log.warn("Firestore not configured; push subscription routes disabled.");
    return;
  }

  const db = getFirestoreDb();
  const collection = db?.collection("push_subscriptions");
  const logsCollection = db?.collection("push_logs");

  app.post(
    "/notifications/push",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      if (!collection) {
        throw reply.internalServerError("Firestore not initialized");
      }

      const body = pushSubscriptionSchema.parse(request.body);
      const now = new Date().toISOString();
      const docId = Buffer.from(body.token).toString("base64url");

      const existing = await collection.doc(docId).get();
      const payload = {
        token: body.token,
        platform: body.platform ?? "web",
        userAgent: body.userAgent ?? null,
        userId: request.user?.uid ?? null,
        orgId: request.orgId ?? null,
        lastSeenAt: now,
        updatedAt: now,
        createdAt: existing.exists ? existing.get("createdAt") ?? now : now,
        disabledAt: null
      };

      await collection.doc(docId).set(payload);

      return { ok: true, token: body.token };
    }
  );

  app.get(
    "/notifications/push/status",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      if (!collection) {
        throw reply.internalServerError("Firestore not initialized");
      }
      const userId = request.user?.uid ?? null;
      const orgId = request.orgId ?? null;
      if (!userId || !orgId) {
        throw reply.badRequest("User/org ausentes");
      }
      const snapshot = await collection.where("userId", "==", userId).where("orgId", "==", orgId).get();
      const items = snapshot.docs
        .map((doc) => doc.data())
        .filter(Boolean)
        .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")));
      const latest = items[0] ?? null;
      return {
        latest: latest
          ? {
              token: latest.token ?? null,
              updatedAt: latest.updatedAt ?? latest.lastSeenAt ?? null,
              platform: latest.platform ?? null
            }
          : null,
        count: items.length
      };
    }
  );

  app.delete(
    "/notifications/push",
    {
      preHandler: [app.authenticate]
    },
    async (request, reply) => {
      if (!collection) {
        throw reply.internalServerError("Firestore not initialized");
      }
      const body = pushSubscriptionSchema.pick({ token: true }).parse(request.body);
      const docId = Buffer.from(body.token).toString("base64url");
      await collection.doc(docId).delete();
      return { ok: true };
    }
  );

  app.post(
    "/notifications/push/log",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      if (!logsCollection) {
        throw reply.internalServerError("Firestore not initialized");
      }
      const body = pushLogSchema.parse(request.body);
      const now = new Date().toISOString();
      await logsCollection.add({
        ...body,
        userId: request.user?.uid ?? null,
        orgId: request.orgId ?? null,
        createdAt: now
      });
      return { ok: true };
    }
  );

  app.post("/notifications/digest/run", async (request, reply) => {
    const headerSecret = request.headers["x-cron-secret"];
    if (env.NOTIFICATIONS_CRON_SECRET && headerSecret !== env.NOTIFICATIONS_CRON_SECRET) {
      throw reply.forbidden("Invalid cron secret");
    }

    const result = await sendDailyDigests(request.log);
    return { ok: true, ...result };
  });

  app.post(
    "/notifications/test",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request) => {
      const user = request.user!;
      const orgId = request.orgId!;
      await emitOrgNotification(
        {
          orgId,
          title: "Teste de push",
          body: "Se voce recebeu, o push esta ativo.",
          eventType: "push_test",
          actorId: user.uid ?? null,
          actorName: user.email ?? null
        },
        { logger: request.log }
      );
      return { ok: true };
    }
  );
}
