import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("auth routes", () => {
  const app = buildApp();

  beforeAll(async () => {
    app.after(() => {
      app.get(
        "/auth/secure-role",
        {
          preHandler: [app.authenticate, app.requireRoles(["gestor"])]
        },
        async () => ({
          ok: true
        })
      );

      app.get(
        "/auth/secure-org",
        {
          preHandler: [app.authenticate, app.requireOrg()]
        },
        async (request) => ({
          orgId: request.orgId
        })
      );
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /auth/me returns 401 when token is missing", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/auth/me"
    });

    expect(response.statusCode).toBe(401);
  });

  it("GET /auth/me returns user information when token is valid in dev mode", async () => {
    const fakeTokenPayload = {
      uid: "user-123",
      email: "user@example.com",
      orgId: "org-001",
      roles: ["gestor", "analista"]
    };
    const fakeToken = Buffer.from(JSON.stringify(fakeTokenPayload)).toString("base64");

    const response = await app.inject({
      method: "GET",
      url: "/auth/me",
      headers: {
        authorization: `Bearer ${fakeToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      uid: string;
      email: string;
      orgId: string;
      roles: string[];
      profile: unknown;
    };

    expect(body.uid).toBe(fakeTokenPayload.uid);
    expect(body.email).toBe(fakeTokenPayload.email);
    expect(body.orgId).toBe(fakeTokenPayload.orgId);
    expect(body.roles).toEqual(fakeTokenPayload.roles);
    expect(body.profile).toBeNull();
  });

  it("requireRoles denies access when role missing", async () => {
    const token = Buffer.from(
      JSON.stringify({
        uid: "user-456",
        email: "analista@example.com",
        roles: ["analista"]
      })
    ).toString("base64");

    const response = await app.inject({
      method: "GET",
      url: "/auth/secure-role",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("requireRoles allows access for correct role", async () => {
    const token = Buffer.from(
      JSON.stringify({
        uid: "user-789",
        email: "gestor@example.com",
        roles: ["gestor"]
      })
    ).toString("base64");

    const response = await app.inject({
      method: "GET",
      url: "/auth/secure-role",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("requireOrg fails when orgId missing", async () => {
    const token = Buffer.from(
      JSON.stringify({
        uid: "user-001",
        email: "no-org@example.com",
        roles: ["gestor"]
      })
    ).toString("base64");

    const response = await app.inject({
      method: "GET",
      url: "/auth/secure-org",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("requireOrg propagates orgId when available", async () => {
    const token = Buffer.from(
      JSON.stringify({
        uid: "user-002",
        email: "org@example.com",
        roles: ["gestor"],
        orgId: "org-123"
      })
    ).toString("base64");

    const response = await app.inject({
      method: "GET",
      url: "/auth/secure-org",
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ orgId: "org-123" });
  });
});
