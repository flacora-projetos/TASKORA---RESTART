import { GoogleAuth, type AuthClient } from "google-auth-library";

import { env } from "../env.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTeamMembersRepository } from "../repositories/team-members-repository.js";
import {
  getIntegrationStatusSnapshot,
  getMetricsSummarySnapshot,
  getSpendOverviewSnapshot
} from "./dashboard-data.js";
import { callExternalApi, callExternalGa4, callExternalMcp } from "./external-clients.js";
import { getHoursReport, type HoursReportFilters } from "./hours-report.js";
import type { ClientEntity } from "../types/clients.js";
import type { ProjectEntity } from "../types/projects.js";
import type { TaskStatus, TaskType } from "../types/tasks.js";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AgentToolCall =
  | {
      id?: string;
      kind: "internal_tasks";
      limit?: number;
    }
  | {
      id?: string;
      kind: "external_api";
      path: string;
      method?: HttpMethod;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    }
  | {
      id?: string;
      kind: "mcp";
      tool: string;
      args?: Record<string, unknown>;
    }
  | {
      id?: string;
      kind: "ga4";
      path: string;
      method?: HttpMethod;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    }
  | {
      id?: string;
      kind: "task_create";
      projectId: string;
      title: string;
      dueDate?: string;
      description?: string;
      assignees?: string[];
      status?: TaskStatus;
      type?: TaskType;
    };

export type AgentToolResult = {
  id: string;
  kind: AgentToolCall["kind"];
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

export type AgentHistoryEntry = {
  role: "user" | "assistant";
  content: string;
};

type ClientFocus = {
  clientId: string;
  clientName: string | null;
  metaAccountIds: string[];
  googleCustomerIds: string[];
  ga4PropertyIds: string[];
};

type AgentIntent = {
  wantsOverview: boolean;
  wantsTasks: boolean;
  wantsTaskCreation: boolean;
  wantsHours: boolean;
  wantsSpend: boolean;
  wantsIntegrations: boolean;
  wantsMeta: boolean;
  wantsGoogle: boolean;
  wantsGa4: boolean;
  wantsInsights: boolean;
};

type RunAgentParams = {
  prompt: string;
  orgId: string;
  actorId: string;
  actorRoles: string[];
  tools?: AgentToolCall[];
  history?: AgentHistoryEntry[];
};

type AgentResponsePayload = {
  provider: "vertex";
  model: string;
  text: string;
  stubbed: boolean;
  finishReason: string | null;
  usage?: unknown;
  raw?: unknown;
};

export type AgentRunResult = {
  prompt: string;
  orgId: string;
  context: AgentToolResult[];
  response: AgentResponsePayload;
};

type RequestedRange = {
  range: string;
  startDate: string;
  endDate: string;
  days: number;
};

const vertexBaseUrl = env.VERTEX_API_BASE_URL.replace(/\/$/, "");
const vertexApiKeyFallbackBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
const MAX_HISTORY_ENTRIES = 6;
const MAX_FOCUS_ACCOUNTS = 4;
const MAX_VERTEX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;
const DAY_IN_MS = 24 * 60 * 60 * 1_000;
const TIMEZONE = "America/Sao_Paulo";

const GA4_TOOL_METRICS = [
  "sessions",
  "newUsers",
  "screenPageViews",
  "eventCount",
  "conversions",
  "purchaseRevenue"
] as const;

const ASSISTANT_CAPABILITIES = [
  "- Priorizar tarefas, prazos e responsaveis (com nomes reais).",
  "- Consultar horas registradas hoje e no periodo selecionado.",
  "- Resumir gastos/saldos Meta Ads.",
  "- Trazer spend e insights de Google Ads.",
  "- Ler metricas de GA4 das propriedades cadastradas.",
  "- Verificar status das integracoes e sugerir proximos passos."
].join("\n");

const vertexScopes = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/generative-language"
];

const googleAuth = new GoogleAuth({ scopes: vertexScopes });
let googleAuthClient: AuthClient | null = null;
const googleProjectId =
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  process.env.PROJECT_ID ??
  env.FIREBASE_PROJECT_ID ??
  null;
const vertexProjectId = env.VERTEX_PROJECT_ID ?? googleProjectId;
const vertexLocation = env.VERTEX_LOCATION;

async function getVertexAccessToken(): Promise<string | null> {
  try {
    if (!googleAuthClient) {
      googleAuthClient = await googleAuth.getClient();
    }
    const token = await googleAuthClient.getAccessToken();
    if (typeof token === "string" && token) {
      return token;
    }
    return null;
  } catch (error) {
    console.warn("[agent] Failed to obtain Vertex access token:", error);
    return null;
  }
}

function normalizeLimit(limit?: number): number {
  if (!limit || limit < 1) {
    return 5;
  }
  if (limit > 25) {
    return 25;
  }
  return Math.floor(limit);
}

function safeJson(data: unknown, fallback = "{}"): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return fallback;
  }
}

function extractVertexText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const candidates = (payload as Record<string, unknown>).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return "";
  }

  const first = candidates[0] as Record<string, unknown>;
  const content = first.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? (content!.parts as Array<Record<string, unknown>>) : [];

  return parts
    .map((part) => {
      if (typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .filter((value) => value.length > 0)
    .join("\n")
    .trim();
}

function buildApiKeyModelName(model: string): string {
  let normalized = model.trim();
  if (normalized.startsWith("publishers/")) {
    const parts = normalized.split("/");
    normalized = parts[parts.length - 1] ?? normalized;
  }
  if (normalized.startsWith("models/")) {
    return normalized;
  }
  return `models/${normalized}`;
}

function isGreetingPrompt(prompt: string): boolean {
  const normalized = prompt.trim().toLowerCase().replace(/[!?.]/g, "");
  if (!normalized) {
    return true;
  }
  const greetings = [
    "oi",
    "olá",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "hey",
    "hello",
    "hi"
  ];
  return greetings.some((greeting) => normalized === greeting || normalized.startsWith(`${greeting} `));
}

class VertexAgentService {
  private tasksRepository = getTasksRepository();
  private clientsRepository = getClientsRepository();
  private projectsRepository = getProjectsRepository();
  private teamMembersRepository = getTeamMembersRepository();

  async run(params: RunAgentParams): Promise<AgentRunResult> {
    const intent = this.detectIntent(params.prompt);
    const requestedRange = this.detectRequestedRange(params.prompt);
    const focus = await this.detectClientFocus(params.prompt, params.orgId);
    let focusProjects: ProjectEntity[] = [];
    if (intent.wantsTaskCreation) {
      if (focus) {
        focusProjects = await this.projectsRepository.list(params.orgId, { clientId: focus.clientId, status: "active" });
      }
      if (focusProjects.length === 0) {
        focusProjects = await this.projectsRepository.list(params.orgId, { status: "active" });
      }
    }
    const context = await this.resolveTools(
      params.orgId,
      params.prompt,
      params.tools ?? [],
      focus,
      intent,
      requestedRange?.range ?? null,
      params.actorRoles,
      params.actorId,
      focusProjects
    );
    const response = await this.callVertex(
      params.prompt,
      context,
      params.actorId,
      params.actorRoles,
      params.orgId,
      params.history,
      focus,
      requestedRange,
      focusProjects,
      intent.wantsTaskCreation
    );

    return {
      prompt: params.prompt,
      orgId: params.orgId,
      context,
      response
    };
  }

  private detectIntent(prompt: string): AgentIntent {
    const normalized = this.normalizeText(prompt);
    const includesAny = (keywords: string[]): boolean => keywords.some((keyword) => normalized.includes(keyword));

    const wantsTasks = includesAny([
      "tarefa",
      "tarefas",
      "to do",
      "priorizar",
      "prioridade",
      "deadline",
      "entrega",
      "atras"
    ]);
    const mentionsCreate = includesAny(["criar", "crie", "abrir", "adicionar"]);
    const mentionsTask = includesAny(["tarefa", "tarefas", "task"]);
    const wantsTaskCreation =
      includesAny([
        "criar tarefa",
        "crie tarefa",
        "criar uma tarefa",
        "crie uma tarefa",
        "nova tarefa",
        "adicionar tarefa",
        "abrir tarefa",
        "criar task",
        "crie task"
      ]) ||
      (mentionsCreate && mentionsTask);
    const wantsHours = includesAny(["hora", "horas", "timesheet", "ponto", "lancamento", "registro de horas"]);
    const wantsMeta = includesAny(["meta", "facebook", "fb ads", "ads do facebook", "act_", "pre pago", "prepago"]);
    const wantsGoogle = includesAny([
      "google ads",
      "googleads",
      "adwords",
      "campanha",
      "pmax",
      "search",
      "gasto google"
    ]);
    const wantsGa4 = includesAny([
      "ga4",
      "analytics",
      "google analytics",
      "sessao",
      "evento",
      "conversao",
      "receita",
      "trafego",
      "visita",
      "engajamento",
      "site"
    ]);
    const wantsSpend = includesAny(["gasto", "investimento", "investir", "custo", "spend", "budget", "saldo", "limite"]);
    const wantsIntegrations = includesAny(["integracao", "conector", "token", "mcp", "status de integracao", "erro"]);
    const wantsInsights = includesAny(["insight", "detalhe", "detalhes", "ranking", "top", "estrutura", "nivel", "campanha"]);
    const wantsOverview =
      includesAny(["resumo", "dashboard", "panorama", "visao geral", "status", "situacao"]) ||
      (!wantsTasks &&
        !wantsHours &&
        !wantsMeta &&
        !wantsGoogle &&
        !wantsGa4 &&
        !wantsSpend &&
        !wantsIntegrations &&
        !wantsInsights);

    const wantsPaidMedia = wantsMeta || wantsGoogle || wantsSpend || wantsInsights;

    return {
      wantsOverview,
      wantsTasks: wantsTasks || wantsOverview || wantsTaskCreation,
      wantsTaskCreation,
      wantsHours: wantsHours || wantsOverview,
      wantsSpend,
      wantsIntegrations: wantsIntegrations || wantsOverview,
      wantsMeta: wantsMeta || wantsPaidMedia,
      wantsGoogle: wantsGoogle || wantsPaidMedia,
      wantsGa4,
      wantsInsights
    };
  }

  private shouldExecuteTool(tool: AgentToolCall, intent: AgentIntent): boolean {
    if (intent.wantsTaskCreation) {
      return tool.kind === "task_create";
    }

    if (tool.kind === "internal_tasks") {
      return intent.wantsTasks;
    }

    if (tool.kind === "external_api") {
      const normalizedPath = this.normalizeExternalPath(tool.path);
      if (normalizedPath === "/metrics/summary") {
        return true;
      }
      if (normalizedPath === "/reports/hours") {
        return intent.wantsHours;
      }
      if (normalizedPath === "/metrics/spend-overview") {
        return intent.wantsSpend || intent.wantsMeta || intent.wantsGoogle;
      }
      if (normalizedPath === "/metrics/integrations/status") {
        return intent.wantsIntegrations;
      }
      return true;
    }

    if (tool.kind === "mcp") {
      if (tool.tool === "meta_summary") {
        return intent.wantsMeta || this.hasMetaAccountId(tool.args);
      }
      if (tool.tool === "meta_insights" || tool.tool === "meta_structure") {
        return intent.wantsMeta || intent.wantsInsights || this.hasMetaAccountId(tool.args);
      }
      if (tool.tool === "meta_prepaid_balances") {
        return intent.wantsMeta || intent.wantsSpend;
      }
      if (tool.tool === "google_summary") {
        return intent.wantsGoogle || this.hasGoogleCustomerId(tool.args);
      }
      if (tool.tool === "google_insights") {
        return intent.wantsGoogle || intent.wantsInsights || this.hasGoogleCustomerId(tool.args);
      }
      if (tool.tool === "organization_summary") {
        return true;
      }
      if (tool.tool === "client_lookup") {
        return intent.wantsMeta || intent.wantsGoogle || intent.wantsOverview;
      }
      if (tool.tool === "health_check") {
        return true;
      }
      return true;
    }

    if (tool.kind === "task_create") {
      return intent.wantsTasks;
    }

    if (tool.kind === "ga4") {
      const isAuto = !tool.path || tool.path === "auto";
      if (isAuto) {
        return intent.wantsGa4;
      }
      return true;
    }

    return true;
  }

  private async resolveTools(
    orgId: string,
    prompt: string,
    tools: AgentToolCall[],
    focus: ClientFocus | null,
    intent: AgentIntent,
    requestedRange: string | null,
    actorRoles: string[],
    actorId: string,
    focusProjects?: ProjectEntity[]
  ): Promise<AgentToolResult[]> {
    if (!tools || tools.length === 0) {
      return [];
    }

    const results: AgentToolResult[] = [];

    if (intent.wantsTaskCreation) {
      const hasTaskCreate = tools.some((tool) => tool.kind === "task_create");
      if (!hasTaskCreate) {
        const totalProjects = focusProjects?.length ?? 0;
        const listedProjects = (focusProjects ?? []).slice(0, 10);
        results.push({
          id: "task_create_hint",
          kind: "internal_tasks",
          ok: true,
          summary:
            totalProjects > 0
              ? `Projetos ativos para criacao (mostrando ${listedProjects.length} de ${totalProjects})`
              : "Nenhum projeto ativo encontrado para criacao",
          data: {
            totalProjects,
            projects: listedProjects.map((project) => ({
              id: project.id,
              name: project.name,
              clientId: project.clientId
            }))
          }
        });
        return results;
      }
    }

    for (const tool of tools) {
      if (!this.shouldExecuteTool(tool, intent)) {
        continue;
      }
      const id = tool.id ?? tool.kind;
      try {
        if (tool.kind === "internal_tasks") {
          const snapshot = await this.buildTaskSnapshot(orgId, tool.limit);
          results.push({
            id,
            kind: tool.kind,
            ok: true,
            summary: `Snapshot de tarefas com ${snapshot.items.length} itens destacados`,
            data: snapshot
          });
          continue;
        }

        if (tool.kind === "external_api") {
          const externalResult = await this.executeExternalApiTool(orgId, tool);
          results.push({
            id,
            kind: tool.kind,
            ok: true,
            summary: externalResult.summary,
            data: externalResult.data
          });
          continue;
        }

        if (tool.kind === "mcp") {
          const mcpResults = await this.executeMcpTool(orgId, tool, focus, requestedRange);
          results.push(...mcpResults);
          continue;
        }

        if (tool.kind === "ga4") {
          const isAuto = !tool.path || tool.path === "auto";
          if (isAuto) {
            const ga4Results = await this.buildGa4ReportsFromClients(orgId, tool.body, focus ?? undefined);
            results.push(...ga4Results);
            continue;
          }
          const payload = await callExternalGa4({
            path: tool.path,
            method: tool.method ?? "POST",
            query: tool.query,
            body: tool.body
          });
          results.push({
            id,
            kind: tool.kind,
            ok: true,
            summary: `GA4 ${tool.path}`,
            data: payload
          });
          continue;
        }

        if (tool.kind === "task_create") {
          const created = await this.executeTaskCreate(orgId, tool, intent, actorRoles, actorId);
          results.push(created);
          continue;
        }
      } catch (error) {
        results.push({
          id,
          kind: tool.kind,
          ok: false,
          summary: `Falha ao executar ${tool.kind}`,
          error: error instanceof Error ? error.message : "Erro desconhecido"
        });
      }
    }

    return results;
  }

  private async buildTaskSnapshot(orgId: string, limit?: number) {
    const [tasks, teamMembers] = await Promise.all([
      this.tasksRepository.listAll(orgId),
      this.teamMembersRepository.list(orgId, { status: "active" })
    ]);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    let overdue = 0;
    let dueToday = 0;
    const statusCount = new Map<string, number>();

    const assigneeNameMap = new Map<string, string>();
    teamMembers.forEach((member) => {
      const displayName = member.name ?? member.email ?? member.userId ?? member.id;
      assigneeNameMap.set(member.id, displayName);
      if (member.userId) {
        assigneeNameMap.set(member.userId, displayName);
      }
    });

    const resolveAssigneeNames = (ids?: string[]) =>
      (ids ?? []).map((assigneeId) => assigneeNameMap.get(assigneeId) ?? assigneeId);

    tasks.forEach((task) => {
      statusCount.set(task.status, (statusCount.get(task.status) ?? 0) + 1);
      if (!task.dueDate) {
        return;
      }
      const isDone = task.status === "done";
      if (isDone) {
        return;
      }
      const due = task.dueDate.slice(0, 10);
      if (due < today) {
        overdue += 1;
      } else if (due === today) {
        dueToday += 1;
      }
    });

    const trimmed = [...tasks]
      .sort((a, b) => {
        const aDue = a.dueDate ?? "9999-12-31T23:59:59.999Z";
        const bDue = b.dueDate ?? "9999-12-31T23:59:59.999Z";
        if (aDue === bDue) {
          return a.createdAt.localeCompare(b.createdAt);
        }
        return aDue.localeCompare(bDue);
      })
      .slice(0, normalizeLimit(limit))
      .map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        assignees: task.assignees,
        assigneeNames: resolveAssigneeNames(task.assignees),
        dueDate: task.dueDate,
        projectId: task.projectId,
        type: task.type,
        updatedAt: task.updatedAt
      }));

    const stats = Object.fromEntries(statusCount);

    return {
      generatedAt: new Date().toISOString(),
      total: tasks.length,
      overdue,
      dueToday,
      status: stats,
      items: trimmed
    };
  }

  private hasMetaAccountId(rawArgs?: Record<string, unknown>): boolean {
    if (!rawArgs) {
      return false;
    }
    const accountId = rawArgs["accountId"] ?? rawArgs["account_id"];
    return typeof accountId === "string" && accountId.trim().length > 0;
  }

  private normalizeMetaAccountId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("act_")) {
      const digits = lower.slice(4).replace(/[^0-9]/g, "");
      return digits ? `act_${digits}` : null;
    }
    const digits = lower.replace(/[^0-9]/g, "");
    return digits ? `act_${digits}` : null;
  }

  private parseMetaArgs(
    rawArgs?: Record<string, unknown>,
    requestedRange?: string | null
  ): { accountId: string | null; range: string } {
    const accountRaw = rawArgs?.["accountId"] ?? rawArgs?.["account_id"];
    const accountId = this.normalizeMetaAccountId(accountRaw);
    const rawRange = typeof rawArgs?.["range"] === "string" ? rawArgs["range"].trim() : "";
    const range = this.pickRange(rawRange, requestedRange, "LAST_7_DAYS");
    return { accountId, range };
  }

  private async executeMetaSummary(
    rawArgs?: Record<string, unknown>,
    requestedRange?: string | null
  ): Promise<AgentToolResult> {
    const { accountId, range } = this.parseMetaArgs(rawArgs, requestedRange);
    if (!accountId) {
      return {
        id: "meta_summary",
        kind: "mcp",
        ok: false,
        summary: "Meta summary",
        error: "Informe o accountId (ex.: act_123456789012345)."
      };
    }

    try {
      const data = await this.fetchMetaSummary(accountId, range);
      return {
        id: `meta_summary_${accountId}`,
        kind: "mcp",
        ok: true,
        summary: `Meta summary ${accountId} (${range})`,
        data
      };
    } catch (error) {
      return {
        id: `meta_summary_${accountId}`,
        kind: "mcp",
        ok: false,
        summary: `Meta summary ${accountId}`,
        error: error instanceof Error ? error.message : "Falha ao consultar meta_summary",
        data: {
          source: "meta_ads",
          status: "error",
          error_message: error instanceof Error ? error.message : "Falha ao consultar meta_summary"
        }
      };
    }
  }

  private async fetchMetaSummary(accountId: string, range: string): Promise<unknown> {
    const normalized = this.normalizeMetaAccountId(accountId);
    if (!normalized) {
      throw new Error("accountId invalido. Use o formato act_123456789012345.");
    }

    const normalizedRange = range && range.length > 0 ? range : "LAST_7_DAYS";
    const mcpBody = { account_id: normalized, range: normalizedRange };
    // Prefer backend direto; se falhar, tenta o MCP com o mesmo payload.
    try {
      return await callExternalApi({
        path: `/meta/accounts/${normalized}/summary`,
        method: "GET",
        query: { range: normalizedRange }
      });
    } catch (primaryError) {
      try {
        return await callExternalMcp({
          path: "/tools/meta_summary/call",
          method: "POST",
          body: mcpBody
        });
      } catch (fallbackError) {
        const primary = primaryError instanceof Error ? primaryError.message : "Backend falhou";
        const secondary = fallbackError instanceof Error ? fallbackError.message : "MCP falhou";
        throw new Error(`${primary}; ${secondary}`);
      }
    }
  }

  private async executeMetaInsights(
    rawArgs?: Record<string, unknown>,
    requestedRange?: string | null
  ): Promise<AgentToolResult> {
    const { accountId, range } = this.parseMetaArgs(rawArgs, requestedRange);
    if (!accountId) {
      return {
        id: "meta_insights",
        kind: "mcp",
        ok: false,
        summary: "Meta insights",
        error: "Informe o accountId (ex.: act_123456789012345)."
      };
    }

    const levelRaw = typeof rawArgs?.["level"] === "string" ? rawArgs["level"].toString().toLowerCase() : "";
    const level = levelRaw === "adset" || levelRaw === "ad" ? (levelRaw as "adset" | "ad") : ("campaign" as const);
    const insightLimit =
      typeof rawArgs?.["limit"] === "number" && Number.isFinite(rawArgs["limit"])
        ? Math.min(Math.max(Math.floor(rawArgs["limit"] as number), 1), 50)
        : 5;

    try {
      const data = await callExternalMcp({
        path: "/tools/meta_insights/call",
        method: "POST",
        body: {
          account_id: accountId,
          range,
          level,
          limit: insightLimit
        }
      });
      return {
        id: `meta_insights_${accountId}`,
        kind: "mcp",
        ok: true,
        summary: `Meta insights ${accountId} (${range}, ${level})`,
        data
      };
    } catch (error) {
      return {
        id: `meta_insights_${accountId}`,
        kind: "mcp",
        ok: false,
        summary: `Meta insights ${accountId}`,
        error: error instanceof Error ? error.message : "Falha ao consultar meta_insights",
        data: {
          source: "meta_ads",
          status: "error",
          error_message: error instanceof Error ? error.message : "Falha ao consultar meta_insights"
        }
      };
    }
  }

  private async executeMetaStructure(
    rawArgs?: Record<string, unknown>,
    requestedRange?: string | null
  ): Promise<AgentToolResult> {
    const { accountId, range } = this.parseMetaArgs(rawArgs, requestedRange);
    if (!accountId) {
      return {
        id: "meta_structure",
        kind: "mcp",
        ok: false,
        summary: "Meta estrutura",
        error: "Informe o accountId (ex.: act_123456789012345)."
      };
    }

    const levelRaw = typeof rawArgs?.["level"] === "string" ? rawArgs["level"].toString().toLowerCase() : "";
    const level = levelRaw === "adset" || levelRaw === "ad" ? (levelRaw as "adset" | "ad") : ("campaign" as const);
    const structureLimit =
      typeof rawArgs?.["limit"] === "number" && Number.isFinite(rawArgs["limit"])
        ? Math.min(Math.max(Math.floor(rawArgs["limit"] as number), 1), 200)
        : 50;
    const ids = Array.isArray(rawArgs?.["ids"])
      ? (rawArgs?.["ids"] as unknown[])
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0)
      : undefined;

    try {
      const data = await callExternalMcp({
        path: "/tools/meta_structure/call",
        method: "POST",
        body: {
          account_id: accountId,
          range,
          level,
          limit: structureLimit,
          ids
        }
      });
      return {
        id: `meta_structure_${accountId}`,
        kind: "mcp",
        ok: true,
        summary: `Meta estrutura ${accountId} (${range}, ${level})`,
        data
      };
    } catch (error) {
      return {
        id: `meta_structure_${accountId}`,
        kind: "mcp",
        ok: false,
        summary: `Meta estrutura ${accountId}`,
        error: error instanceof Error ? error.message : "Falha ao consultar meta_structure",
        data: {
          source: "meta_ads",
          status: "error",
          error_message: error instanceof Error ? error.message : "Falha ao consultar meta_structure"
        }
      };
    }
  }

  private async executeGoogleSummary(
    rawArgs?: Record<string, unknown>,
    requestedRange?: string | null
  ): Promise<AgentToolResult> {
    const parsed = this.parseGoogleArgs(rawArgs, requestedRange);
    if (!parsed.customerId) {
      return {
        id: "google_summary",
        kind: "mcp",
        ok: false,
        summary: "Google summary",
        error: "Informe o customer_id (ex.: 123-456-7890)."
      };
    }

    try {
      const data = await callExternalMcp({
        path: "/tools/google_summary/call",
        method: "POST",
        body: {
          customer_id: parsed.customerId,
          range: parsed.range,
          login_customer_id: parsed.loginCustomerId
        }
      });
      return {
        id: `google_summary_${parsed.customerId}`,
        kind: "mcp",
        ok: true,
        summary: `Google summary ${parsed.customerId} (${parsed.range})`,
        data
      };
    } catch (error) {
      return {
        id: `google_summary_${parsed.customerId}`,
        kind: "mcp",
        ok: false,
        summary: `Google summary ${parsed.customerId}`,
        error: error instanceof Error ? error.message : "Falha ao consultar google_summary",
        data: {
          source: "google_ads",
          status: "error",
          error_message: error instanceof Error ? error.message : "Falha ao consultar google_summary"
        }
      };
    }
  }

  private async executeGoogleInsights(
    rawArgs?: Record<string, unknown>,
    requestedRange?: string | null
  ): Promise<AgentToolResult> {
    const parsed = this.parseGoogleArgs(rawArgs, requestedRange);
    if (!parsed.customerId) {
      return {
        id: "google_insights",
        kind: "mcp",
        ok: false,
        summary: "Google insights",
        error: "Informe o customer_id (ex.: 123-456-7890)."
      };
    }

    const insightLimit = parsed.limit ?? 5;
    try {
      const data = await callExternalMcp({
        path: "/tools/google_insights/call",
        method: "POST",
        body: {
          customer_id: parsed.customerId,
          range: parsed.range,
          limit: insightLimit,
          login_customer_id: parsed.loginCustomerId
        }
      });
      return {
        id: `google_insights_${parsed.customerId}`,
        kind: "mcp",
        ok: true,
        summary: `Google insights ${parsed.customerId} (${parsed.range})`,
        data
      };
    } catch (error) {
      return {
        id: `google_insights_${parsed.customerId}`,
        kind: "mcp",
        ok: false,
        summary: `Google insights ${parsed.customerId}`,
        error: error instanceof Error ? error.message : "Falha ao consultar google_insights",
        data: {
          source: "google_ads",
          status: "error",
          error_message: error instanceof Error ? error.message : "Falha ao consultar google_insights"
        }
      };
    }
  }

  private async executeOrganizationSummary(
    rawArgs: Record<string, unknown> | undefined,
    orgId: string
  ): Promise<AgentToolResult> {
    const organization =
      typeof rawArgs?.["organization"] === "string" && rawArgs["organization"].trim().length > 0
        ? rawArgs["organization"].trim()
        : orgId;
    const range = typeof rawArgs?.["range"] === "string" && rawArgs["range"].trim().length > 0 ? rawArgs["range"].trim() : "LAST_7_DAYS";
    const campaignLimit =
      typeof rawArgs?.["campaign_limit"] === "number" && Number.isFinite(rawArgs?.["campaign_limit"])
        ? Math.min(Math.max(Math.floor(rawArgs?.["campaign_limit"] as number), 1), 20)
        : 5;
    const includeCampaigns = rawArgs?.["include_campaigns"] !== false;
    const metaLevelRaw = typeof rawArgs?.["meta_level"] === "string" ? rawArgs["meta_level"].toString().toLowerCase() : "";
    const metaLevel = metaLevelRaw === "adset" || metaLevelRaw === "ad" ? metaLevelRaw : "campaign";
    const loginCustomerId =
      typeof rawArgs?.["login_customer_id"] === "string" && rawArgs["login_customer_id"].trim().length > 0
        ? rawArgs["login_customer_id"].trim()
        : undefined;

    try {
      const data = await callExternalMcp({
        path: "/tools/organization_summary/call",
        method: "POST",
        body: {
          organization,
          range,
          campaign_limit: campaignLimit,
          include_campaigns: includeCampaigns,
          meta_level: metaLevel,
          login_customer_id: loginCustomerId
        }
      });
      return {
        id: "organization_summary",
        kind: "mcp",
        ok: true,
        summary: `Organization summary (${organization}, ${range})`,
        data
      };
    } catch (error) {
      return {
        id: "organization_summary",
        kind: "mcp",
        ok: false,
        summary: `Organization summary (${organization})`,
        error: error instanceof Error ? error.message : "Falha ao consultar organization_summary"
      };
    }
  }

  private async buildMetaSummariesFromClients(
    orgId: string,
    rawArgs?: Record<string, unknown>,
    focus?: ClientFocus,
    requestedRange?: string | null
  ): Promise<AgentToolResult[]> {
    const rawLimit = rawArgs?.["limit"];
    const limit =
      typeof rawLimit === "number" && Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.floor(rawLimit), 1), 5)
        : 2;
    const rawRange = rawArgs?.["range"];
    const range = this.pickRange(typeof rawRange === "string" ? rawRange : undefined, requestedRange, "LAST_7_DAYS");

    const accounts = await this.buildMetaAccountIndex(orgId, focus);

    const selectedAccounts = Array.from(accounts.entries()).slice(0, limit);
    if (selectedAccounts.length === 0) {
      return [
        {
          id: "meta_summary",
          kind: "mcp",
          ok: false,
          summary: "Resumo Meta",
          error: "Nenhuma conta Meta Ads configurada para este tenant."
        }
      ];
    }

    const results: AgentToolResult[] = [];
    for (const [accountId, meta] of selectedAccounts) {
      try {
        const result = await this.fetchMetaSummary(accountId, range);
        results.push({
          id: `meta_summary_${accountId}`,
          kind: "mcp",
          ok: true,
          summary: `Meta summary ${accountId}${meta.clientName ? ` (${meta.clientName})` : ""} (${range})`,
          data: result
        });
      } catch (error) {
        results.push({
          id: `meta_summary_${accountId}`,
          kind: "mcp",
          ok: false,
          summary: `Meta summary ${accountId}`,
          error: error instanceof Error ? error.message : "Falha ao consultar meta_summary"
        });
      }
    }

    return results;
  }

  private hasGoogleCustomerId(rawArgs?: Record<string, unknown>): boolean {
    if (!rawArgs) {
      return false;
    }
    const customerId = rawArgs["customerId"] ?? rawArgs["customer_id"];
    return typeof customerId === "string" && customerId.trim().length > 0;
  }

  private normalizeGoogleCustomerId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const digits = value.replace(/[^0-9]/g, "");
    if (digits.length < 5) {
      return null;
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return digits;
  }

  private parseGoogleArgs(
    rawArgs?: Record<string, unknown>,
    requestedRange?: string | null
  ): { customerId: string | null; loginCustomerId?: string; range: string; limit?: number; offset?: number } {
    const rawCustomer = rawArgs?.["customerId"] ?? rawArgs?.["customer_id"];
    const customerId = this.normalizeGoogleCustomerId(rawCustomer);
    const rawLogin = rawArgs?.["loginCustomerId"] ?? rawArgs?.["login_customer_id"];
    const loginCustomerId =
      typeof rawLogin === "string" && rawLogin.trim().length > 0 ? this.normalizeGoogleCustomerId(rawLogin) ?? rawLogin.trim() : undefined;
    const rawRange = typeof rawArgs?.["range"] === "string" ? rawArgs["range"].trim() : "";
    const range = this.pickRange(rawRange, requestedRange, "LAST_7_DAYS");
    const rawLimit = rawArgs?.["limit"];
    const rawOffset = rawArgs?.["offset"];
    const limit = typeof rawLimit === "number" && Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 50) : undefined;
    const offset =
      typeof rawOffset === "number" && Number.isFinite(rawOffset) ? Math.min(Math.max(Math.floor(rawOffset), 0), 500) : undefined;
    return { customerId, loginCustomerId, range, limit, offset };
  }

  private normalizeGa4PropertyId(value: unknown): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (trimmed.startsWith("properties/")) {
      return trimmed;
    }
    return `properties/${trimmed}`;
  }

  private ensureRecord(value: unknown): Record<string, unknown> | undefined {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return undefined;
    }
    return value as Record<string, unknown>;
  }

  private parseLimit(raw?: unknown, fallback = 2, max = 5): number {
    if (typeof raw !== "number" || Number.isNaN(raw)) {
      return fallback;
    }
    const parsed = Math.floor(raw);
    if (parsed < 1) {
      return fallback;
    }
    return Math.min(parsed, max);
  }

  private async buildGoogleSummariesFromClients(
    orgId: string,
    rawArgs?: Record<string, unknown>,
    focus?: ClientFocus,
    requestedRange?: string | null
  ): Promise<AgentToolResult[]> {
    const limit = this.parseLimit(rawArgs?.["limit"], 2);
    const parsed = this.parseGoogleArgs(rawArgs, requestedRange);
    const range = parsed.range;
    const loginCustomerId = parsed.loginCustomerId;

    const accounts = await this.buildGoogleAccountIndex(orgId, focus);

    const selectedAccounts = Array.from(accounts.entries()).slice(0, limit);
    if (selectedAccounts.length === 0) {
      return [
        {
          id: "google_summary",
          kind: "mcp",
          ok: false,
          summary: "Resumo Google Ads",
          error: "Nenhuma conta Google Ads configurada para este tenant."
        }
      ];
    }

    const results: AgentToolResult[] = [];
    for (const [customerId, meta] of selectedAccounts) {
      try {
        const response = await callExternalMcp({
          path: "/tools/google_summary/call",
          method: "POST",
          body: {
            customer_id: customerId,
            range,
            login_customer_id: loginCustomerId
          }
        });

        results.push({
          id: `google_summary_${customerId}`,
          kind: "mcp",
          ok: true,
          summary: `Google summary ${customerId}${meta.clientName ? ` (${meta.clientName})` : ""} (${range})`,
          data: response
        });
      } catch (error) {
        results.push({
          id: `google_summary_${customerId}`,
          kind: "mcp",
          ok: false,
          summary: `Google summary ${customerId}`,
          error: error instanceof Error ? error.message : "Falha ao consultar google_summary"
        });
      }
    }

    return results;
  }

  private async buildMetaInsightsFromClients(
    orgId: string,
    rawArgs?: Record<string, unknown>,
    focus?: ClientFocus,
    requestedRange?: string | null
  ): Promise<AgentToolResult[]> {
    const rawLimit = rawArgs?.["limit"];
    const limit =
      typeof rawLimit === "number" && Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.floor(rawLimit), 1), 5)
        : 2;
    const { range } = this.parseMetaArgs(rawArgs, requestedRange);
    const levelRaw = typeof rawArgs?.["level"] === "string" ? rawArgs["level"].toString().toLowerCase() : "";
    const level = levelRaw === "adset" || levelRaw === "ad" ? (levelRaw as "adset" | "ad") : ("campaign" as const);
    const metaLimit =
      typeof rawArgs?.["insightLimit"] === "number" && Number.isFinite(rawArgs?.["insightLimit"])
        ? Math.min(Math.max(Math.floor(rawArgs?.["insightLimit"] as number), 1), 50)
        : 5;

    const accounts = await this.buildMetaAccountIndex(orgId, focus);

    const selectedAccounts = Array.from(accounts.entries()).slice(0, limit);
    if (selectedAccounts.length === 0) {
      return [
        {
          id: "meta_insights",
          kind: "mcp",
          ok: false,
          summary: "Insights Meta Ads",
          error: "Nenhuma conta Meta Ads configurada para este tenant."
        }
      ];
    }

    const results: AgentToolResult[] = [];
    for (const [accountId, meta] of selectedAccounts) {
      try {
        const response = await callExternalMcp({
          path: "/tools/meta_insights/call",
          method: "POST",
          body: {
            account_id: accountId,
            range,
            level,
            limit: metaLimit
          }
        });

        results.push({
          id: `meta_insights_${accountId}`,
          kind: "mcp",
          ok: true,
          summary: `Meta insights ${accountId}${meta.clientName ? ` (${meta.clientName})` : ""} (${range}, ${level})`,
          data: response
        });
      } catch (error) {
        results.push({
          id: `meta_insights_${accountId}`,
          kind: "mcp",
          ok: false,
          summary: `Meta insights ${accountId}`,
          error: error instanceof Error ? error.message : "Falha ao consultar meta_insights",
          data: {
            source: "meta_ads",
            status: "error",
            error_message: error instanceof Error ? error.message : "Falha ao consultar meta_insights"
          }
        });
      }
    }

    return results;
  }

  private async buildMetaStructureFromClients(
    orgId: string,
    rawArgs?: Record<string, unknown>,
    focus?: ClientFocus,
    requestedRange?: string | null
  ): Promise<AgentToolResult[]> {
    const rawLimit = rawArgs?.["limit"];
    const limit =
      typeof rawLimit === "number" && Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.floor(rawLimit), 1), 5)
        : 2;
    const { range } = this.parseMetaArgs(rawArgs, requestedRange);
    const levelRaw = typeof rawArgs?.["level"] === "string" ? rawArgs["level"].toString().toLowerCase() : "";
    const level = levelRaw === "adset" || levelRaw === "ad" ? (levelRaw as "adset" | "ad") : ("campaign" as const);
    const metaLimit =
      typeof rawArgs?.["structureLimit"] === "number" && Number.isFinite(rawArgs?.["structureLimit"])
        ? Math.min(Math.max(Math.floor(rawArgs?.["structureLimit"] as number), 1), 200)
        : 50;
    const ids = Array.isArray(rawArgs?.["ids"])
      ? (rawArgs?.["ids"] as unknown[])
          .map((item) => (typeof item === "string" ? item.trim() : ""))
          .filter((item) => item.length > 0)
      : undefined;

    const accounts = await this.buildMetaAccountIndex(orgId, focus);

    const selectedAccounts = Array.from(accounts.entries()).slice(0, limit);
    if (selectedAccounts.length === 0) {
      return [
        {
          id: "meta_structure",
          kind: "mcp",
          ok: false,
          summary: "Estrutura Meta Ads",
          error: "Nenhuma conta Meta Ads configurada para este tenant."
        }
      ];
    }

    const results: AgentToolResult[] = [];
    for (const [accountId, meta] of selectedAccounts) {
      try {
        const response = await callExternalMcp({
          path: "/tools/meta_structure/call",
          method: "POST",
          body: {
            account_id: accountId,
            range,
            level,
            limit: metaLimit,
            ids
          }
        });

        results.push({
          id: `meta_structure_${accountId}`,
          kind: "mcp",
          ok: true,
          summary: `Meta estrutura ${accountId}${meta.clientName ? ` (${meta.clientName})` : ""} (${range}, ${level})`,
          data: response
        });
      } catch (error) {
        results.push({
          id: `meta_structure_${accountId}`,
          kind: "mcp",
          ok: false,
          summary: `Meta estrutura ${accountId}`,
          error: error instanceof Error ? error.message : "Falha ao consultar meta_structure"
        });
      }
    }

    return results;
  }

  private async buildGoogleInsightsFromClients(
    orgId: string,
    rawArgs?: Record<string, unknown>,
    focus?: ClientFocus,
    requestedRange?: string | null
  ): Promise<AgentToolResult[]> {
    const limit = this.parseLimit(rawArgs?.["limit"], 2);
    const parsed = this.parseGoogleArgs(rawArgs, requestedRange);
    const range = parsed.range;
    const loginCustomerId = parsed.loginCustomerId;
    const insightLimit = parsed.limit ?? 5;

    const accounts = await this.buildGoogleAccountIndex(orgId, focus);

    const selectedAccounts = Array.from(accounts.entries()).slice(0, limit);
    if (selectedAccounts.length === 0) {
      return [
        {
          id: "google_insights",
          kind: "mcp",
          ok: false,
          summary: "Insights Google Ads",
          error: "Nenhuma conta Google Ads configurada para este tenant."
        }
      ];
    }

    const results: AgentToolResult[] = [];
    for (const [customerId, meta] of selectedAccounts) {
      try {
        const response = await callExternalMcp({
          path: "/tools/google_insights/call",
          method: "POST",
          body: {
            customer_id: customerId,
            range,
            limit: insightLimit,
            login_customer_id: loginCustomerId
          }
        });

        results.push({
          id: `google_insights_${customerId}`,
          kind: "mcp",
          ok: true,
          summary: `Google insights ${customerId}${meta.clientName ? ` (${meta.clientName})` : ""} (${range})`,
          data: response
        });
      } catch (error) {
        results.push({
          id: `google_insights_${customerId}`,
          kind: "mcp",
          ok: false,
          summary: `Google insights ${customerId}`,
          error: error instanceof Error ? error.message : "Falha ao consultar google_insights"
        });
      }
    }

    return results;
  }

  private async executeMcpTool(
    orgId: string,
    tool: Extract<AgentToolCall, { kind: "mcp" }>,
    focus: ClientFocus | null,
    requestedRange: string | null
  ): Promise<AgentToolResult[]> {
    switch (tool.tool) {
      case "health_check": {
        const response = await callExternalMcp({
          path: "/tools/health_check/call",
          method: "POST",
          body: tool.args ?? {}
        });
        return [
          {
            id: tool.id ?? "health_check",
            kind: "mcp",
            ok: true,
            summary: "MCP health_check",
            data: response
          }
        ];
      }
      case "client_lookup": {
        const q = typeof tool.args?.["q"] === "string" ? tool.args["q"].trim() : "";
        const platform = typeof tool.args?.["platform"] === "string" ? tool.args["platform"] : undefined;
        if (!q) {
          return [
            {
              id: tool.id ?? "client_lookup",
              kind: "mcp",
              ok: false,
              summary: "Client lookup",
              error: "Informe 'q' para buscar clientes."
            }
          ];
        }
        const limit = this.parseLimit(tool.args?.["limit"], 5);
        const offset =
          typeof tool.args?.["offset"] === "number" && Number.isFinite(tool.args?.["offset"])
            ? Math.max(Math.floor(tool.args?.["offset"] as number), 0)
            : 0;
        const response = await callExternalMcp({
          path: "/tools/client_lookup/call",
          method: "POST",
          body: {
            q,
            platform,
            limit,
            offset
          }
        });
        return [
          {
            id: tool.id ?? "client_lookup",
            kind: "mcp",
            ok: true,
            summary: `Client lookup (${q})`,
            data: response
          }
        ];
      }
      case "meta_summary": {
        if (!this.hasMetaAccountId(tool.args)) {
          return await this.buildMetaSummariesFromClients(orgId, tool.args, focus ?? undefined, requestedRange);
        }
        return [await this.executeMetaSummary(tool.args, requestedRange)];
      }
      case "meta_insights": {
        if (!this.hasMetaAccountId(tool.args)) {
          return await this.buildMetaInsightsFromClients(orgId, tool.args, focus ?? undefined, requestedRange);
        }
        return [await this.executeMetaInsights(tool.args, requestedRange)];
      }
      case "meta_structure": {
        if (!this.hasMetaAccountId(tool.args)) {
          return await this.buildMetaStructureFromClients(orgId, tool.args, focus ?? undefined, requestedRange);
        }
        return [await this.executeMetaStructure(tool.args, requestedRange)];
      }
      case "meta_prepaid_balances": {
        const response = await callExternalMcp({
          path: "/tools/meta_prepaid_balances/call",
          method: "POST",
          body: {}
        });
        return [
          {
            id: tool.id ?? "meta_prepaid_balances",
            kind: "mcp",
            ok: true,
            summary: "Saldos pré-pago Meta",
            data: response
          }
        ];
      }
      case "google_summary": {
        if (!this.hasGoogleCustomerId(tool.args)) {
          return await this.buildGoogleSummariesFromClients(orgId, tool.args, focus ?? undefined, requestedRange);
        }
        return [await this.executeGoogleSummary(tool.args, requestedRange)];
      }
      case "google_insights": {
        if (!this.hasGoogleCustomerId(tool.args)) {
          return await this.buildGoogleInsightsFromClients(orgId, tool.args, focus ?? undefined, requestedRange);
        }
        return [await this.executeGoogleInsights(tool.args, requestedRange)];
      }
      case "organization_summary": {
        return [await this.executeOrganizationSummary(tool.args, orgId)];
      }
      default: {
        const response = await callExternalMcp({
          path: `/tools/${tool.tool}/call`,
          method: "POST",
          body: { args: tool.args ?? {} }
        });
        return [
          {
            id: tool.id ?? tool.tool,
            kind: "mcp",
            ok: true,
            summary: `MCP ${tool.tool}`,
            data: response
          }
        ];
      }
    }
  }

  private async buildGa4ReportsFromClients(
    orgId: string,
    rawConfig?: unknown,
    focus?: ClientFocus
  ): Promise<AgentToolResult[]> {
    const config = this.ensureRecord(rawConfig);
    const limit = this.parseLimit(config?.["limit"], 1, 3);
    const lookbackDaysRaw = config?.["days"];
    const lookbackDays =
      typeof lookbackDaysRaw === "number" && Number.isFinite(lookbackDaysRaw)
        ? Math.min(Math.max(Math.floor(lookbackDaysRaw), 1), 30)
        : 7;
    const endDate = this.formatDateInTimeZone(new Date(Date.now() - DAY_IN_MS));
    const startDate = this.formatDateInTimeZone(new Date(Date.now() - lookbackDays * DAY_IN_MS));

    const properties = await this.buildGa4PropertyIndex(orgId, focus);

    const selected = Array.from(properties.entries()).slice(0, limit);
    if (selected.length === 0) {
      return [
        {
          id: "ga4_auto",
          kind: "ga4",
          ok: false,
          summary: "Resumo GA4",
          error: "Nenhuma propriedade GA4 configurada para este tenant."
        }
      ];
    }

    const results: AgentToolResult[] = [];
    for (const [propertyId, meta] of selected) {
      try {
        const normalizedPath = propertyId.startsWith("properties/")
          ? `/ga4/${propertyId}/runReport`
          : `/ga4/properties/${propertyId}/runReport`;
        const response = await callExternalGa4({
          path: normalizedPath,
          method: "POST",
          body: {
            dimensions: [{ name: "date" }],
            metrics: GA4_TOOL_METRICS.map((name) => ({ name })),
            dateRanges: [
              {
                startDate,
                endDate
              }
            ],
            limit: 1000
          }
        });

        results.push({
          id: `ga4_${propertyId}`,
          kind: "ga4",
          ok: true,
          summary: `GA4 ${propertyId}${meta.clientName ? ` (${meta.clientName})` : ""} (${startDate} a ${endDate})`,
          data: response
        });
      } catch (error) {
        results.push({
          id: `ga4_${propertyId}`,
          kind: "ga4",
          ok: false,
          summary: `GA4 ${propertyId}`,
          error: error instanceof Error ? error.message : "Falha ao consultar GA4"
        });
      }
    }

    return results;
  }

  private async executeTaskCreate(
    orgId: string,
    tool: Extract<AgentToolCall, { kind: "task_create" }>,
    intent: AgentIntent,
    actorRoles: string[],
    actorId: string
  ): Promise<AgentToolResult> {
    const canWrite = actorRoles.some((role) => ["gestor", "analista"].includes(role));
    if (!canWrite) {
      return {
        id: tool.id ?? "task_create",
        kind: "task_create",
        ok: false,
        summary: "Criacao de tarefa",
        error: "Permissao insuficiente para criar tarefas."
      };
    }

    try {
      const project = await this.projectsRepository.findById(orgId, tool.projectId);
      if (!project) {
        return {
          id: tool.id ?? "task_create",
          kind: "task_create",
          ok: false,
          summary: "Criacao de tarefa",
          error: "Projeto nao encontrado para este tenant."
        };
      }

      const status: TaskStatus = tool.status ?? "todo";
      const type: TaskType = tool.type ?? "other";
      const dueDate = tool.dueDate ? new Date(tool.dueDate).toISOString() : null;
      const assignees = Array.isArray(tool.assignees) ? tool.assignees.slice(0, 5) : [];
      const payload = {
        title: tool.title,
        description: tool.description ?? null,
        status,
        type,
        assignees,
        dueDate
      };

      const created = await this.tasksRepository.create(orgId, tool.projectId, payload, actorId);

      return {
        id: tool.id ?? "task_create",
        kind: "task_create",
        ok: true,
        summary: `Tarefa criada no projeto ${project.name}`,
        data: {
          projectId: created.projectId,
          title: created.title,
          status: created.status,
          type: created.type,
          dueDate: created.dueDate,
          assignees: created.assignees,
          id: created.id
        }
      };
    } catch (error) {
      return {
        id: tool.id ?? "task_create",
        kind: "task_create",
        ok: false,
        summary: "Criacao de tarefa",
        error: error instanceof Error ? error.message : "Falha ao criar tarefa"
      };
    }
  }

  private async executeExternalApiTool(
    orgId: string,
    tool: Extract<AgentToolCall, { kind: "external_api" }>
  ): Promise<{ summary: string; data: unknown }> {
    const normalizedPath = this.normalizeExternalPath(tool.path);
    const taskoraResult = await this.tryResolveTaskoraPath(orgId, normalizedPath, tool);
    if (taskoraResult) {
      return taskoraResult;
    }

    const payload = await callExternalApi({
      path: tool.path,
      method: tool.method ?? "GET",
      query: tool.query,
      body: tool.body
    });

    return {
      summary: `Resposta de ${tool.method ?? "GET"} ${tool.path}`,
      data: payload
    };
  }

  private async tryResolveTaskoraPath(
    orgId: string,
    normalizedPath: string,
    tool: Extract<AgentToolCall, { kind: "external_api" }>
  ): Promise<{ summary: string; data: unknown } | null> {
    switch (normalizedPath) {
      case "/metrics/summary": {
        const data = await getMetricsSummarySnapshot(orgId);
        return {
          summary: "Resumo operacional (Taskora)",
          data
        };
      }
      case "/metrics/spend-overview": {
        const data = await getSpendOverviewSnapshot(orgId);
        return {
          summary: "Spend overview (Taskora)",
          data
        };
      }
      case "/metrics/integrations/status": {
        const data = await getIntegrationStatusSnapshot(orgId);
        return {
          summary: "Status de integrações (Taskora)",
          data
        };
      }
      case "/reports/hours": {
        const filters = this.parseHoursFilters(tool.query);
        const data = await getHoursReport(orgId, filters);
        return {
          summary: `Horas registradas ${this.describeHoursWindow(filters)}`,
          data
        };
      }
      default:
        return null;
    }
  }

  private parseHoursFilters(
    query: Record<string, string | number | boolean | undefined> | undefined
  ): HoursReportFilters {
    if (!query) {
      return {};
    }

    const filters: HoursReportFilters = {};
    const startDate = this.toOptionalString(query.startDate);
    if (startDate) {
      filters.startDate = startDate;
    }
    const endDate = this.toOptionalString(query.endDate);
    if (endDate) {
      filters.endDate = endDate;
    }
    const projectId = this.toOptionalString(query.projectId);
    if (projectId) {
      filters.projectId = projectId;
    }
    const userId = this.toOptionalString(query.userId);
    if (userId) {
      filters.userId = userId;
    }
    const groupBy = this.toOptionalString(query.groupBy);
    if (groupBy === "day") {
      filters.groupBy = "day";
    }

    return filters;
  }

  private pickRange(rawRange: string | undefined, requestedRange: string | null | undefined, fallback: string): string {
    const normalizedRequested = this.normalizeRange(requestedRange ?? undefined);
    if (normalizedRequested) {
      return normalizedRequested;
    }
    const normalizedRaw = this.normalizeRange(rawRange);
    if (normalizedRaw) {
      return normalizedRaw;
    }
    return this.normalizeRange(fallback) ?? fallback;
  }

  private normalizeRange(value: string | undefined): string | null {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    if (/^custom:/i.test(trimmed)) {
      const parts = trimmed.split(":");
      if (parts.length >= 3) {
        return `CUSTOM:${parts[1]}:${parts[2]}`;
      }
      return trimmed.toUpperCase();
    }
    return trimmed.toUpperCase();
  }

  private detectRequestedRange(prompt: string): RequestedRange | null {
    const normalized = this.normalizeText(prompt);
    const match = normalized.match(/(\d{1,3})\s*dias?/);
    if (match) {
      const days = parseInt(match[1], 10);
      if (Number.isFinite(days) && days >= 1 && days <= 120) {
        return this.buildLastNDaysRange(days);
      }
    }
    return null;
  }

  private describeHoursWindow(filters: HoursReportFilters): string {
    if (filters.startDate && filters.endDate) {
      if (filters.startDate === filters.endDate) {
        return `(${filters.startDate})`;
      }
      return `(${filters.startDate} a ${filters.endDate})`;
    }
    if (filters.startDate || filters.endDate) {
      return `(${filters.startDate ?? filters.endDate})`;
    }
    return "(intervalo padrao)";
  }

  private normalizeExternalPath(path: string): string {
    if (!path) {
      return "/";
    }
    return path.startsWith("/") ? path : `/${path}`;
  }

  private toOptionalString(value: string | number | boolean | undefined): string | undefined {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return undefined;
  }

  private formatDateInTimeZone(date: Date): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  private buildLastNDaysRange(days: number): RequestedRange {
    const safeDays = Math.max(1, Math.min(Math.floor(days), 120));
    const endDate = this.formatDateInTimeZone(new Date());
    const startDate = this.formatDateInTimeZone(new Date(Date.now() - (safeDays - 1) * DAY_IN_MS));
    return {
      range: `CUSTOM:${startDate}:${endDate}`,
      startDate,
      endDate,
      days: safeDays
    };
  }

  private async callVertex(
    prompt: string,
    context: AgentToolResult[],
    actorId: string,
    actorRoles: string[],
    orgId: string,
    history?: AgentHistoryEntry[],
    focus?: ClientFocus | null,
    requestedRange?: RequestedRange | null,
    focusProjects?: Array<{ id: string; name: string; status: string; clientId: string }>,
    wantsTaskCreation?: boolean
  ): Promise<AgentResponsePayload> {
    const oauthUrl = vertexProjectId
      ? `${vertexBaseUrl}/projects/${vertexProjectId}/locations/${vertexLocation}/publishers/google/models/${env.VERTEX_MODEL}:generateContent`
      : null;
    const payload = {
      systemInstruction: {
        role: "system",
        parts: [
          {
            text: this.buildSystemPrompt()
          }
        ]
      },
      contents: this.buildConversationContents(
        prompt,
        context,
        actorId,
        actorRoles,
        orgId,
        history,
        focus ?? undefined,
        requestedRange ?? undefined,
        focusProjects ?? undefined,
        wantsTaskCreation ?? false
      )
    };

    let lastError: Error | null = null;
    const payloadJson = JSON.stringify(payload);

    if (oauthUrl) {
      const accessToken = await getVertexAccessToken();
      if (accessToken) {
        try {
          const json = await this.sendVertexWithRetry(async () => {
            return fetch(oauthUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`
              },
              body: payloadJson
            });
          });
          return this.buildVertexSuccessResponse(json);
        } catch (error) {
          lastError = error as Error;
          console.warn("[agent] Vertex OAuth call failed:", lastError.message);
        }
      } else {
        lastError = new Error("Credenciais do Vertex via OAuth indispon?veis.");
        console.warn("[agent] Vertex OAuth token unavailable.");
      }
    } else if (!env.VERTEX_API_KEY) {
      lastError = new Error("Credenciais do Vertex n?o est?o configuradas (VERTEX_PROJECT_ID ausente).");
    }

    if (env.VERTEX_API_KEY) {
      const apiBase = vertexBaseUrl.includes("generativelanguage")
        ? vertexBaseUrl
        : vertexApiKeyFallbackBaseUrl;
      const sanitizedBase = apiBase.replace(/\/$/, "");
      const modelName = buildApiKeyModelName(env.VERTEX_MODEL);
      const apiKeyUrl = `${sanitizedBase}/${modelName}:generateContent?key=${encodeURIComponent(
        env.VERTEX_API_KEY
      )}`;

      try {
        const json = await this.sendVertexWithRetry(async () => {
          return fetch(apiKeyUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: payloadJson
          });
        });
        return this.buildVertexSuccessResponse(json);
      } catch (error) {
        lastError = error as Error;
        console.warn("[agent] Vertex API key fallback failed:", lastError.message);
      }
    }

    const reason = lastError?.message ?? "Credenciais do Vertex n?o est?o configuradas neste ambiente.";
    return {
      provider: "vertex",
      model: env.VERTEX_MODEL,
      text: this.buildStubResponse(prompt, context, reason),
      stubbed: true,
      finishReason: "missing_vertex_credentials"
    };
  }

  private buildVertexSuccessResponse(json: unknown): AgentResponsePayload {
    const text = extractVertexText(json);
    let finishReason: string | null = null;
    const candidates = (json as Record<string, unknown>)["candidates"];
    if (Array.isArray(candidates) && candidates.length > 0 && typeof candidates[0] === "object") {
      const candidate = candidates[0] as Record<string, unknown>;
      const finish = candidate["finishReason"];
      if (typeof finish === "string") {
        finishReason = finish;
      }
    }

    return {
      provider: "vertex",
      model: env.VERTEX_MODEL,
      text: text || "Sem resposta do Vertex.",
      stubbed: false,
      finishReason,
      usage: (json as Record<string, unknown>)["usageMetadata"] ?? null,
      raw: json
    };
  }

  private buildSystemPrompt(): string {
    return [
      "Voce e o copiloto operacional do Taskora e responde em portugues do Brasil, com tom humano e direto.",
      "Use apenas os dados presentes nos blocos de contexto. Nao invente numeros, datas, IDs ou mensagens de erro.",
      "Se faltarem blocos ou se algum bloco trouxer status de erro, diga que nao conseguiu consultar aquela fonte e nao apresente metricas para ela.",
      "Nao interprete datas relativas por conta propria. Use apenas start_date e end_date explicitos enviados pelo backend e mencione o periodo exatamente como recebido.",
      "Para metricas de Meta/Google/GA4: so use IDs de contas presentes no contexto. Se nao houver IDs ou projetos, peca o nome do cliente ou projeto antes de prosseguir.",
      "Para criar tarefa: sempre confirme projeto e titulo antes de criar. Se nao tiver projectId, peca ao usuario para escolher um dos projetos listados ou informe o cliente/projeto. Se houver lista de projetos, apresente ate 5 opcoes numeradas e peca o numero escolhido. Se o titulo nao estiver claro, pergunte pelo menos o nome da tarefa; prazo e responsaveis sao desejaveis, mas opcionais.",
      "Jamais mencione variaveis internas, tabelas ou nomes de ferramentas; fale como analista de marketing.",
      "Formato sugerido: Periodo analisado; plataformas (Meta Ads, Google Ads, GA4) com apenas metricas recebidas; resumo curto; proximos passos opcionais.",
      "Se nao houver dados estruturados das ferramentas, assuma que nao sabe em vez de preencher com estimativas.",
      "Evite jargoes tecnicos e mantenha as respostas concisas."
    ].join("\n");
  }

  private buildUserPrompt(
    prompt: string,
    context: AgentToolResult[],
    actorId: string,
    actorRoles: string[],
    orgId: string,
    focus?: ClientFocus,
    requestedRange?: RequestedRange,
    focusProjects?: Array<{ id: string; name: string }>,
    wantsTaskCreation?: boolean
  ): string {
    const trimmedPrompt = prompt.trim();
    const greeting = isGreetingPrompt(trimmedPrompt);
    const contextBlock =
      context.length > 0
        ? `Contexto carregado (${context.length} blocos):
${safeJson(
            context.map((item) => ({
              id: item.id,
              kind: item.kind,
              ok: item.ok,
              summary: item.summary,
              data: item.data ?? item.error ?? null
            }))
          )}`
        : "Nenhum contexto adicional carregado para esta pergunta.";

    const roles = actorRoles.length > 0 ? actorRoles.join(", ") : "sem papeis definidos";
    const sections = [
      `${contextBlock}`,
      `Usuario autenticado: ${actorId} (orgId=${orgId}, roles=${roles}).`,
      `Pergunta: ${prompt}`
    ];
    if (greeting) {
      sections.push(`Principais ferramentas disponiveis:
${ASSISTANT_CAPABILITIES}`);
    }
    if (focus) {
      sections.push(`Cliente em foco detectado automaticamente: ${focus.clientName ?? focus.clientId}.`);
    }
    if (focusProjects && focusProjects.length > 0) {
      const maxProjects = 5;
      const visible = focusProjects.slice(0, maxProjects);
      const extraCount = focusProjects.length - visible.length;
      const list = visible.map((p, index) => `${index + 1}) ${p.name} (id=${p.id})`).join("\\n");
      const extraLabel = extraCount > 0 ? `\\n+${extraCount} outros projetos ativos nao listados` : "";
      sections.push(
        `Projetos ativos para criar a tarefa (escolha pelo numero e confirme o titulo/prazo):\\n${list}${extraLabel}`
      );
    } else if (wantsTaskCreation) {
      sections.push("Nenhum projeto ativo encontrado para criar tarefa. Crie um projeto ou informe o cliente/projeto.");
    }
    if (requestedRange) {
      sections.push(
        `Periodo solicitado: ${requestedRange.startDate} a ${requestedRange.endDate} (timezone ${TIMEZONE}). Use exatamente essas datas e nao interprete datas relativas por conta propria.`
      );
    }
    sections.push(
      "Se nao houver blocos de dados ou se algum bloco estiver com status de erro, responda informando que nao foi possivel consultar aquela fonte e nao invente numeros, datas ou IDs."
    );
    sections.push(
      "Responda em tom humano, cite explicitamente as fontes utilizadas e proponha proximos passos quando fizer sentido."
    );

    return sections.join("\n\n");
  }

  private buildStubResponse(
    prompt: string,
    context: AgentToolResult[],
    reason?: string
  ): string {
    const reasonLabel = reason ? `${reason}.` : "Vertex não está configurado neste ambiente.";
    const contextLabel =
      context.length > 0
        ? `Contexto disponível (${context.length} blocos).`
        : "Nenhum contexto adicional carregado.";
    return `${reasonLabel} Prompt recebido: "${prompt}". ${contextLabel}`;
  }

  private buildConversationContents(
    prompt: string,
    context: AgentToolResult[],
    actorId: string,
    actorRoles: string[],
    orgId: string,
    history?: AgentHistoryEntry[],
    focus?: ClientFocus | null,
    requestedRange?: RequestedRange,
    focusProjects?: Array<{ id: string; name: string }>,
    wantsTaskCreation?: boolean
  ) {
    const contents = this.normalizeHistory(history);
    contents.push({
      role: "user",
      parts: [
        {
          text: this.buildUserPrompt(
            prompt,
            context,
            actorId,
            actorRoles,
            orgId,
            focus ?? undefined,
            requestedRange,
            focusProjects,
            wantsTaskCreation
          )
        }
      ]
    });
    return contents;
  }

  private async detectClientFocus(prompt: string, orgId: string): Promise<ClientFocus | null> {
    const normalizedPrompt = this.normalizeText(prompt);
    if (!normalizedPrompt || normalizedPrompt.length < 3) {
      return null;
    }

    const clients = await this.clientsRepository.list(orgId, { status: "active" });
    let bestMatch: ClientEntity | null = null;
    let bestScore = 0;

    for (const client of clients) {
      const normalizedName = this.normalizeText(client.name);
      if (!normalizedName) {
        continue;
      }
      if (normalizedPrompt.includes(normalizedName) && normalizedName.length > bestScore) {
        bestMatch = client;
        bestScore = normalizedName.length;
      }
    }

    if (!bestMatch) {
      return null;
    }

    return {
      clientId: bestMatch.id,
      clientName: bestMatch.name ?? null,
      metaAccountIds: (bestMatch.metaAccountIds ?? [])
        .map((id) => this.normalizeMetaAccountId(id))
        .filter((value): value is string => Boolean(value)),
      googleCustomerIds: (bestMatch.googleCustomerIds ?? [])
        .map((id) => this.normalizeGoogleCustomerId(id))
        .filter((value): value is string => Boolean(value)),
      ga4PropertyIds: (bestMatch.ga4PropertyIds ?? [])
        .map((id) => this.normalizeGa4PropertyId(id))
        .filter((value): value is string => Boolean(value))
    };
  }

  private async buildMetaAccountIndex(orgId: string, focus?: ClientFocus) {
    const accounts = new Map<
      string,
      {
        clientName: string | null;
      }
    >();

    if (focus && focus.metaAccountIds.length > 0) {
      focus.metaAccountIds.slice(0, MAX_FOCUS_ACCOUNTS).forEach((id) => {
        accounts.set(id, { clientName: focus.clientName ?? null });
      });
      return accounts;
    }

    const clients = await this.clientsRepository.list(orgId, { status: "active" });
    for (const client of clients) {
      for (const id of client.metaAccountIds ?? []) {
        const normalized = this.normalizeMetaAccountId(id);
        if (!normalized || accounts.has(normalized)) {
          continue;
        }
        accounts.set(normalized, { clientName: client.name ?? null });
      }
    }
    return accounts;
  }

  private async buildGoogleAccountIndex(orgId: string, focus?: ClientFocus) {
    const accounts = new Map<
      string,
      {
        clientName: string | null;
      }
    >();

    if (focus && focus.googleCustomerIds.length > 0) {
      focus.googleCustomerIds.slice(0, MAX_FOCUS_ACCOUNTS).forEach((id) => {
        accounts.set(id, { clientName: focus.clientName ?? null });
      });
      return accounts;
    }

    const clients = await this.clientsRepository.list(orgId, { status: "active" });
    for (const client of clients) {
      for (const id of client.googleCustomerIds ?? []) {
        const normalized = this.normalizeGoogleCustomerId(id);
        if (!normalized || accounts.has(normalized)) {
          continue;
        }
        accounts.set(normalized, { clientName: client.name ?? null });
      }
    }
    return accounts;
  }

  private async buildGa4PropertyIndex(orgId: string, focus?: ClientFocus) {
    const properties = new Map<
      string,
      {
        clientName: string | null;
      }
    >();

    if (focus && focus.ga4PropertyIds.length > 0) {
      focus.ga4PropertyIds.slice(0, MAX_FOCUS_ACCOUNTS).forEach((id) => {
        const normalized = this.normalizeGa4PropertyId(id);
        if (normalized) {
          properties.set(normalized, { clientName: focus.clientName ?? null });
        }
      });
      return properties;
    }

    const clients = await this.clientsRepository.list(orgId, { status: "active" });
    for (const client of clients) {
      for (const id of client.ga4PropertyIds ?? []) {
        const normalized = this.normalizeGa4PropertyId(id);
        if (!normalized || properties.has(normalized)) {
          continue;
        }
        properties.set(normalized, { clientName: client.name ?? null });
      }
    }
    return properties;
  }

  private normalizeText(value: string | null | undefined): string {
    if (!value) {
      return "";
    }
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  private buildTitleFromPromptForTask(prompt: string, projectName?: string): string {
    const trimmed = prompt.trim();
    const lowered = this.normalizeText(trimmed);
    const patterns = [
      /criar uma tarefa\s+(para\s+)?/i,
      /crie uma tarefa\s+(para\s+)?/i,
      /criar tarefa\s+(para\s+)?/i,
      /crie tarefa\s+(para\s+)?/i,
      /nova tarefa\s+(para\s+)?/i
    ];
    let candidate = trimmed;
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        candidate = trimmed.replace(pattern, "").trim();
        break;
      }
    }
    if (!candidate) {
      candidate = projectName ? `Tarefa para ${projectName}` : trimmed || "Tarefa criada pelo agente";
    }
    if (candidate.length > 120) {
      candidate = `${candidate.slice(0, 117)}...`;
    }
    return candidate;
  }

  private async sendVertexWithRetry(requestFactory: () => Promise<Response>): Promise<unknown> {
    let attempt = 0;
    let lastError: Error | null = null;
    while (attempt < MAX_VERTEX_RETRIES) {
      attempt += 1;
      try {
        const response = await requestFactory();
        if (!response.ok) {
          const text = await response.text();
          if (this.isTemporaryVertexStatus(response.status) && attempt < MAX_VERTEX_RETRIES) {
            await this.delay(this.retryDelay(attempt));
            continue;
          }
          throw new Error(`Vertex API error (${response.status}): ${text}`);
        }
        return response.json();
      } catch (error) {
        lastError = error as Error;
        if (this.isTemporaryVertexError(lastError) && attempt < MAX_VERTEX_RETRIES) {
          await this.delay(this.retryDelay(attempt));
          continue;
        }
        break;
      }
    }
    throw lastError ?? new Error("Vertex API call failed");
  }

  private isTemporaryVertexStatus(status: number): boolean {
    return status === 429 || status === 503;
  }

  private isTemporaryVertexError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes("503") || message.includes("unavailable");
  }

  private retryDelay(attempt: number): number {
    return INITIAL_RETRY_DELAY_MS * 2 ** (attempt - 1);
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  private normalizeHistory(
    history?: AgentHistoryEntry[]
  ): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
    if (!history || history.length === 0) {
      return [];
    }
    return history
      .filter((entry) => entry.content && entry.content.trim().length > 0)
      .slice(-MAX_HISTORY_ENTRIES)
      .map((entry) => ({
        role: entry.role === "assistant" ? "model" : "user",
        parts: [
          {
            text: entry.content.trim()
          }
        ]
      }));
  }
}

let service: VertexAgentService | null = null;

export function getAgentService(): VertexAgentService {
  if (!service) {
    service = new VertexAgentService();
  }
  return service;
}
