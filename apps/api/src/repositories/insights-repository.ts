import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type {
  FeedbackCreateInput,
  FeedbackEntity,
  FeedbackStatus,
  FeedbackType,
  FeedbackUpdateInput,
  InsightCommentEntity,
  InsightCreateInput,
  InsightEntity,
  InsightUpdateInput
} from "../types/insights.js";

type ListFeedbackParams = {
  type?: FeedbackType;
  status?: FeedbackStatus;
  limit?: number;
};

type ListInsightParams = {
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  authorId?: string;
  limit?: number;
};

export interface InsightsRepository {
  findFeedbackById(orgId: string, id: string): Promise<FeedbackEntity | null>;
  listFeedback(orgId: string, params?: ListFeedbackParams): Promise<FeedbackEntity[]>;
  createFeedback(orgId: string, data: FeedbackCreateInput, actorId: string): Promise<FeedbackEntity>;
  updateFeedback(orgId: string, id: string, data: FeedbackUpdateInput, actorId: string): Promise<FeedbackEntity>;
  deleteFeedback(orgId: string, id: string, actorId: string): Promise<void>;
  toggleVote(orgId: string, id: string, userId: string): Promise<{ voted: boolean; votesCount: number }>;

  findInsightById(orgId: string, id: string): Promise<InsightEntity | null>;
  listInsights(orgId: string, params?: ListInsightParams): Promise<InsightEntity[]>;
  createInsight(orgId: string, data: InsightCreateInput, actorId: string): Promise<InsightEntity>;
  updateInsight(orgId: string, id: string, data: InsightUpdateInput, actorId: string): Promise<InsightEntity>;
  deleteInsight(orgId: string, id: string, actorId: string): Promise<void>;

  listComments(
    orgId: string,
    postKind: "feedback" | "insight",
    postId: string,
    limit?: number
  ): Promise<InsightCommentEntity[]>;
  addComment(
    orgId: string,
    postKind: "feedback" | "insight",
    postId: string,
    text: string,
    authorId: string
  ): Promise<InsightCommentEntity>;
}

function getISODate(): string {
  return new Date().toISOString();
}

function normalizeImage(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeFeedbackCreate(data: FeedbackCreateInput): FeedbackCreateInput {
  return {
    type: data.type,
    title: data.title.trim(),
    description: data.description.trim(),
    imageUrl: normalizeImage(data.imageUrl) ?? null
  };
}

function normalizeInsightCreate(data: InsightCreateInput): InsightCreateInput {
  return {
    text: data.text.trim(),
    imageUrl: normalizeImage(data.imageUrl) ?? null,
    clientId: data.clientId ?? null,
    projectId: data.projectId ?? null,
    taskId: data.taskId ?? null
  };
}

function normalizeLimit(raw?: number, fallback = 20, max = 100): number {
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    return fallback;
  }
  return Math.max(1, Math.min(Math.floor(raw), max));
}

class InMemoryInsightsRepository implements InsightsRepository {
  private feedbackStore = new Map<string, FeedbackEntity>();
  private insightStore = new Map<string, InsightEntity>();
  private comments = new Map<string, InsightCommentEntity>();
  private votes = new Map<string, Set<string>>(); // key: feedbackId, value: userIds

  async findFeedbackById(orgId: string, id: string): Promise<FeedbackEntity | null> {
    const item = this.feedbackStore.get(id);
    if (!item || item.orgId !== orgId || item.archivedAt) {
      return null;
    }
    return item;
  }

  async listFeedback(orgId: string, params: ListFeedbackParams = {}): Promise<FeedbackEntity[]> {
    let items = Array.from(this.feedbackStore.values()).filter((item) => item.orgId === orgId && !item.archivedAt);
    if (params.type) {
      items = items.filter((item) => item.type === params.type);
    }
    if (params.status) {
      items = items.filter((item) => item.status === params.status);
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, normalizeLimit(params.limit));
  }

  async createFeedback(orgId: string, data: FeedbackCreateInput, actorId: string): Promise<FeedbackEntity> {
    const normalized = normalizeFeedbackCreate(data);
    const now = getISODate();
    const id = crypto.randomUUID();
    const record: FeedbackEntity = {
      id,
      orgId,
      authorId: actorId,
      type: normalized.type,
      title: normalized.title,
      description: normalized.description,
      status: "aberto",
      imageUrl: normalized.imageUrl ?? null,
      votesCount: 0,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    this.feedbackStore.set(id, record);
    return record;
  }

  async updateFeedback(orgId: string, id: string, data: FeedbackUpdateInput): Promise<FeedbackEntity> {
    const current = this.feedbackStore.get(id);
    if (!current || current.orgId !== orgId || current.archivedAt) {
      throw new Error("Feedback not found");
    }
    const next: FeedbackEntity = {
      ...current,
      title: data.title !== undefined ? data.title.trim() : current.title,
      description: data.description !== undefined ? data.description?.trim() ?? "" : current.description,
      status: data.status ?? current.status,
      imageUrl: data.imageUrl !== undefined ? normalizeImage(data.imageUrl) : current.imageUrl,
      updatedAt: getISODate()
    };
    this.feedbackStore.set(id, next);
    return next;
  }

  async deleteFeedback(orgId: string, id: string): Promise<void> {
    const current = this.feedbackStore.get(id);
    if (!current || current.orgId !== orgId) {
      throw new Error("Feedback not found");
    }
    this.feedbackStore.delete(id);
    this.votes.delete(id);
    Array.from(this.comments.values())
      .filter((comment) => comment.postKind === "feedback" && comment.postId === id)
      .forEach((comment) => this.comments.delete(comment.id));
  }

  async toggleVote(orgId: string, id: string, userId: string): Promise<{ voted: boolean; votesCount: number }> {
    const current = this.feedbackStore.get(id);
    if (!current || current.orgId !== orgId || current.archivedAt) {
      throw new Error("Feedback not found");
    }
    const currentVotes = this.votes.get(id) ?? new Set<string>();
    let voted: boolean;
    if (currentVotes.has(userId)) {
      currentVotes.delete(userId);
      voted = false;
    } else {
      currentVotes.add(userId);
      voted = true;
    }
    this.votes.set(id, currentVotes);
    const votesCount = currentVotes.size;
    const next = { ...current, votesCount, updatedAt: getISODate() };
    this.feedbackStore.set(id, next);
    return { voted, votesCount };
  }

  async findInsightById(orgId: string, id: string): Promise<InsightEntity | null> {
    const item = this.insightStore.get(id);
    if (!item || item.orgId !== orgId || item.archivedAt) {
      return null;
    }
    return item;
  }

  async listInsights(orgId: string, params: ListInsightParams = {}): Promise<InsightEntity[]> {
    let items = Array.from(this.insightStore.values()).filter((item) => item.orgId === orgId && !item.archivedAt);
    if (params.clientId) {
      items = items.filter((item) => item.clientId === params.clientId);
    }
    if (params.projectId) {
      items = items.filter((item) => item.projectId === params.projectId);
    }
    if (params.taskId) {
      items = items.filter((item) => item.taskId === params.taskId);
    }
    if (params.authorId) {
      items = items.filter((item) => item.authorId === params.authorId);
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, normalizeLimit(params.limit));
  }

  async createInsight(orgId: string, data: InsightCreateInput, actorId: string): Promise<InsightEntity> {
    const normalized = normalizeInsightCreate(data);
    const now = getISODate();
    const id = crypto.randomUUID();
    const record: InsightEntity = {
      id,
      orgId,
      authorId: actorId,
      text: normalized.text,
      imageUrl: normalized.imageUrl ?? null,
      clientId: normalized.clientId ?? null,
      projectId: normalized.projectId ?? null,
      taskId: normalized.taskId ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    this.insightStore.set(id, record);
    return record;
  }

  async updateInsight(orgId: string, id: string, data: InsightUpdateInput): Promise<InsightEntity> {
    const current = this.insightStore.get(id);
    if (!current || current.orgId !== orgId || current.archivedAt) {
      throw new Error("Insight not found");
    }
    const next: InsightEntity = {
      ...current,
      text: data.text !== undefined ? data.text.trim() : current.text,
      imageUrl: data.imageUrl !== undefined ? normalizeImage(data.imageUrl) : current.imageUrl,
      clientId: data.clientId !== undefined ? data.clientId ?? null : current.clientId,
      projectId: data.projectId !== undefined ? data.projectId ?? null : current.projectId,
      taskId: data.taskId !== undefined ? data.taskId ?? null : current.taskId,
      updatedAt: getISODate()
    };
    this.insightStore.set(id, next);
    return next;
  }

  async deleteInsight(orgId: string, id: string): Promise<void> {
    const current = this.insightStore.get(id);
    if (!current || current.orgId !== orgId) {
      throw new Error("Insight not found");
    }
    this.insightStore.delete(id);
    Array.from(this.comments.values())
      .filter((comment) => comment.postKind === "insight" && comment.postId === id)
      .forEach((comment) => this.comments.delete(comment.id));
  }

  async listComments(
    orgId: string,
    postKind: "feedback" | "insight",
    postId: string,
    limit?: number
  ): Promise<InsightCommentEntity[]> {
    const items = Array.from(this.comments.values()).filter(
      (comment) => comment.orgId === orgId && comment.postKind === postKind && comment.postId === postId
    );
    return items
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, normalizeLimit(limit ?? 50, 50, 200));
  }

  async addComment(
    orgId: string,
    postKind: "feedback" | "insight",
    postId: string,
    text: string,
    authorId: string
  ): Promise<InsightCommentEntity> {
    const now = getISODate();
    const id = crypto.randomUUID();
    const comment: InsightCommentEntity = {
      id,
      orgId,
      postId,
      postKind,
      authorId,
      text: text.trim(),
      createdAt: now
    };
    this.comments.set(id, comment);
    return comment;
  }
}

class FirestoreInsightsRepository implements InsightsRepository {
  private feedbackCollection: FirebaseFirestore.CollectionReference<FeedbackEntity>;
  private insightCollection: FirebaseFirestore.CollectionReference<InsightEntity>;
  private commentsCollection: FirebaseFirestore.CollectionReference<InsightCommentEntity>;

  constructor() {
    const firestore = getFirestoreDb();
    if (!firestore) {
      throw new Error("Firestore not configured");
    }
    this.feedbackCollection = firestore.collection(
      "feedback_posts"
    ) as FirebaseFirestore.CollectionReference<FeedbackEntity>;
    this.insightCollection = firestore.collection(
      "insight_posts"
    ) as FirebaseFirestore.CollectionReference<InsightEntity>;
    this.commentsCollection = firestore.collection(
      "insight_comments"
    ) as FirebaseFirestore.CollectionReference<InsightCommentEntity>;
  }

  private docToFeedback(doc: FirebaseFirestore.DocumentSnapshot<FeedbackEntity>): FeedbackEntity {
    const data = doc.data();
    if (!data) {
      throw new Error("Invalid feedback document");
    }
    const { id: _ignoredId, ...rest } = data;
    return { ...rest, id: doc.id };
  }

  private docToInsight(doc: FirebaseFirestore.DocumentSnapshot<InsightEntity>): InsightEntity {
    const data = doc.data();
    if (!data) {
      throw new Error("Invalid insight document");
    }
    const { id: _ignoredId, ...rest } = data;
    return { ...rest, id: doc.id };
  }

  private docToComment(doc: FirebaseFirestore.DocumentSnapshot<InsightCommentEntity>): InsightCommentEntity {
    const data = doc.data();
    if (!data) {
      throw new Error("Invalid comment document");
    }
    const { id: _ignoredId, ...rest } = data;
    return { ...rest, id: doc.id };
  }

  async findFeedbackById(orgId: string, id: string): Promise<FeedbackEntity | null> {
    const doc = await this.feedbackCollection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const entity = this.docToFeedback(doc);
    if (entity.orgId !== orgId || entity.archivedAt) {
      return null;
    }
    return entity;
  }

  async listFeedback(orgId: string, params: ListFeedbackParams = {}): Promise<FeedbackEntity[]> {
    let query: FirebaseFirestore.Query<FeedbackEntity> = this.feedbackCollection
      .where("orgId", "==", orgId)
      .where("archivedAt", "==", null);
    if (params.type) {
      query = query.where("type", "==", params.type);
    }
    if (params.status) {
      query = query.where("status", "==", params.status);
    }
    const snapshot = await query.orderBy("createdAt", "desc").limit(normalizeLimit(params.limit)).get();
    return snapshot.docs.map((doc) => this.docToFeedback(doc));
  }

  async createFeedback(orgId: string, data: FeedbackCreateInput, actorId: string): Promise<FeedbackEntity> {
    const normalized = normalizeFeedbackCreate(data);
    const now = getISODate();
    const ref = this.feedbackCollection.doc();
    const record: FeedbackEntity = {
      id: ref.id,
      orgId,
      authorId: actorId,
      type: normalized.type,
      title: normalized.title,
      description: normalized.description,
      status: "aberto",
      imageUrl: normalized.imageUrl ?? null,
      votesCount: 0,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    await ref.set(record);
    return record;
  }

  async updateFeedback(orgId: string, id: string, data: FeedbackUpdateInput): Promise<FeedbackEntity> {
    const doc = await this.feedbackCollection.doc(id).get();
    if (!doc.exists) {
      throw new Error("Feedback not found");
    }
    const current = this.docToFeedback(doc);
    if (current.orgId !== orgId || current.archivedAt) {
      throw new Error("Feedback not found");
    }
    const next: FeedbackEntity = {
      ...current,
      title: data.title !== undefined ? data.title.trim() : current.title,
      description: data.description !== undefined ? data.description?.trim() ?? "" : current.description,
      status: data.status ?? current.status,
      imageUrl: data.imageUrl !== undefined ? normalizeImage(data.imageUrl) : current.imageUrl,
      updatedAt: getISODate()
    };
    await this.feedbackCollection.doc(id).set(next);
    return next;
  }

  async deleteFeedback(orgId: string, id: string): Promise<void> {
    const doc = await this.feedbackCollection.doc(id).get();
    if (!doc.exists) {
      throw new Error("Feedback not found");
    }
    const current = this.docToFeedback(doc);
    if (current.orgId !== orgId) {
      throw new Error("Feedback not found");
    }
    await this.feedbackCollection.doc(id).delete();
    // delete comments
    const comments = await this.commentsCollection
      .where("orgId", "==", orgId)
      .where("postKind", "==", "feedback")
      .where("postId", "==", id)
      .get();
    const batch = comments.size > 0 ? this.feedbackCollection.firestore.batch() : null;
    comments.docs.forEach((comment) => batch?.delete(comment.ref));
    if (batch) {
      await batch.commit();
    }
    // votes subcollection cleanup is optional; storage cost low; skipping.
  }

  async toggleVote(orgId: string, id: string, userId: string): Promise<{ voted: boolean; votesCount: number }> {
    const firestore = this.feedbackCollection.firestore;
    const feedbackRef = this.feedbackCollection.doc(id);
    const voteRef = feedbackRef.collection("votes").doc(userId);

    const result = await firestore.runTransaction(async (tx) => {
      const feedbackSnap = await tx.get(feedbackRef);
      if (!feedbackSnap.exists) {
        throw new Error("Feedback not found");
      }
      const feedback = this.docToFeedback(feedbackSnap);
      if (feedback.orgId !== orgId || feedback.archivedAt) {
        throw new Error("Feedback not found");
      }

      const voteSnap = await tx.get(voteRef);
      let voted: boolean;
      let votesCount = feedback.votesCount ?? 0;
      if (voteSnap.exists) {
        tx.delete(voteRef);
        voted = false;
        votesCount = Math.max(0, votesCount - 1);
      } else {
        tx.set(voteRef, { userId, createdAt: getISODate() });
        voted = true;
        votesCount += 1;
      }

      tx.set(feedbackRef, { ...feedback, votesCount, updatedAt: getISODate() });
      return { voted, votesCount };
    });

    return result;
  }

  async listInsights(orgId: string, params: ListInsightParams = {}): Promise<InsightEntity[]> {
    let query: FirebaseFirestore.Query<InsightEntity> = this.insightCollection
      .where("orgId", "==", orgId)
      .where("archivedAt", "==", null);
    if (params.clientId) {
      query = query.where("clientId", "==", params.clientId);
    }
    if (params.projectId) {
      query = query.where("projectId", "==", params.projectId);
    }
    if (params.taskId) {
      query = query.where("taskId", "==", params.taskId);
    }
    if (params.authorId) {
      query = query.where("authorId", "==", params.authorId);
    }
    const snapshot = await query.orderBy("createdAt", "desc").limit(normalizeLimit(params.limit)).get();
    return snapshot.docs.map((doc) => this.docToInsight(doc));
  }

  async findInsightById(orgId: string, id: string): Promise<InsightEntity | null> {
    const doc = await this.insightCollection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    const entity = this.docToInsight(doc);
    if (entity.orgId !== orgId || entity.archivedAt) {
      return null;
    }
    return entity;
  }

  async createInsight(orgId: string, data: InsightCreateInput, actorId: string): Promise<InsightEntity> {
    const normalized = normalizeInsightCreate(data);
    const now = getISODate();
    const ref = this.insightCollection.doc();
    const record: InsightEntity = {
      id: ref.id,
      orgId,
      authorId: actorId,
      text: normalized.text,
      imageUrl: normalized.imageUrl ?? null,
      clientId: normalized.clientId ?? null,
      projectId: normalized.projectId ?? null,
      taskId: normalized.taskId ?? null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null
    };
    await ref.set(record);
    return record;
  }

  async updateInsight(orgId: string, id: string, data: InsightUpdateInput): Promise<InsightEntity> {
    const doc = await this.insightCollection.doc(id).get();
    if (!doc.exists) {
      throw new Error("Insight not found");
    }
    const current = this.docToInsight(doc);
    if (current.orgId !== orgId || current.archivedAt) {
      throw new Error("Insight not found");
    }
    const next: InsightEntity = {
      ...current,
      text: data.text !== undefined ? data.text.trim() : current.text,
      imageUrl: data.imageUrl !== undefined ? normalizeImage(data.imageUrl) : current.imageUrl,
      clientId: data.clientId !== undefined ? data.clientId ?? null : current.clientId,
      projectId: data.projectId !== undefined ? data.projectId ?? null : current.projectId,
      taskId: data.taskId !== undefined ? data.taskId ?? null : current.taskId,
      updatedAt: getISODate()
    };
    await this.insightCollection.doc(id).set(next);
    return next;
  }

  async deleteInsight(orgId: string, id: string): Promise<void> {
    const doc = await this.insightCollection.doc(id).get();
    if (!doc.exists) {
      throw new Error("Insight not found");
    }
    const current = this.docToInsight(doc);
    if (current.orgId !== orgId) {
      throw new Error("Insight not found");
    }
    await this.insightCollection.doc(id).delete();
    const comments = await this.commentsCollection
      .where("orgId", "==", orgId)
      .where("postKind", "==", "insight")
      .where("postId", "==", id)
      .get();
    const batch = comments.size > 0 ? this.insightCollection.firestore.batch() : null;
    comments.docs.forEach((comment) => batch?.delete(comment.ref));
    if (batch) {
      await batch.commit();
    }
  }

  async listComments(
    orgId: string,
    postKind: "feedback" | "insight",
    postId: string,
    limit?: number
  ): Promise<InsightCommentEntity[]> {
    const snapshot = await this.commentsCollection
      .where("orgId", "==", orgId)
      .where("postKind", "==", postKind)
      .where("postId", "==", postId)
      .orderBy("createdAt", "asc")
      .limit(normalizeLimit(limit ?? 50, 50, 200))
      .get();
    return snapshot.docs.map((doc) => this.docToComment(doc));
  }

  async addComment(
    orgId: string,
    postKind: "feedback" | "insight",
    postId: string,
    text: string,
    authorId: string
  ): Promise<InsightCommentEntity> {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new Error("Comment vazio");
    }
    const now = getISODate();
    const ref = this.commentsCollection.doc();
    const record: InsightCommentEntity = {
      id: ref.id,
      orgId,
      postId,
      postKind,
      authorId,
      text: trimmed,
      createdAt: now
    };
    await ref.set(record);
    return record;
  }
}

let insightsRepository: InsightsRepository | null = null;

export function getInsightsRepository(): InsightsRepository {
  if (insightsRepository) {
    return insightsRepository;
  }
  if (firestoreConfigured && getFirestoreDb()) {
    insightsRepository = new FirestoreInsightsRepository();
    return insightsRepository;
  }
  insightsRepository = new InMemoryInsightsRepository();
  return insightsRepository;
}
