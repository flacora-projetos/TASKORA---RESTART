export type FeedbackType = "bug" | "melhoria" | "ideia";
export type FeedbackStatus = "aberto" | "em_analise" | "em_desenvolvimento" | "entregue";

export type FeedbackPost = {
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
};

export type InsightPost = {
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
};

export type InsightComment = {
  id: string;
  orgId: string;
  postId: string;
  postKind: "feedback" | "insight";
  authorId: string;
  text: string;
  createdAt: string;
};
