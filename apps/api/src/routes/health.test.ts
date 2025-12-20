import { beforeAll, afterAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

describe("GET /health", () => {
  const app = buildApp();

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns health payload", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/health"
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      status: string;
      service: string;
      timestamp: string;
    };

    expect(body.status).toBe("ok");
    expect(body.service).toBe("taskora-api");
    expect(new Date(body.timestamp).toString()).not.toBe("Invalid Date");
  });
});
