import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { IntegrationAlertsCard } from "./IntegrationAlertsCard";
import { apiFetch } from "../../lib/api";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "test-token",
    status: "authenticated",
    user: { uid: "user-1", roles: ["gestor"] },
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

describe("IntegrationAlertsCard", () => {
  it("mostra pendencias e alertas", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      platforms: [
        { platform: "google", statusCounts: { connected: 1, pending: 1, error: 0, missing: 0 } },
        { platform: "meta", statusCounts: { connected: 2, pending: 0, error: 1, missing: 0 } },
        { platform: "ga4", statusCounts: { connected: 0, pending: 0, error: 0, missing: 2 } }
      ],
      alerts: [
        {
          clientId: "client-1",
          clientName: "Cliente 1",
          platform: "google",
          status: "pending",
          updatedAt: "2025-11-08T12:00:00.000Z"
        }
      ]
    });

    render(<IntegrationAlertsCard />);

    await waitFor(() => {
      expect(screen.getByText(/Alertas das integracoes/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("link", {
        name: "Cliente 1"
      })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/pendencias/i).length).toBeGreaterThan(0);
  });
});
