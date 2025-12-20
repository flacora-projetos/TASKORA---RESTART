import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskListCard } from "./TaskListCard";

const apiFetchMock = vi.fn();

vi.mock("../../lib/api", () => {
  class MockApiError extends Error {
    status?: number;
    constructor(message?: string, status?: number) {
      super(message);
      this.status = status;
    }
  }

  return {
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
    ApiError: MockApiError
  };
});

type MockAuth = {
  token: string | null;
  user: null;
  status: "idle" | "loading" | "authenticated" | "error";
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithToken: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
  supportsManualToken: boolean;
  usesFirebaseAuth: boolean;
};

const authState: MockAuth = {
  token: null,
  user: null,
  status: "idle",
  error: null,
  loginWithGoogle: async () => {},
  loginWithToken: () => {},
  logout: () => {},
  refresh: async () => {},
  supportsManualToken: false,
  usesFirebaseAuth: true
};

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => authState
}));

describe("TaskListCard", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authState.token = null;
    authState.status = "idle";
  });

  it("solicita autenticação quando não ha token", () => {
    render(<TaskListCard />);
    expect(
      screen.getByText(/Autentique-se para consultar as tarefas/i)
    ).toBeInTheDocument();
  });

  it("renderiza tarefas retornadas pela API", async () => {
    authState.token = "token";
    authState.status = "authenticated";

    apiFetchMock.mockImplementation((path: string) => {
      if (path === "/projects") {
        return Promise.resolve({
          items: [
            { id: "proj-1", name: "Projeto X", clientId: "client-1", status: "active", updatedAt: "2025-11-06T10:00:00.000Z" }
          ]
        });
      }
      if (path === "/projects/proj-1/tasks") {
        return Promise.resolve({
          items: [
            {
              id: "task-1",
              orgId: "org-1",
              projectId: "proj-1",
              title: "Enviar relatorio",
              description: null,
              type: "other",
              status: "todo",
              assignees: ["ana"],
              dueDate: "2025-11-10T00:00:00.000Z",
              checklist: [],
              integration: null,
              activityLog: [],
              createdAt: "2025-11-06T10:00:00.000Z",
              updatedAt: "2025-11-06T10:00:00.000Z",
              archivedAt: null
            }
          ]
        });
      }
      if (path === "/time-entries/summary") {
        return Promise.resolve({
          totals: {
            "task-1": 90
          }
        });
      }

      return Promise.resolve({ items: [] });
    });

    render(<TaskListCard />);

    expect(await screen.findByText("Enviar relatorio")).toBeInTheDocument();
    expect(screen.getByText(/Responsaveis: ana/)).toBeInTheDocument();
    expect(screen.getByText("Horas: 1h 30min")).toBeInTheDocument();
  });
});
