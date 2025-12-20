import fs from "node:fs";
import path from "node:path";

import admin from "firebase-admin";
import { z } from "zod";

const seedFilePath = process.argv[2] ?? path.resolve(process.cwd(), "seeds/users.json");

const credentialCandidates = [
  process.env.FIREBASE_CREDENTIALS_PATH,
  path.resolve(process.cwd(), "service-account.json"),
  path.resolve(process.cwd(), "..", "service-account.json"),
  path.resolve(process.cwd(), "..", "..", "service-account.json")
].filter((candidate): candidate is string => Boolean(candidate));

const credentialsPath = credentialCandidates.find((candidate) => fs.existsSync(candidate));

if (!credentialsPath) {
  console.error("Unable to locate Firebase service account JSON. Set FIREBASE_CREDENTIALS_PATH or place the file at the repo root.");
  process.exit(1);
}

if (!fs.existsSync(seedFilePath)) {
  console.error(`Seed file not found: ${seedFilePath}`);
  process.exit(1);
}

const seedSchema = z.array(
  z.object({
    email: z.string().email(),
    displayName: z.string().min(1),
    orgId: z.string().min(1),
    roles: z.array(z.string()).default([]),
    disabled: z.boolean().optional()
  })
);

type SeedUser = z.infer<typeof seedSchema>[number];

const seedData = seedSchema.parse(JSON.parse(fs.readFileSync(seedFilePath, "utf-8")));

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(fs.readFileSync(credentialsPath, "utf-8")))
});

const auth = admin.auth();
const firestore = admin.firestore();

async function syncUser(entry: SeedUser): Promise<void> {
  const { email, displayName, disabled = false, orgId, roles } = entry;

  let userRecord: admin.auth.UserRecord | null = null;

  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, { displayName, disabled });
  } catch (error) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      userRecord = await auth.createUser({ email, displayName, disabled, emailVerified: true });
    } else {
      throw error;
    }
  }

  if (!userRecord) {
    return;
  }

  const claims = { orgId, roles };
  await auth.setCustomUserClaims(userRecord.uid, claims);

  await firestore
    .collection("users")
    .doc(userRecord.uid)
    .set(
      {
        email,
        displayName,
        orgId,
        roles,
        disabled,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );

  console.log(`Synced ${email} (${userRecord.uid})`);
}

async function main(): Promise<void> {
  for (const entry of seedData) {
    await syncUser(entry);
  }

  console.log(`\nFinished syncing ${seedData.length} users.`);
}

main().catch((error) => {
  console.error("Failed to sync users", error);
  process.exit(1);
});
