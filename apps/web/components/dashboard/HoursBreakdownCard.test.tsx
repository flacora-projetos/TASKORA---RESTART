import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HoursBreakdownCard } from "./HoursBreakdownCard";

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

describe("HoursBreakdownCard", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    authState.token = null;
    authState.status = "idle";
  });

  it("solicita login quando não autenticado", () => {
    render(<HoursBreakdownCard />);
    expect(screen.getByText(/Faça login para ver o detalhamento/i)).toBeInTheDocument();
  });

  it("carrega dados e permite trocar o período", async () => {
    authState.token = "token";
    authState.status = "authenticated";
    apiFetchMock.mockResolvedValueOnce({
      period: { startDate: "2025-11-06", endDate: "2025-11-06" },
      filters: { projectId: null, userId: null },
      totals: {
        minutes: 120,
        perProject: [{ id: "proj-1", minutes: 80 }],
        perUser: [{ id: "ana", minutes: 50 }]
      }
    });
    apiFetchMock.mockResolvedValueOnce({
      period: { startDate: "2025-10-30", endDate: "2025-11-05" },
      filters: { projectId: null, userId: null },
      totals: {
        minutes: 300,
        perProject: [],
        perUser: []
      }
    });

    render(<HoursBreakdownCard />);

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/proj-1/)).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("Hoje"), { target: { value: "last7" } });

    await waitFor(() => expect(apiFetchMock).toHaveBeenCalledTimes(2));
    expect(apiFetchMock).toHaveBeenLastCalledWith(
      "/reports/hours",
      expect.objectContaining({ token: "token" })
    );
  });
});
