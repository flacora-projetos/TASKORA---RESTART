import { apiFetch } from "./api";
import type { FeedbackPost, FeedbackStatus, FeedbackType, InsightComment, InsightPost } from "../types/insights";

export async function fetchFeedbackPosts(token: string, params?: {
  type?: FeedbackType;
  status?: FeedbackStatus;
  limit?: number;
}): Promise<FeedbackPost[]> {
  return apiFetch<FeedbackPost[]>("/insights/feedback", { token, query: params ?? {} });
}

export async function createFeedbackPost(
  token: string,
  payload: { type: FeedbackType; title: string; description: string; imageUrl?: string | null }
): Promise<FeedbackPost> {
  return apiFetch<FeedbackPost>("/insights/feedback", { token, method: "POST", body: payload });
}

export async function updateFeedbackPost(
  token: string,
  id: string,
  payload: Partial<{ title: string; description: string | null; status: FeedbackStatus; imageUrl: string | null }>
): Promise<FeedbackPost> {
  return apiFetch<FeedbackPost>(`/insights/feedback/${id}`, { token, method: "PATCH", body: payload });
}

export async function deleteFeedbackPost(token: string, id: string): Promise<void> {
  await apiFetch(`/insights/feedback/${id}`, { token, method: "DELETE" });
}

export async function toggleFeedbackVote(
  token: string,
  id: string
): Promise<{ voted: boolean; votesCount: number }> {
  return apiFetch<{ voted: boolean; votesCount: number }>(`/insights/feedback/${id}/vote`, {
    token,
    method: "POST"
  });
}

export async function fetchInsights(
  token: string,
  params?: { clientId?: string; projectId?: string; taskId?: string; authorId?: string; limit?: number }
): Promise<InsightPost[]> {
  return apiFetch<InsightPost[]>("/insights/posts", { token, query: params ?? {} });
}

export async function createInsight(
  token: string,
  payload: { text: string; imageUrl?: string | null; clientId?: string | null; projectId?: string | null; taskId?: string | null }
): Promise<InsightPost> {
  return apiFetch<InsightPost>("/insights/posts", { token, method: "POST", body: payload });
}

export async function deleteInsight(token: string, id: string): Promise<void> {
  await apiFetch(`/insights/posts/${id}`, { token, method: "DELETE" });
}

export async function addComment(
  token: string,
  kind: "feedback" | "insight",
  postId: string,
  text: string
): Promise<InsightComment> {
  const path = kind === "feedback" ? `/insights/feedback/${postId}/comments` : `/insights/posts/${postId}/comments`;
  return apiFetch<InsightComment>(path, { token, method: "POST", body: { text } });
}

export async function fetchComments(
  token: string,
  kind: "feedback" | "insight",
  postId: string
): Promise<InsightComment[]> {
  const path = kind === "feedback" ? `/insights/feedback/${postId}/comments` : `/insights/posts/${postId}/comments`;
  return apiFetch<InsightComment[]>(path, { token });
}
