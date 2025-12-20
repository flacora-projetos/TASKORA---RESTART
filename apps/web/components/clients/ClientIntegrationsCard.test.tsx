import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientIntegrationsCard } from "./ClientIntegrationsCard";
import type { Client } from "../../types/clients";

vi.mock("../integrations/DirectoryClientMenu", () => ({
  DirectoryClientMenu: () => <div data-testid="directory-menu" />
}));

const baseClient: Client = {
  id: "client-1",
  name: "Cliente Teste",
  segment: null,
  monthlyBudget: null,
  platforms: [],
  driveLink: null,
  whatsappGroup: null,
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  googleCustomerIds: [],
  metaAccountIds: [],
  ga4PropertyIds: [],
  pinterestAccountIds: [],
  responsibleId: null,
  integrations: null
};

describe("ClientIntegrationsCard", () => {
  it("exibe CTA do Pinterest quando a plataforma está ativa", () => {
    render(
      <ClientIntegrationsCard
        client={{ ...baseClient, platforms: ["pinterest"] }}
        token="token"
        onLinked={async () => {}}
      />
    );

    expect(screen.getByText(/Liberar MCP Pinterest/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Conectar Pinterest/i
      })
    ).toBeInTheDocument();
  });

  it("mostra informações da autorização quando o Pinterest já está conectado", () => {
    const now = new Date().toISOString();
    render(
      <ClientIntegrationsCard
        client={{
          ...baseClient,
          platforms: ["pinterest"],
          integrations: {
            pinterest: {
              accessToken: "pin-access",
              refreshToken: "pin-refresh",
              tokenType: "bearer",
              scope: "ads:read",
              expiresAt: now,
              refreshTokenExpiresAt: null,
              linkedAt: now
            }
          }
        }}
        token="token"
        onLinked={async () => {}}
      />
    );

    expect(screen.getByText(/Conta autorizada/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Atualizar permissão/i
      })
    ).toBeInTheDocument();
  });
});
