import fs from 'node:fs';
import path from 'node:path';

import admin from 'firebase-admin';

const searchPaths = [
  process.env.FIREBASE_CREDENTIALS_PATH,
  path.resolve(process.cwd(), 'service-account.json'),
  path.resolve(process.cwd(), '..', 'service-account.json'),
  path.resolve(process.cwd(), '..', '..', 'service-account.json'),
].filter(Boolean) as string[];

const credentialPath = searchPaths.find((candidate) =>
  fs.existsSync(candidate)
);

if (!credentialPath) {
  console.error(
    'Could not find service account JSON. ' +
      'Set FIREBASE_CREDENTIALS_PATH or place the file at the repo root.'
  );
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf-8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const targetCollections = process.argv.slice(2);

async function deleteCollection(
  collectionPath: string,
  batchSize = 500
): Promise<void> {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.limit(batchSize).get();

  if (snapshot.size === 0) {
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  // Recurse until the collection is empty.
  await deleteCollection(collectionPath, batchSize);
}

async function main(): Promise<void> {
  const collections =
    targetCollections.length > 0
      ? targetCollections
      : (await db.listCollections()).map((col) => col.id);

  if (collections.length === 0) {
    console.log('No collections found. Nothing to delete.');
    return;
  }

  console.log(`Deleting collections: ${collections.join(', ')}`);

  for (const collectionName of collections) {
    console.log(`\n> ${collectionName}`);
    await deleteCollection(collectionName);
  }

  console.log('\nFirestore cleanup finished.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
