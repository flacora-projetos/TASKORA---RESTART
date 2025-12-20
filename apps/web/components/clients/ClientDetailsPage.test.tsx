import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClientDetailsPage } from "./ClientDetailsPage";

vi.mock("../auth/AuthProvider", () => ({
  useAuth: () => ({
    token: null,
    status: "idle",
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

describe("ClientDetailsPage", () => {
  it("pede login quando não autenticado", () => {
    render(<ClientDetailsPage clientId="client-1" />);
    expect(screen.getByText(/Faça login para visualizar os detalhes/i)).toBeInTheDocument();
  });
});
