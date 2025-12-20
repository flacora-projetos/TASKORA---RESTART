import crypto from "node:crypto";

import { env } from "../env.js";

type PinterestStatePayload = {
  orgId: string;
  clientId: string;
  userId: string | null;
  redirectUri: string;
  nonce: string;
  exp: number;
};

type CreateStateInput = {
  orgId: string;
  clientId: string;
  userId: string | null;
  redirectUri: string;
  expiresInMs?: number;
};

type PinterestRawTokenResponse = {
  access_token: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
} & Record<string, unknown>;

export type PinterestTokenResult = {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string | null;
  scope: string | null;
  expiresAt: string | null;
  refreshTokenExpiresAt: string | null;
  raw: PinterestRawTokenResponse;
};

const allowedRedirects = env.PINTEREST_ALLOWED_REDIRECTS.split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);

const pinterestScopes = env.PINTEREST_SCOPES.split(",")
  .map((scope) => scope.trim())
  .filter((scope) => scope.length > 0);

export function isPinterestConfigured(): boolean {
  return Boolean(env.PINTEREST_APP_ID && env.PINTEREST_APP_SECRET);
}

export function isRedirectAllowed(redirectUri: string): boolean {
  const normalized = redirectUri.trim().toLowerCase();
  return allowedRedirects.some((entry) => entry.toLowerCase() === normalized);
}

export function createPinterestState({
  orgId,
  clientId,
  userId,
  redirectUri,
  expiresInMs = 10 * 60 * 1000
}: CreateStateInput): { state: string; payload: PinterestStatePayload } {
  const payload: PinterestStatePayload = {
    orgId,
    clientId,
    userId,
    redirectUri,
    nonce: crypto.randomBytes(16).toString("hex"),
    exp: Date.now() + expiresInMs
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const signature = crypto.createHmac("sha256", env.PINTEREST_APP_SECRET).update(encoded).digest("base64url");
  return {
    state: `${encoded}.${signature}`,
    payload
  };
}

export function verifyPinterestState(state: string): PinterestStatePayload {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid state");
  }

  const expectedSignature = crypto.createHmac("sha256", env.PINTEREST_APP_SECRET).update(encodedPayload).digest("base64url");
  const sigBuffer = Buffer.from(signature, "base64url");
  const expectedBuffer = Buffer.from(expectedSignature, "base64url");

  if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    throw new Error("State signature mismatch");
  }

  const decoded = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf-8")) as PinterestStatePayload;
  if (typeof decoded.exp === "number" && Date.now() > decoded.exp) {
    throw new Error("State expired");
  }
  return decoded;
}

export function buildPinterestAuthorizationUrl(redirectUri: string, state: string): string {
  const url = new URL(env.PINTEREST_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", env.PINTEREST_APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", pinterestScopes.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangePinterestCode(params: { code: string; redirectUri: string }): Promise<PinterestTokenResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: env.PINTEREST_APP_ID,
    client_secret: env.PINTEREST_APP_SECRET
  });

  const response = await fetch(env.PINTEREST_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    let message = `Pinterest token exchange failed with status ${response.status}`;
    try {
      const errorBody = (await response.json()) as { error?: string; error_description?: string };
      if (errorBody?.error_description) {
        message = errorBody.error_description;
      } else if (errorBody?.error) {
        message = errorBody.error;
      }
    } catch {
      // ignore JSON errors
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as PinterestRawTokenResponse;
  if (!raw.access_token) {
    throw new Error("Pinterest did not return an access token");
  }

  const now = Date.now();
  const expiresAt =
    typeof raw.expires_in === "number" ? new Date(now + raw.expires_in * 1000).toISOString() : null;
  const refreshTokenExpiresAt =
    typeof raw.refresh_token_expires_in === "number"
      ? new Date(now + raw.refresh_token_expires_in * 1000).toISOString()
      : null;

  return {
    accessToken: raw.access_token,
    refreshToken: raw.refresh_token ?? null,
    tokenType: raw.token_type ?? null,
    scope: raw.scope ?? null,
    expiresAt,
    refreshTokenExpiresAt,
    raw
  };
}

export type { PinterestStatePayload };
