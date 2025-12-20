import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ClientsPage } from "./ClientsPage";

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

describe("ClientsPage", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authState.token = null;
    authState.status = "idle";
  });

  it("solicita login quando não autenticado", () => {
    render(<ClientsPage />);
    expect(screen.getByText(/Faça login no dashboard/i)).toBeInTheDocument();
  });

  it("carrega clientes e permite filtro", async () => {
    authState.token = "token";
    authState.status = "authenticated";
    apiFetchMock.mockImplementation((url: string) => {
      if (url === "/clients") {
        return Promise.resolve({
          items: [
            {
              id: "c1",
              name: "Cliente 1",
              segment: "Ecommerce",
              monthlyBudget: 1000,
              platforms: ["google"],
              driveLink: null,
              whatsappGroup: null,
              status: "active",
              createdAt: "2025-11-06T10:00:00.000Z",
              updatedAt: "2025-11-06T10:00:00.000Z",
              integrations: null
            }
          ]
        });
      }
      if (url === "/metrics/integrations/status") {
        return Promise.resolve({ alerts: [], platforms: [] });
      }
      return Promise.resolve({});
    });

    render(<ClientsPage />);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/clients", expect.anything()));
    expect(screen.getByText("Cliente 1")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Ativos"), { target: { value: "all" } });
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledWith("/clients", expect.objectContaining({ query: undefined })));
  });
});
