import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HoursTrendCard } from "./HoursTrendCard";

const authState = {
  token: null as string | null,
  status: "idle" as "idle" | "loading" | "authenticated" | "error"
};

const useHoursTrendMock = vi.fn();

vi.mock("../../hooks/useHoursTrend", () => ({
  useHoursTrend: (...args: unknown[]) => useHoursTrendMock(...args)
}));

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

describe("HoursTrendCard", () => {
  beforeEach(() => {
    useHoursTrendMock.mockReset();
    useHoursTrendMock.mockReturnValue({
      status: "idle",
      message: null,
      points: [],
      totalMinutes: 0,
      period: { startDate: null, endDate: null }
    });
    authState.token = null;
    authState.status = "idle";
  });

  it("solicita autenticacao quando o usuario nao esta logado", () => {
    render(<HoursTrendCard />);
    expect(
      screen.getByText(/Entre no Taskora para visualizar a tendencia de horas/i)
    ).toBeInTheDocument();
  });

  it("renderiza tendencia quando autenticado", () => {
    authState.token = "token";
    authState.status = "authenticated";
    useHoursTrendMock.mockReturnValue({
      status: "loaded",
      message: null,
      points: [
        { date: "2025-11-15", minutes: 90 },
        { date: "2025-11-16", minutes: 150 }
      ],
      totalMinutes: 240,
      period: { startDate: "2025-11-03", endDate: "2025-11-16" }
    });

    render(<HoursTrendCard />);

    expect(useHoursTrendMock).toHaveBeenCalledWith(
      expect.objectContaining({ token: "token", days: 14 })
    );
    expect(screen.getByText(/4h/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir modulo Projetos/i })).toBeInTheDocument();
  });
});
