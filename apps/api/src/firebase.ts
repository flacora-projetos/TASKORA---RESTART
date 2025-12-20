import admin from "firebase-admin";

import { env } from "./env.js";

const hasCredentials =
  Boolean(env.FIREBASE_PROJECT_ID) &&
  Boolean(env.FIREBASE_CLIENT_EMAIL) &&
  Boolean(env.FIREBASE_PRIVATE_KEY);

let firebaseApp: admin.app.App | null = null;
let firestoreDb: FirebaseFirestore.Firestore | null = null;
let messaging: admin.messaging.Messaging | null = null;

function initializeFirebaseApp(): void {
  if (firebaseApp || !hasCredentials) {
    return;
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID!,
      clientEmail: env.FIREBASE_CLIENT_EMAIL!,
      privateKey: env.FIREBASE_PRIVATE_KEY!
    })
  });
}

export function getFirebaseAuth(): admin.auth.Auth | null {
  if (!hasCredentials) {
    return null;
  }

  if (!firebaseApp) {
    initializeFirebaseApp();
  }

  return firebaseApp ? admin.auth(firebaseApp) : null;
}

export function getFirestoreDb(): FirebaseFirestore.Firestore | null {
  if (!hasCredentials) {
    return null;
  }

  if (!firebaseApp) {
    initializeFirebaseApp();
  }

  if (!firebaseApp) {
    return null;
  }

  if (!firestoreDb) {
    firestoreDb = admin.firestore(firebaseApp);
  }

  return firestoreDb;
}

export function getFirebaseMessaging(): admin.messaging.Messaging | null {
  if (!hasCredentials) {
    return null;
  }

  if (!firebaseApp) {
    initializeFirebaseApp();
  }

  if (!firebaseApp) {
    return null;
  }

  if (!messaging) {
    messaging = admin.messaging(firebaseApp);
  }

  return messaging;
}

export const firebaseAuthConfigured = hasCredentials;
export const firestoreConfigured = hasCredentials;
