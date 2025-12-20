import type { Firestore } from "firebase-admin/firestore";

import { firestoreConfigured, getFirestoreDb } from "../firebase.js";

export type DirectoryClientCacheEntity = {
  id: string;
  name: string;
  nameLowercase: string;
  aliases: string[];
  platforms: string[];
  googleCustomerIds: string[];
  metaAccountIds: string[];
  ga4PropertyIds: string[];
  searchText: string;
  directorySnapshot: Record<string, unknown> | null;
  syncedAt: string | null;
  updatedAt: string;
};

export type DirectoryCacheStats = {
  total: number;
  lastSyncedAt: string | null;
};

export interface DirectoryClientsRepository {
  upsertMany(records: DirectoryClientCacheEntity[]): Promise<void>;
  deleteWhereSyncedBefore(timestamp: string): Promise<void>;
  listAll(): Promise<DirectoryClientCacheEntity[]>;
  getStats(): Promise<DirectoryCacheStats>;
  findById(id: string): Promise<DirectoryClientCacheEntity | null>;
}

class FirestoreDirectoryClientsRepository implements DirectoryClientsRepository {
  private readonly collection;

  constructor(db: Firestore) {
    this.collection = db.collection("directory_clients");
  }

  private docToEntity(
    doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot,
  ): DirectoryClientCacheEntity {
    const data = doc.data() as Omit<DirectoryClientCacheEntity, "id"> | undefined;
    if (!data) {
      throw new Error("Invalid directory cache document");
    }
    return {
      id: doc.id,
      ...data
    };
  }

  async upsertMany(records: DirectoryClientCacheEntity[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    let batch = this.collection.firestore.batch();
    let operations = 0;

    for (const record of records) {
      const docRef = this.collection.doc(record.id);
      batch.set(docRef, record, { merge: true });
      operations += 1;

      if (operations === 400) {
        await batch.commit();
        batch = this.collection.firestore.batch();
        operations = 0;
      }
    }

    if (operations > 0) {
      await batch.commit();
    }
  }

  async deleteWhereSyncedBefore(timestamp: string): Promise<void> {
    const snapshot = await this.collection.where("syncedAt", "<", timestamp).get();
    if (snapshot.empty) {
      return;
    }

    let batch = this.collection.firestore.batch();
    let operations = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      operations += 1;

      if (operations === 400) {
        await batch.commit();
        batch = this.collection.firestore.batch();
        operations = 0;
      }
    }

    if (operations > 0) {
      await batch.commit();
    }
  }

  async listAll(): Promise<DirectoryClientCacheEntity[]> {
    const snapshot = await this.collection.orderBy("nameLowercase").get();
    return snapshot.docs.map((doc) => this.docToEntity(doc));
  }

  async getStats(): Promise<DirectoryCacheStats> {
    const snapshot = await this.collection.select("syncedAt").get();
    if (snapshot.empty) {
      return { total: 0, lastSyncedAt: null };
    }
    let lastSyncedAt: string | null = null;
    for (const doc of snapshot.docs) {
      const data = doc.data() as Partial<DirectoryClientCacheEntity>;
      if (data.syncedAt && (!lastSyncedAt || data.syncedAt > lastSyncedAt)) {
        lastSyncedAt = data.syncedAt;
      }
    }
    return { total: snapshot.size, lastSyncedAt };
  }

  async findById(id: string): Promise<DirectoryClientCacheEntity | null> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return this.docToEntity(doc as FirebaseFirestore.QueryDocumentSnapshot);
  }
}

class InMemoryDirectoryClientsRepository implements DirectoryClientsRepository {
  private store = new Map<string, DirectoryClientCacheEntity>();

  async upsertMany(records: DirectoryClientCacheEntity[]): Promise<void> {
    for (const record of records) {
      this.store.set(record.id, record);
    }
  }

  async deleteWhereSyncedBefore(timestamp: string): Promise<void> {
    for (const [id, record] of this.store.entries()) {
      if (record.syncedAt && record.syncedAt < timestamp) {
        this.store.delete(id);
      }
    }
  }

  async listAll(): Promise<DirectoryClientCacheEntity[]> {
    return Array.from(this.store.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getStats(): Promise<DirectoryCacheStats> {
    const items = await this.listAll();
    if (items.length === 0) {
      return { total: 0, lastSyncedAt: null };
    }
    const lastSyncedAt = items.reduce<string | null>((acc, item) => {
      if (!item.syncedAt) {
        return acc;
      }
      if (!acc || item.syncedAt > acc) {
        return item.syncedAt;
      }
      return acc;
    }, null);
    return { total: items.length, lastSyncedAt };
  }

  async findById(id: string): Promise<DirectoryClientCacheEntity | null> {
    return this.store.get(id) ?? null;
  }
}

let repository: DirectoryClientsRepository | null = null;

export function getDirectoryClientsRepository(): DirectoryClientsRepository {
  if (!repository) {
    const db = firestoreConfigured ? getFirestoreDb() : null;
    repository = db ? new FirestoreDirectoryClientsRepository(db) : new InMemoryDirectoryClientsRepository();
  }
  return repository;
}
