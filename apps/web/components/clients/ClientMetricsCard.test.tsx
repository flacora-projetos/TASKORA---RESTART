import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientMetricsCard } from "./ClientMetricsCard";
import { apiFetch } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn()
}));

const apiFetchMock = vi.mocked(apiFetch);

describe("ClientMetricsCard", () => {
  it("exibe metricas e permite sincronizar manualmente", async () => {
    apiFetchMock.mockResolvedValueOnce({
      range: "LAST_7_DAYS",
      generatedAt: "2025-11-07T00:00:00.000Z",
      platforms: [
        {
          platform: "google",
          status: "connected",
          totals: { spend: 5000, impressions: 100000, clicks: 1200, conversions: 45, cpc: 4.2, ctr: 0.012, revenue: null },
          lastSynced: "2025-11-07T10:00:00.000Z",
          kpis: [
            { key: "spend", label: "Investimento total", value: 5000, format: "currency" },
            { key: "sessions", label: "Sessoes", value: 200, format: "number" }
          ]
        },
        {
          platform: "meta",
          status: "missing",
          totals: { spend: null, impressions: null, clicks: null, conversions: null, cpc: null, ctr: null, revenue: null },
          lastSynced: null,
          message: "Nenhuma conta Meta Ads vinculada."
        },
        {
          platform: "ga4",
          status: "pending",
          totals: { spend: null, impressions: null, clicks: null, conversions: null, cpc: null, ctr: null, revenue: null },
          lastSynced: null,
          message: "Configure EXTERNAL_MCP_TOKEN.",
          kpis: [{ key: "sessions", label: "Sessoes", value: 120, format: "number" }]
        }
      ]
    });

    render(<ClientMetricsCard clientId="client-1" token="token-xyz" />);

    expect(await screen.findByText("Google Ads")).toBeInTheDocument();
    expect(screen.getAllByText("Dados atualizados")).toHaveLength(1);
    expect(screen.getAllByText("Nao se aplica")).toHaveLength(1);
    expect(screen.getAllByText("Configuracao pendente")).toHaveLength(1);
    expect(screen.getAllByText("Sessoes").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((content) => content.includes("5.000") && content.includes("R$"))[0]
    ).toBeInTheDocument();

    apiFetchMock.mockResolvedValueOnce({
      range: "LAST_7_DAYS",
      generatedAt: "2025-11-07T00:05:00.000Z",
      platforms: [
        {
          platform: "google",
          status: "connected",
          totals: { spend: 6000, impressions: 120000, clicks: 1400, conversions: 55, cpc: 4.2, ctr: 0.015, revenue: null },
          lastSynced: "2025-11-07T10:05:00.000Z",
          kpis: [
            { key: "spend", label: "Investimento total", value: 6000, format: "currency" },
            { key: "sessions", label: "Sessoes", value: 250, format: "number" }
          ]
        },
        {
          platform: "meta",
          status: "missing",
          totals: { spend: null, impressions: null, clicks: null, conversions: null, cpc: null, ctr: null, revenue: null },
          lastSynced: null,
          message: "Nenhuma conta Meta Ads vinculada."
        },
        {
          platform: "ga4",
          status: "pending",
          totals: { spend: null, impressions: null, clicks: null, conversions: null, cpc: null, ctr: null, revenue: null },
          lastSynced: null,
          message: "Configure EXTERNAL_MCP_TOKEN.",
          kpis: [{ key: "sessions", label: "Sessoes", value: 150, format: "number" }]
        }
      ]
    });

    fireEvent.click(screen.getByRole("button", { name: "Sincronizar agora" }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenLastCalledWith("/clients/client-1/metrics/refresh", {
        method: "POST",
        query: { range: "LAST_7_DAYS" },
        token: "token-xyz"
      });
    });
  });
});


