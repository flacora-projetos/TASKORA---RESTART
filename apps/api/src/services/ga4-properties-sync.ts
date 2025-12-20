import { getFirestoreDb } from "../firebase.js";
import { GA4_CLIENTS, type Ga4ClientConfig } from "../config/ga4-clients.js";
import { callExternalGa4 } from "./external-clients.js";

type Ga4Property = {
  propertyId?: string;
  displayName?: string;
  name?: string;
};

type SyncOptions = {
  dryRun?: boolean;
  logger?: Pick<Console, "log" | "warn" | "error">;
};

type ClientDoc = FirebaseFirestore.DocumentSnapshot<FirebaseFirestore.DocumentData>;

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function normalizePropertyId(value: string): string {
  const trimmed = value.trim();
  const suffix = trimmed.replace(/^properties\//i, "");
  return `properties/${suffix}`;
}

async function fetchAccountProperties(accountId: string, searchTerm: string): Promise<string[]> {
  const query = {
    account: `accounts/${accountId}`,
    name: searchTerm
  };

  const response = (await callExternalGa4({
    path: "/ga4/properties",
    query
  })) as { properties?: Ga4Property[]; ok?: boolean; data?: { properties?: Ga4Property[] } };

  const properties = response.properties ?? response.data?.properties ?? [];
  return Array.from(
    new Set(
      properties
        .map((property) => property.propertyId ?? property.name ?? "")
        .filter((value): value is string => Boolean(value))
        .map(normalizePropertyId)
    )
  );
}

function buildClientIndex(docs: ClientDoc[]): Map<string, ClientDoc[]> {
  const index = new Map<string, ClientDoc[]>();
  docs.forEach((doc) => {
    const data = doc.data() as { name?: string };
    const key = data.name ? normalizeText(data.name) : "";
    if (!key) {
      return;
    }
    const group = index.get(key) ?? [];
    group.push(doc);
    index.set(key, group);
  });
  return index;
}

function findMatchingDocs(
  index: Map<string, ClientDoc[]>,
  config: Ga4ClientConfig
): ClientDoc[] {
  const keys = [config.clientName, ...(config.aliases ?? [])].map(normalizeText);
  const matches: ClientDoc[] = [];
  for (const key of keys) {
    const docs = index.get(key);
    if (docs) {
      matches.push(...docs);
    }
  }
  return matches;
}

export async function syncGa4Properties({
  dryRun = false,
  logger = console
}: SyncOptions = {}): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error("Firestore nao configurado");
  }

  const snapshot = await db.collection("clients").get();
  const index = buildClientIndex(snapshot.docs);

  for (const config of GA4_CLIENTS) {
    const docs = findMatchingDocs(index, config);
    if (docs.length === 0) {
      logger.warn?.(
        `[ga4-properties] Cliente nao encontrado para ${config.clientName}`
      );
      continue;
    }

    let propertyIds: string[] = [];
    let fetchError: Error | null = null;
    try {
      const term = config.searchTerm ?? config.clientName;
      propertyIds = await fetchAccountProperties(config.accountId, term);
    } catch (error) {
      fetchError = error as Error;
      logger.error?.(
        `[ga4-properties] Falha ao consultar conta ${config.accountId}: ${fetchError.message}`
      );
    }

    const fallbackIds = Array.from(
      new Set((config.fallbackPropertyIds ?? []).map((value) => normalizePropertyId(value)))
    );

    if (propertyIds.length === 0 && fallbackIds.length > 0) {
      if (fetchError) {
        logger.warn?.(
          `[ga4-properties] Usando fallback de properties para ${config.clientName} (${config.accountId}).`
        );
      }
      propertyIds = [...fallbackIds];
    } else if (propertyIds.length > 0 && fallbackIds.length > 0) {
      propertyIds = Array.from(new Set([...propertyIds, ...fallbackIds]));
    }

    if (propertyIds.length === 0) {
      logger.warn?.(
        `[ga4-properties] Nenhuma property retornada para ${config.clientName} (${config.accountId})`
      );
      continue;
    }

    for (const doc of docs) {
      const data = doc.data() as {
        ga4PropertyIds?: string[];
        integrations?: { ga4PropertyIds?: string[] } | null;
      };

      const current = data.ga4PropertyIds ?? [];
      const merged = Array.from(new Set([...propertyIds, ...current])).map((value) =>
        normalizePropertyId(value)
      );

      logger.log?.(
        `[ga4-properties] ${config.clientName} (${doc.id}) => ${merged.join(", ")}`
      );

      if (dryRun) {
        continue;
      }

      const updates: Record<string, unknown> = {
        ga4PropertyIds: merged,
        updatedAt: new Date().toISOString()
      };

      if (data.integrations) {
        updates["integrations.ga4PropertyIds"] = merged;
      }

      await doc.ref.update(updates);
    }
  }
}
