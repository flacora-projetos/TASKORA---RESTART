import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SummaryCards } from "./SummaryCards";

describe("SummaryCards", () => {
  it("solicita autenticação quando não há dados", () => {
    render(<SummaryCards />);
    expect(screen.getByText(/Conecte-se no topo/i)).toBeInTheDocument();
  });

  it("exibe valores fornecidos via props", () => {
    render(
      <SummaryCards
        metrics={{
          clients: { total: 5, active: 4, archived: 1 },
          projects: { total: 3, active: 2, paused: 1 }
        }}
        metricsStatus="loaded"
        hoursReport={{
          period: { startDate: "2025-11-06", endDate: "2025-11-06" },
          filters: { projectId: null, userId: null },
          totals: { minutes: 90, perProject: [], perUser: [] }
        }}
        hoursStatus="loaded"
      />
    );

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("01:30")).toBeInTheDocument();
  });
});
