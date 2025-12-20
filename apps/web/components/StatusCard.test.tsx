import { render, screen } from "@testing-library/react";

import { StatusCard } from "./StatusCard";

describe("StatusCard", () => {
  it("renders status label", () => {
    render(
      <StatusCard
        title="API"
        description="Status geral"
        status="ok"
        timestamp="2025-11-05T15:00:00.000Z"
      />
    );

    expect(screen.getByText("API")).toBeInTheDocument();
    expect(screen.getByText("Operante")).toBeInTheDocument();
    expect(screen.getByText(/Última verificação/i)).toBeInTheDocument();
  });
});
