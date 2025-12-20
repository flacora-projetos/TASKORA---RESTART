import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const adminToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1", email: "flacora@gmail.com" })
).toString("base64");

const analistaToken = Buffer.from(
  JSON.stringify({ uid: "analista", roles: ["analista"], orgId: "org-1" })
).toString("base64");

describe("team members routes", () => {
  const app = buildApp();
  let memberId: string;

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a team member", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/team/members",
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        name: "Joana Silva",
        role: "analista",
        weeklyCapacityMinutes: 1800
      }
    });

    expect(response.statusCode).toBe(201);
    const body = response.json() as { id: string };
    expect(body.id).toBeDefined();
    memberId = body.id;
  });

  it("lists team members", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/team/members",
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { items: Array<{ id: string }> };
    expect(body.items.length).toBeGreaterThan(0);
  });

  it("allows analista to update team member", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/team/members/${memberId}`,
      headers: {
        authorization: `Bearer ${analistaToken}`
      },
      payload: {
        role: "gestor"
      }
    });
    expect(response.statusCode).toBe(403);
    const body = response.json() as { message: string };
    expect(body.message.toLowerCase()).toContain("apenas administradores");
  });

  it("archives a team member", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/team/members/${memberId}`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string };
    expect(body.status).toBe("inactive");
  });
});
