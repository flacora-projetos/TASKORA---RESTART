'use client';

import { useState, useCallback } from "react";

import { useAuth } from "../components/auth/AuthProvider";
import { apiFetch, ApiError } from "../lib/api";

type AgentToolCall =
  | {
      id?: string;
      kind: "internal_tasks";
      limit?: number;
    }
  | {
      id?: string;
      kind: "external_api";
      path: string;
      method?: string;
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
      method?: string;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    };

type AgentToolResult = {
  id: string;
  kind: AgentToolCall["kind"];
  ok: boolean;
  summary: string;
  data?: unknown;
  error?: string;
};

type AgentRunResult = {
  prompt: string;
  orgId: string;
  context: AgentToolResult[];
  response: {
    provider: string;
    model: string;
    text: string;
    stubbed: boolean;
    finishReason: string | null;
  };
};

export type AssistantMessage = {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  timestamp: string;
};

function buildDefaultTools(): AgentToolCall[] {
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  return [
    {
      id: "tasks_snapshot",
      kind: "internal_tasks",
      limit: 6
    },
    {
      id: "metrics_summary",
      kind: "external_api",
      path: "/metrics/summary"
    },
    {
      id: "hours_today",
      kind: "external_api",
      path: "/reports/hours",
      query: {
        startDate: todayIso,
        endDate: todayIso
      }
    },
    {
      id: "spend_overview",
      kind: "external_api",
      path: "/metrics/spend-overview"
    },
    {
      id: "integration_status",
      kind: "external_api",
      path: "/metrics/integrations/status"
    },
    {
      id: "meta_summary_auto",
      kind: "mcp",
      tool: "meta_summary",
      args: {
        range: "last_7d",
        limit: 2
      }
    },
    {
      id: "google_summary_auto",
      kind: "mcp",
      tool: "google_summary",
      args: {
        range: "LAST_7_DAYS",
        limit: 2
      }
    },
    {
      id: "ga4_auto",
      kind: "ga4",
      path: "auto",
      body: {
        days: 7,
        limit: 1
      }
    }
  ];
}

const WELCOME_MESSAGE: AssistantMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Oi! Eu sou o Gemini conectado ao Taskora. Posso olhar tarefas, gastos e integrações quando você precisar. É só perguntar 👇",
  timestamp: new Date().toISOString()
};

const HISTORY_LIMIT = 6;

function buildHistoryPayload(messages: AssistantMessage[]) {
  return messages
    .filter((message) => (message.role === "assistant" || message.role === "user") && message.id !== WELCOME_MESSAGE.id)
    .slice(-HISTORY_LIMIT)
    .map((message) => ({
      role: message.role,
      content: message.content
    }));
}

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 11);
}

export function useAssistantChat() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME_MESSAGE]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed) {
        return;
      }

      const historyPayload = buildHistoryPayload(messages);

      const userMessage: AssistantMessage = {
        id: createId(),
        role: "user",
        content: trimmed,
        timestamp: new Date().toISOString()
      };

      setMessages((prev) => [...prev, userMessage]);
      setErrorMessage(null);

      if (!token) {
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content: "Faça login para que eu possa acessar os dados do Taskora.",
            timestamp: new Date().toISOString()
          }
        ]);
        return;
      }

      setIsLoading(true);
      try {
        const response = await apiFetch<AgentRunResult>("/agent/query", {
          token,
          method: "POST",
          body: {
            prompt: trimmed,
            tools: buildDefaultTools(),
            history: historyPayload
          }
        });

        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content: response.response.text,
            timestamp: new Date().toISOString()
          }
        ]);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Não consegui falar com o agente agora.";
        setErrorMessage(message);
        setMessages((prev) => [
          ...prev,
          {
            id: createId(),
            role: "assistant",
            content: `Tive um problema: ${message}`,
            timestamp: new Date().toISOString()
          }
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [token, messages]
  );

  return {
    messages,
    isLoading,
    sendMessage,
    errorMessage
  };
}
