import admin from "firebase-admin";
import type { FastifyBaseLogger } from "fastify";

import { firestoreConfigured, getFirebaseMessaging, getFirestoreDb } from "../firebase.js";

type NotificationEventType =
  | "task_created"
  | "task_updated"
  | "task_status_changed"
  | "task_assignees_changed"
  | "task_due_changed"
  | "task_archived"
  | "time_entry_created"
  | "time_entry_updated"
  | "time_entry_deleted"
  | "insight_created"
  | "insight_commented"
  | "insight_updated"
  | "insight_voted"
  | "insight_deleted"
  | "project_created"
  | "project_updated"
  | "project_archived"
  | "client_created"
  | "client_updated"
  | "client_archived"
  | "digest";

export type NotificationEventInput = {
  orgId: string;
  title: string;
  body: string;
  eventType: NotificationEventType;
  entityId?: string | null;
  entityType?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  data?: Record<string, string | number | boolean | null | undefined>;
};

type PushResult = {
  attempted: number;
  sent: number;
  failed: number;
  invalidated: number;
};

type EmitOptions = {
  logger?: FastifyBaseLogger;
  skipPush?: boolean;
  skipStore?: boolean;
};

type PushSubscriptionRecord = {
  token: string;
  orgId: string | null;
  userId?: string | null;
  disabledAt?: string | null;
};

const MAX_FCM_TOKENS_PER_BATCH = 500;
const ALLOWED_PUSH_EVENTS: NotificationEventType[] = [
  "task_created",
  "task_status_changed",
  "project_created",
  "project_archived"
];

function shouldSendPush(event: NotificationEventInput): boolean {
  if (event.eventType === "push_test") {
    return true;
  }
  if (!ALLOWED_PUSH_EVENTS.includes(event.eventType)) {
    return false;
  }
  if (event.eventType === "task_status_changed") {
    const toStatus = event.data?.toStatus ?? event.data?.status ?? event.data?.to;
    if (!toStatus) {
      return false;
    }
    const normalized = String(toStatus).toLowerCase();
    return ["done", "concluida", "concluido"].includes(normalized);
  }
  return true;
}

function toDateKey(date: Date): string {
  // Ajusta para BRT (UTC-3) para digest diário ficar alinhado ao horário do time.
  const offsetMs = 3 * 60 * 60 * 1000;
  const local = new Date(date.getTime() - offsetMs);
  const year = local.getUTCFullYear();
  const month = String(local.getUTCMonth() + 1).padStart(2, "0");
  const day = String(local.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function chunkTokens(tokens: string[], size = MAX_FCM_TOKENS_PER_BATCH): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < tokens.length; i += size) {
    chunks.push(tokens.slice(i, i + size));
  }
  return chunks;
}

function normalizeData(data?: Record<string, string | number | boolean | null | undefined>): Record<string, string> {
  if (!data) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, value === null ? "" : String(value)])
  );
}

async function fetchOrgTokens(orgId: string, logger?: FastifyBaseLogger): Promise<string[]> {
  if (!firestoreConfigured) {
    return [];
  }
  const db = getFirestoreDb();
  if (!db) {
    return [];
  }

  try {
    const snapshot = await db.collection("push_subscriptions").where("orgId", "==", orgId).get();
    const tokens: string[] = [];
    snapshot.docs.forEach((doc) => {
      const record = doc.data() as PushSubscriptionRecord | undefined;
      if (!record?.token || record.disabledAt) {
        return;
      }
      tokens.push(record.token);
    });
    return tokens;
  } catch (error) {
    logger?.error({ err: error, orgId }, "Failed to load push tokens");
    return [];
  }
}

async function disableTokens(tokens: string[], logger?: FastifyBaseLogger): Promise<void> {
  if (!firestoreConfigured || tokens.length === 0) {
    return;
  }
  const db = getFirestoreDb();
  if (!db) {
    return;
  }
  const now = new Date().toISOString();

  const tasks = tokens.map((token) => {
    const docId = Buffer.from(token).toString("base64url");
    return db.collection("push_subscriptions").doc(docId).set(
      {
        disabledAt: now,
        updatedAt: now
      },
      { merge: true }
    );
  });

  try {
    await Promise.all(tasks);
  } catch (error) {
    logger?.warn({ err: error }, "Failed to disable invalid tokens");
  }
}

export async function sendPushToOrg(
  event: NotificationEventInput,
  logger?: FastifyBaseLogger
): Promise<PushResult> {
  if (!shouldSendPush(event)) {
    return { attempted: 0, sent: 0, failed: 0, invalidated: 0 };
  }

  const tokens = await fetchOrgTokens(event.orgId, logger);
  const messaging = getFirebaseMessaging();

  if (!messaging || tokens.length === 0) {
    return { attempted: tokens.length, sent: 0, failed: tokens.length, invalidated: 0 };
  }

  const data = normalizeData({
    ...event.data,
    eventType: event.eventType,
    entityId: event.entityId,
    entityType: event.entityType
  });

  let sent = 0;
  let failed = 0;
  let invalidated = 0;

  const batches = chunkTokens(tokens);
  for (const batch of batches) {
    const response = await messaging
      .sendEachForMulticast({
        tokens: batch,
        notification: {
          title: event.title,
          body: event.body
        },
        data
      })
      .catch((err) => {
        logger?.warn({ err }, "push send failed for batch");
        failed += batch.length;
        return null;
      });

    if (!response) {
      continue;
    }

    response.responses.forEach((res, index) => {
      if (res.success) {
        sent += 1;
        return;
      }
      failed += 1;
      const errorCode = res.error?.code;
      if (
        errorCode === "messaging/registration-token-not-registered" ||
        errorCode === "messaging/invalid-registration-token"
      ) {
        invalidated += 1;
        const token = batch[index];
        if (token) {
          void disableTokens([token], logger);
        }
      }
    });
  }

  logger?.info(
    {
      orgId: event.orgId,
      eventType: event.eventType,
      attempted: tokens.length,
      sent,
      failed,
      invalidated
    },
    "push send summary"
  );

  return { attempted: tokens.length, sent, failed, invalidated };
}

export async function storeNotificationEvent(
  event: NotificationEventInput,
  logger?: FastifyBaseLogger
): Promise<void> {
  if (!firestoreConfigured) {
    return;
  }
  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  const createdAt = admin.firestore.Timestamp.now();
  const record = {
    orgId: event.orgId,
    eventType: event.eventType,
    entityId: event.entityId ?? null,
    entityType: event.entityType ?? null,
    title: event.title,
    body: event.body,
    actorId: event.actorId ?? null,
    actorName: event.actorName ?? null,
    data: normalizeData(event.data),
    createdAt,
    dateKey: toDateKey(createdAt.toDate())
  };

  try {
    await db.collection("orgs").doc(event.orgId).collection("notification_events").add(record);
  } catch (error) {
    logger?.warn({ err: error, orgId: event.orgId }, "Failed to store notification event");
  }
}

export async function emitOrgNotification(
  event: NotificationEventInput,
  options: EmitOptions = {}
): Promise<void> {
  const { logger, skipPush, skipStore } = options;
  const tasks: Array<Promise<unknown>> = [];

  if (!skipStore) {
    tasks.push(storeNotificationEvent(event, logger));
  }

  if (!skipPush) {
    tasks.push(
      sendPushToOrg(event, logger).catch((error) => {
        logger?.warn({ err: error }, "Failed to send push notification");
      })
    );
  }

  await Promise.all(tasks);
}

export async function sendDailyDigests(logger?: FastifyBaseLogger): Promise<{
  processedOrgs: number;
  sent: number;
}> {
  if (!firestoreConfigured) {
    return { processedOrgs: 0, sent: 0 };
  }
  const db = getFirestoreDb();
  if (!db) {
    return { processedOrgs: 0, sent: 0 };
  }

  const stateCollection = db.collection("org_notification_state");
  const now = new Date();
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  let processedOrgs = 0;
  let sent = 0;

  const subsSnapshot = await db.collection("push_subscriptions").get();
  const orgIds = new Set<string>();
  subsSnapshot.docs.forEach((doc) => {
    const data = doc.data() as PushSubscriptionRecord | undefined;
    if (data?.orgId) {
      orgIds.add(data.orgId);
    }
  });

  for (const orgId of orgIds) {
    processedOrgs += 1;

    const stateDoc = await stateCollection.doc(orgId).get();
    const lastDigestAt = stateDoc.exists ? stateDoc.get("lastDigestAt") : null;
    const since =
      lastDigestAt && lastDigestAt.toDate
        ? lastDigestAt.toDate()
        : cutoff;

    const eventsSnapshot = await db
      .collection("orgs")
      .doc(orgId)
      .collection("notification_events")
      .where("createdAt", ">=", admin.firestore.Timestamp.fromDate(since))
      .orderBy("createdAt", "asc")
      .limit(200)
      .get();

    if (eventsSnapshot.empty) {
      await stateCollection.doc(orgId).set(
        {
          lastDigestAt: admin.firestore.Timestamp.fromDate(now),
          updatedAt: admin.firestore.Timestamp.fromDate(now),
          lastDigestCount: 0
        },
        { merge: true }
      );
      continue;
    }

    const events = eventsSnapshot.docs.map((doc) => doc.data() as NotificationEventInput & { createdAt: admin.firestore.Timestamp });
    const total = events.length;
    const latest = events[events.length - 1];

    const sample = events
      .slice(-5)
      .map((event) => `• ${event.title}`)
      .join("\n");

    const bodyLines = [
      `${total} atualizacoes nas ultimas 24h.`,
      sample.length > 0 ? sample : null,
      latest ? `Ultima: ${latest.body}` : null
    ].filter(Boolean);

    const body = bodyLines.join("\n");

    await emitOrgNotification(
      {
        orgId,
        title: "Resumo diário do Taskora",
        body,
        eventType: "digest",
        data: {
          total: String(total)
        }
      },
      { logger, skipStore: true }
    );
    sent += 1;

    await stateCollection.doc(orgId).set(
      {
        lastDigestAt: admin.firestore.Timestamp.fromDate(now),
        updatedAt: admin.firestore.Timestamp.fromDate(now),
        lastDigestCount: total
      },
      { merge: true }
    );
  }

  return { processedOrgs, sent };
}
