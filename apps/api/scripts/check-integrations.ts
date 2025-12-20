import process from "node:process";

import { env } from "../src/env.js";
import { callExternalApi, callExternalGa4, callExternalMcp } from "../src/services/external-clients.js";

type CheckResult = {
  name: string;
  status: "ok" | "skipped" | "failed";
  details: string;
};

async function checkExternalApi(): Promise<CheckResult> {
  if (!env.EXTERNAL_API_BEARER) {
    return {
      name: "External API (Google/Meta Directory)",
      status: "skipped",
      details: "EXTERNAL_API_BEARER not configured"
    };
  }

  try {
    const response = (await callExternalApi({ path: "/health" })) as { ok?: boolean; status?: string } | undefined;
    const status = response?.ok ?? response?.status ?? "unknown";
    return {
      name: "External API (Google/Meta Directory)",
      status: "ok",
      details: `Healthcheck returned ${JSON.stringify(response) ?? status}`
    };
  } catch (error) {
    return {
      name: "External API (Google/Meta Directory)",
      status: "failed",
      details: (error as Error).message
    };
  }
}

async function checkMcp(): Promise<CheckResult> {
  if (!env.EXTERNAL_MCP_TOKEN) {
    return {
      name: "External MCP",
      status: "skipped",
      details: "EXTERNAL_MCP_TOKEN not configured"
    };
  }

  try {
    const response = (await callExternalMcp({
      path: "/tools/health_check/call",
      method: "POST",
      body: {}
    })) as { ok?: boolean; data?: unknown } | undefined;
    return {
      name: "External MCP",
      status: "ok",
      details: `Health check responded: ${JSON.stringify(response)}`
    };
  } catch (error) {
    return {
      name: "External MCP",
      status: "failed",
      details: (error as Error).message
    };
  }
}

async function checkGa4(): Promise<CheckResult> {
  if (!env.EXTERNAL_GA4_TOKEN) {
    return {
      name: "GA4 Cloud Run",
      status: "skipped",
      details: "EXTERNAL_GA4_TOKEN not configured"
    };
  }

  const propertyId = process.env.GA4_CHECK_PROPERTY_ID;

  if (!propertyId) {
    return {
      name: "GA4 Cloud Run",
      status: "skipped",
      details: "Set GA4_CHECK_PROPERTY_ID to run the validation against /ga4/properties/:id/runReport"
    };
  }

  const rangeStart = process.env.GA4_CHECK_START_DATE ?? "2025-01-01";
  const rangeEnd = process.env.GA4_CHECK_END_DATE ?? "2025-01-02";

  try {
    const response = await callExternalGa4({
      path: `/ga4/properties/${propertyId}/runReport`,
      method: "POST",
      body: {
        metrics: [{ name: "sessions" }],
        dimensions: [{ name: "date" }],
        dateRanges: [{ startDate: rangeStart, endDate: rangeEnd }],
        limit: 1
      }
    });

    return {
      name: "GA4 Cloud Run",
      status: "ok",
      details: `runReport executed successfully: ${JSON.stringify(response)}`
    };
  } catch (error) {
    return {
      name: "GA4 Cloud Run",
      status: "failed",
      details: (error as Error).message
    };
  }
}

async function main() {
  const checks = await Promise.all([checkExternalApi(), checkMcp(), checkGa4()]);
  const hasFailure = checks.some((check) => check.status === "failed");

  console.table(
    checks.map((check) => ({
      Name: check.name,
      Status: check.status,
      Details: check.details
    }))
  );

  if (hasFailure) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Failed to run integration checks", error);
  process.exit(1);
});
