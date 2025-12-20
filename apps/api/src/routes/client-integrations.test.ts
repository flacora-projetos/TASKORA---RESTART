import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../services/external-clients.js", () => ({
  callExternalApi: vi.fn(async () => ({
    id: "dir-123",
    googleCustomerIds: ["123-456-7890"],
    ga4PropertyId: "properties/999999999"
  }))
}));

import { buildApp } from "../app.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { callExternalApi } from "../services/external-clients.js";

const repo = getClientsRepository();
const directoryMock = callExternalApi as unknown as vi.Mock;

const adminToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1", email: "flacora@gmail.com" })
).toString("base64");

const analistaToken = Buffer.from(
  JSON.stringify({ uid: "analista", roles: ["analista"], orgId: "org-1" })
).toString("base64");

describe("client integrations routes", () => {
  const app = buildApp();
  let clientId: string;
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  const redirectUri = "http://localhost:3000/integrations/pinterest/callback";

  beforeAll(async () => {
    await app.ready();
    const client = await repo.create("org-1", { name: "Cliente Teste" }, "gestor");
    clientId = client.id;
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockReset();
  });

  afterAll(async () => {
    fetchSpy.mockRestore();
    await app.close();
  });

  it("blocks non authenticated users", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/integrations`
    });
    expect(response.statusCode).toBe(401);
  });

  it("allows gestor to link directory client", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/clients/${clientId}/integrations/link-directory`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        directoryClientId: "dir-123"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(callExternalApi).toHaveBeenCalledWith({
      path: "/directory/clients/dir-123"
    });
    const body = response.json() as {
      integrations: { directoryId: string; googleCustomerIds: string[]; ga4PropertyIds: string[] };
    };
    expect(body.integrations.directoryId).toBe("dir-123");
    expect(body.integrations.googleCustomerIds).toEqual(["123-456-7890"]);
    expect(body.integrations.ga4PropertyIds).toEqual(["properties/999999999"]);

    const stored = await repo.findById("org-1", clientId);
    expect(stored?.googleCustomerIds).toEqual(["123-456-7890"]);
    expect(stored?.ga4PropertyIds).toEqual(["properties/999999999"]);
  });

  it("mantem IDs existentes e adiciona novos ao relinkar com outra plataforma", async () => {
    directoryMock.mockResolvedValueOnce({
      id: "dir-123",
      metaAccountIds: ["act_5555"]
    });

    const response = await app.inject({
      method: "POST",
      url: `/clients/${clientId}/integrations/link-directory`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        directoryClientId: "dir-123"
      }
    });

    expect(response.statusCode).toBe(200);
    const stored = await repo.findById("org-1", clientId);
    expect(stored?.googleCustomerIds).toEqual(["123-456-7890"]);
    expect(stored?.metaAccountIds).toEqual(["act_5555"]);
  });

  it("prevents analista from linking directory client", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/clients/${clientId}/integrations/link-directory`,
      headers: {
        authorization: `Bearer ${analistaToken}`
      },
      payload: {
        directoryClientId: "dir-123"
      }
    });

    expect(response.statusCode).toBe(403);
  });

  it("returns stored integrations", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/clients/${clientId}/integrations`,
      headers: {
        authorization: `Bearer ${adminToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      integrations: { directoryId: string };
    };
    expect(body.integrations?.directoryId).toBe("dir-123");
  });

  it("inicia o fluxo do Pinterest e salva o token", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "pin-access",
        refresh_token: "pin-refresh",
        token_type: "bearer",
        scope: "ads:read",
        expires_in: 3600,
        refresh_token_expires_in: 86400
      })
    } as Response);

    const startResponse = await app.inject({
      method: "POST",
      url: `/clients/${clientId}/integrations/pinterest/start`,
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        redirectUri
      }
    });

    expect(startResponse.statusCode).toBe(200);
    const startBody = startResponse.json() as { state: string; authorizationUrl: string };
    expect(startBody.authorizationUrl).toContain("https://www.pinterest.com/oauth/");
    expect(startBody.state).toBeDefined();

    const callbackResponse = await app.inject({
      method: "POST",
      url: "/clients/integrations/pinterest/callback",
      headers: {
        authorization: `Bearer ${adminToken}`
      },
      payload: {
        code: "sample-code",
        state: startBody.state,
        redirectUri
      }
    });

    expect(callbackResponse.statusCode).toBe(200);
    const stored = await repo.findById("org-1", clientId);
    expect(stored?.integrations?.pinterest?.accessToken).toBe("pin-access");
    expect(fetchSpy).toHaveBeenCalled();
  });
});
