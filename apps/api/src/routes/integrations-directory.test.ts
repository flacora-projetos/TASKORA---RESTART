import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../services/external-clients.js", () => ({
  callExternalApi: vi.fn(async () => ({ items: [] }))
}));

import { buildApp } from "../app.js";
import { callExternalApi } from "../services/external-clients.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

describe("integrations directory routes", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("requires authentication", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/integrations/directory/clients"
    });

    expect(response.statusCode).toBe(401);
  });

  it("calls external API with query params", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/integrations/directory/clients?q=acme&platform=google&limit=10",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(callExternalApi).toHaveBeenCalledWith({
      path: "/directory/clients",
      query: {
        limit: 10,
        platform: "google",
        q: "acme"
      }
    });
  });
});
