import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientOnboardingCard } from "./ClientOnboardingCard";

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

describe("ClientOnboardingCard", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authState.token = null;
    authState.status = "idle";
  });

  it("solicita autenticacao quando nao ha usuario logado", () => {
    render(<ClientOnboardingCard />);
    expect(screen.getByText(/Conecte-se para ver os clientes/i)).toBeInTheDocument();
  });

  it("exibe pipeline quando autenticado", async () => {
    authState.token = "token";
    authState.status = "authenticated";
    apiFetchMock.mockResolvedValue({
      totals: {
        contacts: 5,
        leadsPending: 2,
        active: 3,
        archived: 0,
        withIds: 2,
        withoutIds: 1,
        withMetrics: 1,
        withoutMetrics: 1
      },
      pipeline: [
        { id: "contact", label: "Contato", count: 5, helper: "2 aguardam cadastro" },
        { id: "cadastro", label: "Cadastro", count: 3, helper: "0 arquivados" },
        { id: "ids", label: "IDs conectados", count: 2, helper: "1 pendente" },
        { id: "metrics", label: "Metricas", count: 1, helper: "1 aguardam sync" }
      ],
      highlights: {
        missingIds: [{ id: "c1", name: "Cliente Sem IDs", missing: ["google"] }],
        missingMetrics: []
      },
      metadata: { directoryLastSync: "2025-11-17T10:00:00.000Z" }
    });

    render(<ClientOnboardingCard />);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock).toHaveBeenCalledWith(
      "/clients/summary",
      expect.objectContaining({ token: "token" })
    );
    expect(screen.getByText(/Pipe de onboarding/i)).toBeInTheDocument();
    expect(screen.getByText(/IDs pendentes/i)).toBeInTheDocument();
    expect(screen.getByText(/Cliente Sem IDs/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir modulo Clientes/i })).toBeInTheDocument();
  });
});
