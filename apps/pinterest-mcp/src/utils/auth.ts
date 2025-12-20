import type { FastifyRequest } from "fastify";

import { env } from "../env.js";

export function extractAuthToken(request: FastifyRequest): string | null {
  const headerToken = request.headers["x-internal-token"] ?? request.headers["x-internal-secret"];
  if (typeof headerToken === "string" && headerToken.trim().length > 0) {
    return headerToken.trim();
  }

  const authHeader = request.headers.authorization ?? request.headers.Authorization;
  if (typeof authHeader === "string") {
    const normalized = authHeader.trim();
    if (normalized.toLowerCase().startsWith("bearer ")) {
      return normalized.slice(7).trim();
    }
    return normalized;
  }

  return null;
}

export function ensureAuthorized(request: FastifyRequest): void {
  const token = extractAuthToken(request);
  if (!token || token !== env.MCP_INTERNAL_TOKEN) {
    const err = new Error("Invalid or missing token.");
    (err as Error & { statusCode?: number }).statusCode = 401;
    throw err;
  }
}
