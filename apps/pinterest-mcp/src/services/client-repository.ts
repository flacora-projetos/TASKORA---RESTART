import { firestoreConfigured, getFirestoreDb } from "../firebase.js";

export type PinterestIntegration = {
  accessToken: string;
  refreshToken?: string | null;
  tokenType?: string | null;
  scope?: string | null;
  expiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
  linkedAt?: string | null;
};

type ClientRecord = {
  id: string;
  name?: string;
  orgId: string;
  integrations?: {
    pinterest?: PinterestIntegration | null;
  };
  pinterestAccountIds?: string[] | null;
};

export type ClientPinterestContext = {
  clientId: string;
  orgId: string;
  clientName: string | null;
  pinterestAccountIds: string[];
  pinterest: PinterestIntegration;
};

export async function findClientPinterestIntegration(
  clientId: string,
  orgId?: string | null
): Promise<ClientPinterestContext> {
  if (!firestoreConfigured) {
    throw new Error("Firebase não configurado para consultar clientes.");
  }

  const db = getFirestoreDb();
  if (!db) {
    throw new Error("Firestore não disponível.");
  }

  const snapshot = await db.collection("clients").doc(clientId).get();
  if (!snapshot.exists) {
    throw new Error("Cliente não encontrado.");
  }

  const data = snapshot.data() as ClientRecord;
  if (orgId && data.orgId !== orgId) {
    throw new Error("Cliente não pertence ao tenant informado.");
  }

  const pinterest = data.integrations?.pinterest;
  if (!pinterest || !pinterest.accessToken) {
    throw new Error("Cliente não possui integração Pinterest ativa.");
  }

  return {
    clientId,
    orgId: data.orgId,
    clientName: data.name ?? null,
    pinterestAccountIds: Array.isArray(data.pinterestAccountIds)
      ? (data.pinterestAccountIds as string[])
      : [],
    pinterest
  };
}
