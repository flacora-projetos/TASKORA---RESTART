import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TimeEntryCard } from "./TimeEntryCard";

const apiFetchMock = vi.fn();

vi.mock("../../lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class extends Error {}
}));

const authState = {
  token: null as string | null,
  status: "idle" as "idle" | "loading" | "authenticated" | "error"
};

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: authState.token,
    status: authState.status,
    user: null,
    error: null,
    loginWithGoogle: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    refresh: async () => {},
    supportsManualToken: false,
    usesFirebaseAuth: true
  })
}));

describe("TimeEntryCard", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authState.token = null;
    authState.status = "idle";
  });

  it("pede login quando nao autenticado", () => {
    render(<TimeEntryCard />);
    expect(screen.getByText(/login para lancar horas/i)).toBeInTheDocument();
  });

  it("lista entradas e permite enviar formulario com selects", async () => {
    authState.token = "token";
    authState.status = "authenticated";

    apiFetchMock.mockResolvedValueOnce({ items: [] });
    apiFetchMock.mockResolvedValueOnce({
      items: [
        {
          id: "proj-1",
          name: "Projeto 1",
          clientId: "client-1",
          status: "active",
          ownerId: null,
          updatedAt: "2025-11-06T10:00:00.000Z"
        }
      ]
    });
    apiFetchMock.mockResolvedValueOnce({
      items: [
        {
          id: "task-1",
          orgId: "org-1",
          projectId: "proj-1",
          title: "Task 1",
          description: null,
          type: "other",
          status: "todo",
          assignees: [],
          dueDate: null,
          checklist: [],
          integration: null,
          activityLog: [],
          createdAt: "2025-11-06T10:00:00.000Z",
          updatedAt: "2025-11-06T10:00:00.000Z",
          archivedAt: null
        }
      ]
    });
    apiFetchMock.mockResolvedValueOnce({});
    apiFetchMock.mockResolvedValueOnce({ items: [] });

    render(<TimeEntryCard />);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(3));

    fireEvent.change(screen.getByLabelText(/Minutos trabalhados/i), { target: { value: "30" } });

    fireEvent.submit(screen.getByText(/Registrar horas/i).closest("form")!);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(5));
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/time-entries",
      expect.objectContaining({ token: "token", method: "POST" })
    );
  });
});

