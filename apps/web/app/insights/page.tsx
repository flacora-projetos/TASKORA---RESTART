'use client';

import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { MessageCircle, Plus, ThumbsUp, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../components/auth/AuthProvider";
import { apiFetch, ApiError } from "../../lib/api";
import { getFirebaseApp } from "../../lib/firebase";
import {
  addComment,
  createFeedbackPost,
  createInsight,
  deleteFeedbackPost,
  deleteInsight,
  fetchComments,
  fetchFeedbackPosts,
  fetchInsights,
  toggleFeedbackVote,
  updateFeedbackPost
} from "../../lib/insights";
import type { Client } from "../../types/clients";
import type { FeedbackPost, FeedbackStatus, FeedbackType, InsightComment, InsightPost } from "../../types/insights";
import type { Project } from "../../types/projects";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB
const DATE_LABEL = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function formatDateLabel(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return DATE_LABEL.format(date);
}

type TabKey = "feedback" | "insights";

export default function InsightsPage(): JSX.Element {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabKey>("feedback");
  const [feedbackForm, setFeedbackForm] = useState<{ type: FeedbackType; title: string; description: string; file: File | null }>({
    type: "bug",
    title: "",
    description: "",
    file: null
  });
  const [insightForm, setInsightForm] = useState<{
    text: string;
    file: File | null;
    clientId: string | null;
    projectId: string | null;
    taskId: string | null;
  }>({ text: "", file: null, clientId: null, projectId: null, taskId: null });
  const [feedbackPosts, setFeedbackPosts] = useState<FeedbackPost[]>([]);
  const [insightPosts, setInsightPosts] = useState<InsightPost[]>([]);
  const [comments, setComments] = useState<Record<string, InsightComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const currentUserId = user?.uid ?? null;

  const loadInitialData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [fb, insights, clientsResp, projectsResp] = await Promise.all([
        fetchFeedbackPosts(token, { limit: 50 }),
        fetchInsights(token, { limit: 50 }),
        apiFetch<{ items: Client[] }>("/clients", { token, query: { status: "active" } }),
        apiFetch<{ items: Project[] }>("/projects", { token, query: { status: "active" } })
      ]);
      setFeedbackPosts(fb);
      setInsightPosts(insights);
      setClients(clientsResp.items ?? []);
      setProjects(projectsResp.items ?? []);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Não foi possível carregar os insights agora.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const uploadAttachment = async (file: File): Promise<string> => {
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new Error("Arquivo maior que 10MB.");
    }
    const app = getFirebaseApp();
    if (!app) {
      throw new Error("Firebase não configurado para upload.");
    }

    // Sanitiza o nome para evitar travar em caracteres especiais e garante unicidade.
    const safeName = file.name.replace(/[^\w.-]+/g, "-");
    const fileRef = ref(getStorage(app), `insights/${Date.now()}-${crypto.randomUUID()}-${safeName}`);

    try {
      const snapshot = await uploadBytes(fileRef, file, { contentType: file.type });
      return getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Erro ao enviar anexo para o Storage", error);
      const message = error instanceof Error ? error.message : "Falha ao enviar o anexo para o Storage.";
      throw new Error(message);
    }
  };

  const handleCreateFeedback = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (!feedbackForm.title.trim() || !feedbackForm.description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      let imageUrl: string | null = null;
      if (feedbackForm.file) {
        imageUrl = await uploadAttachment(feedbackForm.file);
      }
      const created = await createFeedbackPost(token, {
        type: feedbackForm.type,
        title: feedbackForm.title.trim(),
        description: feedbackForm.description.trim(),
        imageUrl
      });
      setFeedbackPosts((prev) => [created, ...prev]);
      setFeedbackForm({ type: "bug", title: "", description: "", file: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível criar o feedback.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInsight = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (!insightForm.text.trim()) return;
    if (!insightForm.clientId && !insightForm.projectId && !insightForm.taskId) {
      setError("Informe ao menos cliente, projeto ou tarefa.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let imageUrl: string | null = null;
      if (insightForm.file) {
        imageUrl = await uploadAttachment(insightForm.file);
      }
      const created = await createInsight(token, {
        text: insightForm.text.trim(),
        imageUrl,
        clientId: insightForm.clientId,
        projectId: insightForm.projectId,
        taskId: insightForm.taskId
      });
      setInsightPosts((prev) => [created, ...prev]);
      setInsightForm({ text: "", file: null, clientId: null, projectId: null, taskId: null });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível criar o insight.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (postId: string, status: FeedbackStatus) => {
    if (!token) return;
    try {
      const updated = await updateFeedbackPost(token, postId, { status });
      setFeedbackPosts((prev) => prev.map((item) => (item.id === postId ? updated : item)));
    } catch {
      setError("Não foi possível atualizar o status.");
    }
  };

  const handleVote = async (postId: string) => {
    if (!token) return;
    try {
      const result = await toggleFeedbackVote(token, postId);
      setFeedbackPosts((prev) =>
        prev.map((item) => (item.id === postId ? { ...item, votesCount: result.votesCount } : item))
      );
    } catch {
      setError("Não foi possível votar agora.");
    }
  };

  const handleDelete = async (postId: string, kind: "feedback" | "insight") => {
    if (!token) return;
    const confirmed = window.confirm("Deseja realmente excluir?");
    if (!confirmed) return;
    try {
      if (kind === "feedback") {
        await deleteFeedbackPost(token, postId);
        setFeedbackPosts((prev) => prev.filter((item) => item.id !== postId));
      } else {
        await deleteInsight(token, postId);
        setInsightPosts((prev) => prev.filter((item) => item.id !== postId));
      }
    } catch {
      setError("Não foi possível excluir.");
    }
  };

  const loadCommentsFor = async (postId: string, kind: "feedback" | "insight") => {
    if (!token) return;
    try {
      const data = await fetchComments(token, kind, postId);
      setComments((prev) => ({ ...prev, [postId]: data }));
    } catch {
      setError("Não foi possível carregar comentários.");
    }
  };

  const handleAddComment = async (postId: string, kind: "feedback" | "insight") => {
    if (!token) return;
    const text = (commentDrafts[postId] ?? "").trim();
    if (!text) return;
    try {
      const created = await addComment(token, kind, postId, text);
      setComments((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), created] }));
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    } catch {
      setError("Não foi possível comentar.");
    }
  };

  const filteredProjects = useMemo(() => {
    if (!insightForm.clientId) return projects;
    return projects.filter((p) => p.clientId === insightForm.clientId);
  }, [projects, insightForm.clientId]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-deepGreen/60">Central de Insights</p>
        <h1 className="text-2xl font-semibold text-deepGreen">Feedback do app e aprendizados operacionais</h1>
        <p className="text-sm text-deepGreen/70">
          Registre bugs/melhorias e insights sobre clientes, projetos ou tarefas. Uploads limitados a 10MB.
        </p>
        <div className="flex gap-2 rounded-full bg-white px-2 py-1 text-sm shadow-sm w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("feedback")}
            className={`rounded-full px-3 py-1 font-semibold ${
              activeTab === "feedback" ? "bg-terracota text-white" : "text-deepGreen hover:bg-green-50"
            }`}
          >
            Feedback do App
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("insights")}
            className={`rounded-full px-3 py-1 font-semibold ${
              activeTab === "insights" ? "bg-terracota text-white" : "text-deepGreen hover:bg-green-50"
            }`}
          >
            Insights de Operação
          </button>
        </div>
        {error ? <p className="text-sm font-semibold text-terracota">{error}</p> : null}
      </header>

      {activeTab === "feedback" ? (
        <section className="space-y-4">
          <form onSubmit={handleCreateFeedback} className="rounded-2xl border border-deepGreen/10 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-deepGreen">
              <Plus className="size-4" />
              Novo feedback
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm font-medium text-deepGreen">
                Tipo
                <select
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm"
                  value={feedbackForm.type}
                  onChange={(e) =>
                    setFeedbackForm((prev) => ({ ...prev, type: e.target.value as FeedbackType }))
                  }
                >
                  <option value="bug">Bug</option>
                  <option value="melhoria">Melhoria</option>
                  <option value="ideia">Ideia</option>
                </select>
              </label>
              <label className="text-sm font-medium text-deepGreen">
                Anexo (até 10MB)
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block w-full text-sm"
                  onChange={(e) => setFeedbackForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
                />
              </label>
            </div>
            <label className="text-sm font-medium text-deepGreen">
              Título
              <input
                required
                className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm"
                value={feedbackForm.title}
                onChange={(e) => setFeedbackForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </label>
            <label className="text-sm font-medium text-deepGreen">
              Descrição
              <textarea
                required
                rows={3}
                className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm"
                value={feedbackForm.description}
                onChange={(e) => setFeedbackForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-terracota px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                Enviar
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {feedbackPosts.map((post) => {
              const isAuthor = post.authorId === currentUserId;
              return (
                <article key={post.id} className="rounded-2xl border border-deepGreen/10 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-deepGreen/10 px-3 py-1 text-xs font-semibold text-deepGreen">
                      {post.type}
                    </span>
                    <select
                      value={post.status}
                      onChange={(e) => handleStatusChange(post.id, e.target.value as FeedbackStatus)}
                      disabled={!isAuthor}
                      className="rounded-full border border-deepGreen/20 bg-white px-3 py-1 text-xs font-semibold text-deepGreen disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      <option value="aberto">Aberto</option>
                      <option value="em_analise">Em análise</option>
                      <option value="em_desenvolvimento">Em desenvolvimento</option>
                      <option value="entregue">Entregue</option>
                    </select>
                    <span className="text-xs text-deepGreen/60">
                      {formatDateLabel(post.createdAt)}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleVote(post.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-deepGreen/20 px-3 py-1 text-xs font-semibold text-deepGreen hover:bg-deepGreen/5"
                      >
                        <ThumbsUp className="size-3.5" /> {post.votesCount}
                      </button>
                      {isAuthor ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id, "feedback")}
                          className="text-deepGreen/60 hover:text-terracota"
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <h3 className="mt-2 text-lg font-semibold text-deepGreen">{post.title}</h3>
                  <p className="mt-1 text-sm text-deepGreen/80 whitespace-pre-wrap">{post.description}</p>
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="mt-3 max-h-64 w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <CommentsBlock
                    comments={comments[post.id]}
                    onToggle={() => void loadCommentsFor(post.id, "feedback")}
                    draft={commentDrafts[post.id] ?? ""}
                    onDraftChange={(value) => setCommentDrafts((prev) => ({ ...prev, [post.id]: value }))}
                    onSubmit={() => void handleAddComment(post.id, "feedback")}
                  />
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <form onSubmit={handleCreateInsight} className="rounded-2xl border border-deepGreen/10 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-deepGreen">
              <Plus className="size-4" />
              Novo insight
            </div>
            <label className="text-sm font-medium text-deepGreen">
              Insight
              <textarea
                required
                rows={3}
                className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm"
                value={insightForm.text}
                onChange={(e) => setInsightForm((prev) => ({ ...prev, text: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="text-sm font-medium text-deepGreen">
                Cliente
                <select
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm"
                  value={insightForm.clientId ?? ""}
                  onChange={(e) =>
                    setInsightForm((prev) => ({ ...prev, clientId: e.target.value || null, projectId: null }))
                  }
                >
                  <option value="">Selecione</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-deepGreen">
                Projeto
                <select
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm"
                  value={insightForm.projectId ?? ""}
                  onChange={(e) => setInsightForm((prev) => ({ ...prev, projectId: e.target.value || null }))}
                >
                  <option value="">Selecione</option>
                  {filteredProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium text-deepGreen">
                Tarefa (ID opcional)
                <input
                  className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm"
                  placeholder="Cole o ID da tarefa"
                  value={insightForm.taskId ?? ""}
                  onChange={(e) => setInsightForm((prev) => ({ ...prev, taskId: e.target.value || null }))}
                />
              </label>
            </div>
            <label className="text-sm font-medium text-deepGreen">
              Anexo (até 10MB)
              <input
                type="file"
                accept="image/*"
                className="mt-1 block w-full text-sm"
                onChange={(e) => setInsightForm((prev) => ({ ...prev, file: e.target.files?.[0] ?? null }))}
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-full bg-terracota px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60"
              >
                Salvar insight
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {insightPosts.map((post) => {
              const isAuthor = post.authorId === currentUserId;
              const linkedClient = post.clientId ? clients.find((c) => c.id === post.clientId) : null;
              const linkedProject = post.projectId ? projects.find((p) => p.id === post.projectId) : null;
              return (
                <article key={post.id} className="rounded-2xl border border-deepGreen/10 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-deepGreen/60">
                    <span className="rounded-full bg-deepGreen/10 px-3 py-1 text-xs font-semibold text-deepGreen">
                      Insight
                    </span>
                    <span>{formatDateLabel(post.createdAt)}</span>
                    <div className="ml-auto">
                      {isAuthor ? (
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id, "insight")}
                          className="text-deepGreen/60 hover:text-terracota"
                          aria-label="Excluir"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-deepGreen/80 whitespace-pre-wrap">{post.text}</p>
                  {post.imageUrl ? (
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="mt-3 max-h-64 w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-deepGreen/70">
                    {linkedClient ? (
                      <span className="rounded-full bg-deepGreen/10 px-3 py-1 font-semibold">
                        Cliente: {linkedClient.name}
                      </span>
                    ) : null}
                    {linkedProject ? (
                      <span className="rounded-full bg-deepGreen/10 px-3 py-1 font-semibold">
                        Projeto: {linkedProject.name}
                      </span>
                    ) : null}
                    {post.taskId ? (
                      <span className="rounded-full bg-deepGreen/10 px-3 py-1 font-semibold">Tarefa: {post.taskId}</span>
                    ) : null}
                  </div>
                  <CommentsBlock
                    comments={comments[post.id]}
                    onToggle={() => void loadCommentsFor(post.id, "insight")}
                    draft={commentDrafts[post.id] ?? ""}
                    onDraftChange={(value) => setCommentDrafts((prev) => ({ ...prev, [post.id]: value }))}
                    onSubmit={() => void handleAddComment(post.id, "insight")}
                  />
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

type CommentsBlockProps = {
  comments?: InsightComment[];
  onToggle: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
};

function CommentsBlock({ comments, onToggle, draft, onDraftChange, onSubmit }: CommentsBlockProps) {
  return (
    <div className="mt-3 rounded-xl border border-deepGreen/10 bg-deepGreen/5 p-3">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-sm font-semibold text-deepGreen"
      >
        <span className="inline-flex items-center gap-2">
          <MessageCircle className="size-4" />
          Comentários
        </span>
        <span className="text-xs text-deepGreen/60">{comments ? `${comments.length} comentário(s)` : "Carregar"}</span>
      </button>
      {comments ? (
        <div className="mt-3 space-y-2">
          {comments.length === 0 ? (
            <p className="text-xs text-deepGreen/60">Nenhum comentário ainda.</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
                <p className="text-deepGreen/80 whitespace-pre-wrap">{comment.text}</p>
                <p className="text-[11px] text-deepGreen/50">
                  {formatDateLabel(comment.createdAt)}
                </p>
              </div>
            ))
          )}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <input
          className="flex-1 rounded-full border border-deepGreen/20 px-3 py-2 text-sm"
          placeholder="Escreva um comentário"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-full bg-terracota px-3 py-2 text-sm font-semibold text-white"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}
