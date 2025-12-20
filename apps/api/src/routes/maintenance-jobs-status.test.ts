import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";

const gestorToken = Buffer.from(
  JSON.stringify({ uid: "gestor", roles: ["gestor"], orgId: "org-1" })
).toString("base64");

describe("maintenance jobs status route", () => {
  const app = buildApp();
  const originalEnv = process.env.TASKORA_JOBS_STATUS;

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    process.env.TASKORA_JOBS_STATUS = originalEnv;
  });

  it("retorna status base quando nao ha env", async () => {
    delete process.env.TASKORA_JOBS_STATUS;

    const response = await app.inject({
      method: "GET",
      url: "/maintenance/jobs/status",
      headers: { authorization: `Bearer ${gestorToken}` }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { jobs: Array<{ id: string; status: string }> };
    expect(body.jobs.length).toBeGreaterThan(0);
    expect(body.jobs[0].status).toBe("pending");
  });

  it("usa dados da env quando disponivel", async () => {
    process.env.TASKORA_JOBS_STATUS = JSON.stringify([
      { jobId: "directory-cache-sync", status: "success", lastRunAt: "2025-11-17T10:00:00.000Z" }
    ]);

    const response = await app.inject({
      method: "GET",
      url: "/maintenance/jobs/status",
      headers: { authorization: `Bearer ${gestorToken}` }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { jobs: Array<{ id: string; status: string; lastRunAt: string | null }> };
    const record = body.jobs.find((job) => job.id === "directory-cache-sync");
    expect(record?.status).toBe("success");
    expect(record?.lastRunAt).toBe("2025-11-17T10:00:00.000Z");
  });
});
