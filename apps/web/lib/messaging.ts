'use client';

import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";

import { getFirebaseApp } from "./firebase";

let messagingPromise: Promise<Messaging | null> | null = null;

async function getMessagingClient(): Promise<Messaging | null> {
  if (messagingPromise) {
    return messagingPromise;
  }

  messagingPromise = (async () => {
    const app = getFirebaseApp();
    if (!app) {
      return null;
    }
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      return null;
    }
    return getMessaging(app);
  })();

  return messagingPromise;
}

export type FcmTokenResult = {
  token: string | null;
  error?: string;
};

export async function getFcmToken(
  registration?: ServiceWorkerRegistration
): Promise<FcmTokenResult> {
  const messaging = await getMessagingClient();
  if (!messaging) {
    return { token: null, error: "Messaging client indisponivel" };
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });
    return { token: token ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha desconhecida ao obter token FCM";
    return { token: null, error: message };
  }
}
