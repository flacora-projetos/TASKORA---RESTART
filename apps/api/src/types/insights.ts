export type FeedbackType = "bug" | "melhoria" | "ideia";
export type FeedbackStatus = "aberto" | "em_analise" | "em_desenvolvimento" | "entregue";

export type FeedbackCreateInput = {
  type: FeedbackType;
  title: string;
  description: string;
  imageUrl?: string | null;
};

export type FeedbackUpdateInput = {
  title?: string;
  description?: string | null;
  status?: FeedbackStatus;
  imageUrl?: string | null;
};

export type FeedbackEntity = {
  id: string;
  orgId: string;
  authorId: string;
  type: FeedbackType;
  title: string;
  description: string;
  status: FeedbackStatus;
  imageUrl: string | null;
  votesCount: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type InsightCreateInput = {
  text: string;
  imageUrl?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
};

export type InsightUpdateInput = {
  text?: string;
  imageUrl?: string | null;
  clientId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
};

export type InsightEntity = {
  id: string;
  orgId: string;
  authorId: string;
  text: string;
  imageUrl: string | null;
  clientId: string | null;
  projectId: string | null;
  taskId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

export type InsightCommentEntity = {
  id: string;
  orgId: string;
  postId: string;
  postKind: "feedback" | "insight";
  authorId: string;
  text: string;
  createdAt: string;
};
