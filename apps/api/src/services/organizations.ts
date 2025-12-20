import { firestoreConfigured, getFirestoreDb } from "../firebase.js";
import type { OrganizationEntity, OrganizationMemberEntity, OrganizationMemberRole } from "../types/organizations.js";
import type { AuthenticatedUser } from "./auth.js";

const DEFAULT_ORG_ID = "Dacora";
const DEFAULT_ORG: OrganizationEntity = {
  id: DEFAULT_ORG_ID,
  name: "Dacora",
  slug: "dacora",
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z",
  ownerUid: null
};

const MEMBER_ROLES: OrganizationMemberRole[] = ["admin", "member"];

function normalizeMemberRoles(input: unknown): OrganizationMemberRole[] {
  if (!Array.isArray(input)) {
    return ["member"];
  }

  const normalized = input
    .map((role) => String(role).toLowerCase())
    .filter((role): role is OrganizationMemberRole => MEMBER_ROLES.includes(role as OrganizationMemberRole));

  return normalized.length ? normalized : ["member"];
}

function buildMemberId(orgId: string, userId: string): string {
  return `${orgId}_${userId}`;
}

async function fetchOrganizationsByIds(ids: string[]): Promise<OrganizationEntity[]> {
  if (!firestoreConfigured || ids.length === 0) {
    return [];
  }

  const db = getFirestoreDb();
  if (!db) {
    return [];
  }

  const snapshot = await db.getAll(...ids.map((id) => db.collection("organizations").doc(id)));
  return snapshot
    .filter((doc) => doc.exists)
    .map((doc) => {
      const data = doc.data();
      if (!data) {
        return null;
      }
      return {
        id: doc.id,
        name: String(data.name ?? doc.id),
        slug: String(data.slug ?? doc.id),
        createdAt: String(data.createdAt ?? new Date().toISOString()),
        updatedAt: String(data.updatedAt ?? new Date().toISOString()),
        ownerUid: data.ownerUid ? String(data.ownerUid) : null
      } as OrganizationEntity;
    })
    .filter((org): org is OrganizationEntity => Boolean(org));
}

async function fetchMembershipsByUser(userId: string): Promise<OrganizationMemberEntity[]> {
  if (!firestoreConfigured) {
    return [];
  }

  const db = getFirestoreDb();
  if (!db) {
    return [];
  }

  const snapshot = await db.collection("organizationMembers").where("userId", "==", userId).get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      orgId: String(data.orgId),
      userId: String(data.userId),
      roles: normalizeMemberRoles(data.roles),
      createdAt: String(data.createdAt ?? new Date().toISOString())
    };
  });
}

async function fetchOrgIdsByMemberEmail(email: string): Promise<string[]> {
  if (!firestoreConfigured || !email) {
    return [];
  }

  const db = getFirestoreDb();
  if (!db) {
    return [];
  }

  const snapshot = await db
    .collection("team_members")
    .where("email", "==", email)
    .where("status", "==", "active")
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return data?.orgId ? String(data.orgId) : null;
    })
    .filter((orgId): orgId is string => Boolean(orgId));
}

export async function listOrganizationsForUser(user: AuthenticatedUser): Promise<OrganizationEntity[]> {
  const fallbackOrgId = user.orgId ?? DEFAULT_ORG_ID;

  const memberships = user.uid ? await fetchMembershipsByUser(user.uid) : [];
  const memberOrgIds = memberships.map((member) => member.orgId);
  const emailOrgIds = user.email ? await fetchOrgIdsByMemberEmail(user.email) : [];
  const ids = Array.from(new Set([...memberOrgIds, ...emailOrgIds].filter(Boolean)));
  if (fallbackOrgId && !ids.includes(fallbackOrgId)) {
    ids.push(fallbackOrgId);
  }

  if (!firestoreConfigured) {
    const effectiveIds = ids.length > 0 ? ids : [DEFAULT_ORG_ID];
    return effectiveIds.map((id) => ({
      ...DEFAULT_ORG,
      id,
      slug: id.toLowerCase(),
      name: id
    }));
  }

  const orgs = await fetchOrganizationsByIds(ids);
  return orgs.length > 0
    ? orgs
    : [
        {
          ...DEFAULT_ORG,
          id: fallbackOrgId,
          name: fallbackOrgId,
          slug: fallbackOrgId.toLowerCase()
        }
      ];
}

export async function isUserMemberOfOrg(
  orgId: string | null | undefined,
  user: AuthenticatedUser
): Promise<boolean> {
  if (!orgId || !user.uid) {
    return false;
  }

  // Fallback: quando nao ha Firestore ou o token ja esta atrelado a org.
  if (!firestoreConfigured) {
    return user.orgId ? user.orgId === orgId : true;
  }

  const db = getFirestoreDb();
  if (!db) {
    return false;
  }

  const membershipDoc = await db.collection("organizationMembers").doc(buildMemberId(orgId, user.uid)).get();
  if (membershipDoc.exists) {
    return true;
  }

  // Fallback: se houver team_member ativo com mesmo email na org, considerar membro.
  if (user.email) {
    const candidates = Array.from(new Set([user.email, user.email.toLowerCase()].filter(Boolean)));
    const match = await db
      .collection("team_members")
      .where("orgId", "==", orgId)
      .where("email", "in", candidates)
      .where("status", "==", "active")
      .limit(1)
      .get();
    if (!match.empty) {
      return true;
    }
  }

  // Se nao houver registro, aceitar se o token ja trouxer orgId igual (compat transicao) ou se estivermos no org padrao.
  if (user.orgId === orgId) {
    return true;
  }

  return false;
}

export function pickActiveOrgId(
  requestedOrgId: string | null | undefined,
  organizations: OrganizationEntity[],
  userOrgId?: string | null
): string | null {
  const orgIds = organizations.map((org) => org.id);
  if (requestedOrgId && orgIds.includes(requestedOrgId)) {
    return requestedOrgId;
  }
  if (userOrgId && orgIds.includes(userOrgId)) {
    return userOrgId;
  }
  return organizations.length > 0 ? organizations[0].id : null;
}
