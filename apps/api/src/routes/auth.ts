import type { FastifyInstance } from "fastify";

import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import { isAdminUser } from "../auth/is-admin.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/me",
    {
      preHandler: app.authenticate
    },
    async (request) => {
      const user = request.user;
      let profile: Record<string, unknown> | null = null;

      if (firestoreConfigured && user?.uid) {
        const db = getFirestoreDb();
        if (db) {
          const doc = await db.collection("users").doc(user.uid).get();
          profile = doc.exists ? doc.data() ?? null : null;
        }
      }

      return {
        uid: user?.uid ?? null,
        email: user?.email ?? null,
        displayName: user?.displayName ?? (profile && typeof (profile as Record<string, unknown>).displayName === "string"
          ? (profile as Record<string, string>).displayName
          : null),
        photoUrl:
          user?.photoUrl ??
          (profile && typeof (profile as Record<string, unknown>).photoURL === "string"
            ? (profile as Record<string, string>).photoURL
            : null),
        orgId: user?.orgId ?? null,
        roles: user?.roles ?? [],
        claims: user?.claims ?? {},
        profile,
        isAdmin: isAdminUser(user ?? undefined)
      };
    }
  );
}
