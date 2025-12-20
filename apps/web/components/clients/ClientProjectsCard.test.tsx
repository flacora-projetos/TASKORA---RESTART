import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientProjectsCard } from "./ClientProjectsCard";
import { apiFetch } from "../../lib/api";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "token-abc",
    status: "authenticated",
    user: { uid: "gestor" },
    loginWithGoogle: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
    supportsManualToken: false,
    usesFirebaseAuth: true,
    error: null
  })
}));

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn()
}));

const apiFetchMock = vi.mocked(apiFetch);

describe("ClientProjectsCard", () => {
  it("lista projetos e exibe contadores por status", async () => {
    apiFetchMock.mockResolvedValue({
      items: [
        {
          id: "proj-1",
          name: "Onboarding Meta",
          clientId: "client-1",
          status: "active",
          updatedAt: "2025-11-10T12:00:00.000Z"
        },
        {
          id: "proj-2",
          name: "Landing GA4",
          clientId: "client-1",
          status: "paused",
          updatedAt: "2025-11-09T10:00:00.000Z"
        }
      ]
    });

    render(<ClientProjectsCard clientId="client-1" />);

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith("/projects", expect.objectContaining({ query: { clientId: "client-1" } }));
    });

    expect(screen.getByText("Onboarding Meta")).toBeInTheDocument();
    expect(screen.getByText("Landing GA4")).toBeInTheDocument();
    expect(screen.getAllByText("Em andamento").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Pausado").length).toBeGreaterThan(0);
  });

  it("exibe CTA quando não há projetos", async () => {
    apiFetchMock.mockResolvedValueOnce({
      items: []
    });

    render(<ClientProjectsCard clientId="client-2" />);

    await waitFor(() => {
      expect(
        screen.getByRole("link", {
          name: /Abrir módulo de projetos/i
        })
      ).toBeInTheDocument();
    });
  });
});
