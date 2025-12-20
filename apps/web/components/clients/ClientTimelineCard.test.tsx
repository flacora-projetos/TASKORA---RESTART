import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientTimelineCard } from "./ClientTimelineCard";
import { apiFetch } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn()
}));

const apiFetchMock = vi.mocked(apiFetch);

describe("ClientTimelineCard", () => {
  it("lista eventos, aplica filtros e permite registrar novos itens", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        items: [
          {
            id: "evt-1",
            eventType: "meeting",
            title: "Kickoff com cliente",
            description: "Definidos OKRs do trimestre",
            tags: [],
            metadata: null,
            occurredAt: "2025-11-06T10:00:00.000Z",
            createdAt: "2025-11-06T10:05:00.000Z",
            actorLabel: "gestor@taskora.com",
            source: "manual"
          }
        ]
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "evt-2",
            eventType: "note",
            title: "Revisao semanal",
            description: null,
            tags: [],
            metadata: null,
            occurredAt: "2025-11-07T12:00:00.000Z",
            createdAt: "2025-11-07T12:01:00.000Z",
            actorLabel: "analista@taskora.com",
            source: "manual"
          }
        ]
      })
      .mockResolvedValueOnce({ id: "evt-3" })
      .mockResolvedValueOnce({
        items: [
          {
            id: "evt-3",
            eventType: "note",
            title: "Revisao semanal",
            description: null,
            tags: [],
            metadata: null,
            occurredAt: "2025-11-07T12:00:00.000Z",
            createdAt: "2025-11-07T12:01:00.000Z",
            actorLabel: "analista@taskora.com",
            source: "manual"
          }
        ]
      });

    render(<ClientTimelineCard clientId="client-1" token="token-abc" />);

    expect(await screen.findByText("Kickoff com cliente")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Todos"), { target: { value: "note" } });
    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenLastCalledWith(
        "/clients/client-1/timeline",
        expect.objectContaining({ query: expect.objectContaining({ eventType: "note" }) })
      );
    });

    fireEvent.change(screen.getByPlaceholderText("Titulo do evento"), { target: { value: "Revisao semanal" } });
    fireEvent.submit(screen.getByRole("button", { name: /Adicionar evento/i }));

    await waitFor(() => {
      expect(apiFetchMock).toHaveBeenCalledWith(
        "/clients/client-1/timeline",
        expect.objectContaining({ method: "POST" })
      );
    });

    const matches = await screen.findAllByText((content, element) => element?.textContent?.includes("Revisao semanal") ?? false);
    expect(matches.length).toBeGreaterThan(0);
  });
});
