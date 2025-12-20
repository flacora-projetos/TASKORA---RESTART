import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PlatformIntegrationsCard } from "./PlatformIntegrationsCard";
import { apiFetch } from "../../lib/api";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: "test-token",
    status: "authenticated",
    user: {
      uid: "gestor",
      roles: ["gestor"]
    },
    loginWithGoogle: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    error: null,
    refresh: vi.fn(),
    supportsManualToken: false,
    usesFirebaseAuth: true
  })
}));

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn()
}));

describe("PlatformIntegrationsCard", () => {
  it("exibe cobertura por plataforma e lista clientes pendentes", async () => {
    const apiFetchMock = vi.mocked(apiFetch);
    apiFetchMock.mockResolvedValueOnce({
      items: [
        {
          id: "client-1",
          name: "Cliente 1",
          orgId: "org-1",
          status: "active",
          platforms: [],
          segment: null,
          monthlyBudget: null,
          driveLink: null,
          whatsappGroup: null,
          createdAt: "",
          updatedAt: "",
          archivedAt: null,
          googleCustomerIds: ["123"],
          metaAccountIds: [],
          ga4PropertyIds: ["ga4-1"],
          pinterestAccountIds: ["549769130861"],
          responsibleId: null,
          integrations: null
        },
        {
          id: "client-2",
          name: "Cliente 2",
          orgId: "org-1",
          status: "active",
          platforms: [],
          segment: null,
          monthlyBudget: null,
          driveLink: null,
          whatsappGroup: null,
          createdAt: "",
          updatedAt: "",
          archivedAt: null,
          googleCustomerIds: [],
          metaAccountIds: ["meta-1"],
          ga4PropertyIds: [],
          pinterestAccountIds: [],
          responsibleId: null,
          integrations: null
        }
      ]
    });

    render(<PlatformIntegrationsCard />);

    await waitFor(() => {
      expect(screen.getByText(/Google \/ Meta \/ GA4 \/ Pinterest/)).toBeInTheDocument();
    });

    expect(screen.getByText("Google Ads")).toBeInTheDocument();
    expect(screen.getByText("Meta Ads")).toBeInTheDocument();
    expect(screen.getByText("GA4")).toBeInTheDocument();
    expect(screen.getByText("Pinterest Ads")).toBeInTheDocument();

    expect(screen.getAllByText(/1\/2/)).toHaveLength(4);
    expect(
      screen.getAllByRole("link", {
        name: "Cliente 2"
      }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", {
        name: "Cliente 1"
      }).length
    ).toBeGreaterThan(0);
  });
});
