import { env } from "../env.js";
import { firebaseAuthConfigured, getFirebaseAuth } from "../firebase.js";

type BaseClaims = {
  uid: string;
  email?: string;
  orgId?: string;
  roles?: unknown;
  [key: string]: unknown;
};

export type AuthenticatedUser = {
  uid: string;
  email?: string;
  orgId?: string;
  roles: string[];
  displayName?: string;
  photoUrl?: string;
  claims: Record<string, unknown>;
};

class AuthVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthVerificationError";
  }
}

function normalizeRoles(value: unknown): string[] {
  if (Array.isArray(value)) {
    const roles = value.map((item) => String(item));
    return roles.length ? roles : ["analista"];
  }
  if (typeof value === "string" && value.length > 0) {
    return [value];
  }
  return ["analista"];
}

function mapToAuthenticatedUser(claims: BaseClaims): AuthenticatedUser {
  return {
    uid: claims.uid,
    email: typeof claims.email === "string" ? claims.email : undefined,
    orgId: typeof claims.orgId === "string" ? claims.orgId : undefined,
    displayName: typeof claims.name === "string" ? claims.name : undefined,
    photoUrl: typeof claims.picture === "string" ? claims.picture : undefined,
    roles: normalizeRoles(claims.roles),
    claims
  };
}

function decodeFakeToken(token: string): AuthenticatedUser {
  let payload: BaseClaims;

  try {
    const buffer = Buffer.from(token, "base64");
    const json = buffer.toString("utf-8");
    payload = JSON.parse(json) as BaseClaims;
  } catch {
    try {
      payload = JSON.parse(token) as BaseClaims;
    } catch {
      throw new AuthVerificationError("Invalid development token format");
    }
  }

  if (!payload.uid) {
    throw new AuthVerificationError("Development token missing uid");
  }

  return mapToAuthenticatedUser(payload);
}

export async function verifyAccessToken(token: string): Promise<AuthenticatedUser> {
  if (!token) {
    throw new AuthVerificationError("Missing token");
  }

  if (firebaseAuthConfigured) {
    const auth = getFirebaseAuth();
    if (!auth) {
      throw new AuthVerificationError("Firebase Auth not initialized");
    }

    try {
      const decoded = await auth.verifyIdToken(token, true);
      return mapToAuthenticatedUser(decoded as BaseClaims);
    } catch {
      throw new AuthVerificationError("Invalid or expired Firebase token");
    }
  }

  if (!env.AUTH_ALLOW_INSECURE) {
    throw new AuthVerificationError("Auth credentials missing and insecure mode disabled");
  }

  return decodeFakeToken(token);
}
