'use client';

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiFetch } from "../../lib/api";
import { getFcmToken } from "../../lib/messaging";
import { getFirebaseApp } from "../../lib/firebase";
import { getMessaging, isSupported, onMessage } from "firebase/messaging";
import { useAuth } from "../auth/AuthProvider";
import { useActiveOrg } from "../org/OrgProvider";

type PushState = "idle" | "requesting" | "granted" | "denied" | "unsupported" | "error";

const STORAGE_KEY = "taskora_push_token_v1";
const ORG_STORAGE_KEY = "taskora_push_org_v1";
const MESSAGING_SW = "/firebase-messaging-sw.js";
const MESSAGING_SCOPE = "/firebase-messaging/";
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
const MESSAGING_SCOPE_PATH = getScopePath(MESSAGING_SCOPE) ?? MESSAGING_SCOPE;

type NavigatorUAData = {
  platform?: string;
};

function getPlatform(): string {
  if (typeof navigator === "undefined") {
    return "web";
  }
  // userAgentData A suportado em navegadores chromium mais recentes.
  const uaData = (navigator as { userAgentData?: NavigatorUAData }).userAgentData;
  if (uaData?.platform) {
    return uaData.platform;
  }
  return navigator.platform || "web";
}

function getScopePath(scope: string): string | null {
  try {
    return new URL(scope).pathname;
  } catch {
    return scope || null;
  }
}

function normalizeScopePath(scope: string | null | undefined): string {
  if (!scope) {
    return "";
  }
  const path = getScopePath(scope) ?? scope;
  if (path.endsWith("/")) {
    return path;
  }
  return `${path}/`;
}

function getRegistrationScript(reg: ServiceWorkerRegistration): string | null {
  return (
    reg.active?.scriptURL ||
    reg.waiting?.scriptURL ||
    reg.installing?.scriptURL ||
    reg.scope ||
    null
  );
}

function isMessagingRegistration(reg: ServiceWorkerRegistration): boolean {
  const script = getRegistrationScript(reg);
  return typeof script === "string" && script.includes("firebase-messaging-sw.js");
}

async function isBraveBrowser(): Promise<boolean> {
  if (typeof navigator === "undefined") {
    return false;
  }
  const nav = navigator as { brave?: { isBrave?: () => Promise<boolean> } };
  if (nav.brave?.isBrave) {
    try {
      return await nav.brave.isBrave();
    } catch {
      return false;
    }
  }
  const ua = navigator.userAgent ?? "";
  return /\bBrave\b/i.test(ua);
}

export function PushOptInCard(): JSX.Element | null {
  const { token, status } = useAuth();
  const { activeOrgId } = useActiveOrg();
  const isAuthenticated = status === "authenticated" && Boolean(token);

  const [state, setState] = useState<PushState>("idle");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testState, setTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [localTestState, setLocalTestState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [isBrave, setIsBrave] = useState(false);
  const [serverStatus, setServerStatus] = useState<{ token?: string | null; updatedAt?: string | null } | null>(null);
  const [resyncing, setResyncing] = useState(false);

  const canPrompt = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return false;
    }
    return true;
  }, []);

  const sendPushLog = useCallback(
    async (message: string, extras?: Record<string, unknown>) => {
      if (!token) {
        return;
      }
      try {
        await apiFetch("/notifications/push/log", {
          token,
          method: "POST",
          body: {
            message,
            stage: extras?.stage as string | undefined,
            detail: extras,
            platform: getPlatform(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
          }
        });
      } catch {
        // best-effort log
      }
    },
    [token]
  );

  const fetchServerStatus = useCallback(async () => {
    if (!token || !activeOrgId) {
      return;
    }
    try {
      const response = await apiFetch<{ latest: { token: string | null; updatedAt: string | null } | null }>(
        "/notifications/push/status",
        { token }
      );
      setServerStatus(response.latest ?? null);
    } catch {
      // ignore
    }
  }, [activeOrgId, token]);

  const handleLocalNotification = useCallback(async () => {
    setLocalTestState("sending");
    setFeedback(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration(MESSAGING_SCOPE).catch(() => null);
      if (!registration) {
        throw new Error("Service worker de push nao encontrado para emitir notificacao local.");
      }
      await registration.showNotification("Teste local do Taskora", {
        body: "Se voce viu esta mensagem, o navegador permite mostrar notificacoes.",
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-192x192.png",
        tag: "taskora-local-test"
      });
      setLocalTestState("sent");
      setFeedback("Notificacao local exibida. Se nao apareceu, verifique permissoes do navegador/OS.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao exibir notificacao local.";
      setLocalTestState("error");
      setFeedback(message);
      await sendPushLog("Falha ao exibir notificacao local", { stage: "local-notification", error: message });
    }
  }, [sendPushLog]);

  const registerTokenOnServer = useCallback(
    async (fcmToken: string, stage: "enable" | "refresh" | "org-resync" | "server-resync") => {
      if (!token || !activeOrgId) {
        return;
      }
      setResyncing(true);
      try {
        await apiFetch("/notifications/push", {
          token,
          method: "POST",
          body: {
            token: fcmToken,
            platform: getPlatform(),
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown"
          }
        });
        window.localStorage.setItem(STORAGE_KEY, fcmToken);
        window.localStorage.setItem(ORG_STORAGE_KEY, activeOrgId);
        await fetchServerStatus();
        setState("granted");
        setFeedback(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao sincronizar token de push.";
        setFeedback(message);
        await sendPushLog("Falha ao sincronizar token FCM", { stage, error: message });
      } finally {
        setResyncing(false);
      }
    },
    [activeOrgId, fetchServerStatus, sendPushLog, token]
  );

  useEffect(() => {
    if (!canPrompt) {
      setState("unsupported");
      return;
    }

    const permission = Notification.permission;
    if (permission === "denied") {
      setState("denied");
      setFeedback("As notificacoes estao bloqueadas no navegador. Libere nas permissoes do site para ativar.");
      return;
    }

    if (permission === "granted") {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (stored) {
        setState("granted");
      } else {
        setState("idle");
        setFeedback("Permissao concedida. Clique para finalizar o push.");
      }
      return;
    }

    setState("idle");
  }, [canPrompt]);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchServerStatus();
    }
  }, [fetchServerStatus, isAuthenticated]);

  useEffect(() => {
    if (!canPrompt) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const brave = await isBraveBrowser();
        if (!cancelled) {
          setIsBrave(brave);
        }
      } catch {
        // ignore
      }
      try {
        const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
        const legacy = registrations.filter(
          (reg) => isMessagingRegistration(reg) && normalizeScopePath(reg.scope) === "/"
        );
        await Promise.all(legacy.map((reg) => reg.unregister().catch(() => false)));
      } catch {
        // best-effort cleanup
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPrompt]);

  const ensureMessagingRegistration = useCallback(async (): Promise<ServiceWorkerRegistration | null> => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
      const scoped = registrations.find(
        (reg) => isMessagingRegistration(reg) && normalizeScopePath(reg.scope) === MESSAGING_SCOPE_PATH
      );

      if (scoped) {
        return scoped;
      }

      const legacy = registrations.filter(
        (reg) => isMessagingRegistration(reg) && normalizeScopePath(reg.scope) === "/"
      );
      await Promise.all(legacy.map((reg) => reg.unregister().catch(() => false)));

      const fresh = await navigator.serviceWorker.register(MESSAGING_SW, {
        updateViaCache: "none",
        scope: MESSAGING_SCOPE
      });
      return fresh;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !token || !activeOrgId) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    if (Notification.permission !== "granted") {
      return;
    }
    const storedToken = window.localStorage.getItem(STORAGE_KEY);
    if (!storedToken) {
      return;
    }
    const storedOrg = window.localStorage.getItem(ORG_STORAGE_KEY);
    if (storedOrg === activeOrgId) {
      return;
    }

    setSyncing(true);
    void registerTokenOnServer(storedToken, "org-resync").finally(() => setSyncing(false));
  }, [activeOrgId, isAuthenticated, registerTokenOnServer, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || typeof window === "undefined") {
      return;
    }
    if (!canPrompt || Notification.permission !== "granted") {
      return;
    }
    const storedToken = window.localStorage.getItem(STORAGE_KEY);
    if (!storedToken) {
      return;
    }
    let cancelled = false;

    const refreshExistingToken = async () => {
      const registration = await ensureMessagingRegistration();
      if (!registration) {
        return;
      }
      const { token: refreshed, error: refreshError } = await getFcmToken(registration);
      if (!refreshed || cancelled) {
        if (refreshError) {
          await sendPushLog("Falha ao renovar token FCM", { stage: "refresh", refreshError });
          setFeedback(refreshError);
        }
        return;
      }
      if (refreshed !== storedToken) {
        await registerTokenOnServer(refreshed, "refresh");
      } else if (!serverStatus?.token) {
        await registerTokenOnServer(refreshed, "server-resync");
      }
      setState("granted");
    };

    void refreshExistingToken();

    return () => {
      cancelled = true;
    };
  }, [
    activeOrgId,
    canPrompt,
    ensureMessagingRegistration,
    isAuthenticated,
    registerTokenOnServer,
    sendPushLog,
    serverStatus?.token,
    token
  ]);

  useEffect(() => {
    if (!isAuthenticated || !token || typeof window === "undefined") {
      return;
    }
    if (!canPrompt || Notification.permission !== "granted") {
      return;
    }
    // Listener para notificacoes quando a aba estiver em primeiro plano.
    let unsubscribe: (() => void) | undefined;
    (async () => {
      const app = getFirebaseApp();
      if (!app) {
        return;
      }
      const supported = await isSupported().catch(() => false);
      if (!supported) {
        return;
      }
      try {
        const messaging = getMessaging(app);
        unsubscribe = onMessage(messaging, async (payload) => {
          const title = payload?.notification?.title || "Taskora";
          const body = payload?.notification?.body || "Voce tem uma atualizacao.";
          const registration = await navigator.serviceWorker.getRegistration(MESSAGING_SCOPE).catch(() => null);
          if (registration) {
            await registration.showNotification(title, {
              body,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              tag: "taskora-foreground"
            });
          } else if (Notification.permission === "granted") {
            new Notification(title, { body, icon: "/icons/icon-192x192.png", tag: "taskora-foreground" });
          }
          await sendPushLog("Notificacao recebida em foreground", { stage: "foreground", payload });
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [canPrompt, isAuthenticated, sendPushLog, token]);

  useEffect(() => {
    if (!isAuthenticated || !token || typeof window === "undefined") {
      return;
    }
    if (!canPrompt || Notification.permission !== "granted") {
      return;
    }
    const storedToken = window.localStorage.getItem(STORAGE_KEY);
    if (!storedToken) {
      return;
    }
    if (serverStatus?.token && serverStatus.token === storedToken) {
      return;
    }
    void registerTokenOnServer(storedToken, "server-resync");
  }, [canPrompt, isAuthenticated, registerTokenOnServer, serverStatus?.token, token]);

  const handleEnable = useCallback(async () => {
    if (!canPrompt) {
      setState("unsupported");
      setFeedback("Seu navegador nao suporta notificacoes push.");
      return;
    }
    if (!token) {
      setFeedback("Faca login para ativar as notificacoes.");
      return;
    }
    if (!VAPID_KEY) {
      setState("error");
      setFeedback("Chave VAPID nao configurada. Atualize o .env do dashboard e refaca o deploy.");
      return;
    }

    // Se ja existe token armazenado e permissao concedida, nao re-registra SW para evitar refresh.
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (Notification.permission === "granted" && stored) {
      setState("granted");
      setFeedback(null);
      return;
    }
    if (state === "granted") {
      return;
    }

    setFeedback(null);
    setState("requesting");

    try {
      const supportStatus = {
        notifications: typeof Notification !== "undefined",
        serviceWorker: typeof navigator !== "undefined" && "serviceWorker" in navigator,
        pushManager: typeof window !== "undefined" && "PushManager" in window
      };

      if (!supportStatus.notifications || !supportStatus.serviceWorker) {
        throw new Error("Push nao suportado neste navegador (notifications ou service worker indisponivel).");
      }

      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "idle");
          setFeedback("Permita as notificacoes para receber alertas.");
          return;
        }
      }

      const registration = await ensureMessagingRegistration();

      if (!registration) {
        throw new Error("Service worker de push nao carregou. Abra /firebase-messaging-sw.js e tente novamente.");
      }

      const { token: fcmToken, error: tokenError } = await getFcmToken(registration);
      if (!fcmToken) {
        if (tokenError) {
          setFeedback(tokenError);
          await sendPushLog("Falha ao obter token FCM", {
            stage: "getToken",
            error: tokenError,
            permission: Notification.permission
          });
        }
        const brave = isBrave || (await isBraveBrowser());
        if (brave) {
          throw new Error(
            "Brave bloqueou o token de push. Habilite 'Use Google Services for Push Messaging' nas configuracoes do Brave e tente novamente."
          );
        }
        throw new Error("Nao foi possivel obter o token de push. Verifique a chave VAPID e as permissoes.");
      }

      await registerTokenOnServer(fcmToken, "enable");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao ativar push";
      try {
        const registrations = await navigator.serviceWorker
          .getRegistrations()
          .then((regs) => regs.map((reg) => reg.active?.scriptURL || reg.scope));
        console.error("Push opt-in falhou", {
          err,
          permission: typeof Notification !== "undefined" ? Notification.permission : "unknown",
          registrations
        });
      } catch {
        // logging best-effort
      }
      await sendPushLog("Falha ao ativar push", {
        stage: "enable",
        error: err instanceof Error ? err.message : String(err),
        permission: typeof Notification !== "undefined" ? Notification.permission : "unknown"
      });
      setFeedback(message);
      setState("error");
    }
  }, [canPrompt, ensureMessagingRegistration, isBrave, registerTokenOnServer, sendPushLog, state, token]);

  const handleTestPush = useCallback(async () => {
    if (!token) {
      setFeedback("Faca login para testar o push.");
      return;
    }
    setTestState("sending");
    setFeedback(null);
    try {
      await apiFetch("/notifications/test", { token, method: "POST" });
      setTestState("sent");
      setFeedback("Push de teste enviado. Se nao chegar, revisamos o log do Cloud Run.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao enviar o push de teste.";
      setTestState("error");
      setFeedback(message);
    }
  }, [token]);

  if (!isAuthenticated || state === "unsupported") {
    return null;
  }

  if (state === "granted") {
    return (
      <div className="rounded-xl border border-deepGreen/20 bg-deepGreen/5 px-5 py-4 text-sm text-deepGreen">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-deepGreen">Push ativo</p>
            <p className="text-xs text-deepGreen/80">
              {syncing
                ? "Sincronizando organizacao ativa..."
                : resyncing
                ? "Revalidando token de push..."
                : "Notificacoes habilitadas para esta organizacao."}
            </p>
            {serverStatus?.updatedAt ? (
              <p className="text-[11px] text-deepGreen/70">
                Token salvo em {new Date(serverStatus.updatedAt).toLocaleString("pt-BR")}
              </p>
            ) : null}
            {feedback ? <p className="text-xs text-rose-600">{feedback}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void handleTestPush()}
          disabled={testState === "sending"}
          className="inline-flex items-center justify-center rounded-full border border-deepGreen/30 px-4 py-2 text-xs font-semibold text-deepGreen transition hover:border-deepGreen/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {testState === "sending" ? "Testando..." : "Testar push"}
        </button>
        <button
          type="button"
          onClick={() => void handleLocalNotification()}
          disabled={localTestState === "sending"}
          className="inline-flex items-center justify-center rounded-full border border-deepGreen/30 px-4 py-2 text-xs font-semibold text-deepGreen transition hover:border-deepGreen/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {localTestState === "sending" ? "Testando local..." : "Testar notificacao local"}
        </button>
      </div>
    </div>
  );
}

  return (
    <div className="rounded-xl border border-deepGreen/20 bg-deepGreen/5 px-5 py-4 text-sm text-deepGreen">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-deepGreen">Ative notificacoes push</p>
          <p className="text-xs text-deepGreen/80">
            Receba alertas de tarefas, projetos, insights e horas (tempo real e resumo diario) direto no navegador/desktop.
          </p>
          {serverStatus?.updatedAt ? (
            <p className="text-[11px] text-deepGreen/70">
              Token no servidor: {new Date(serverStatus.updatedAt).toLocaleString("pt-BR")}
            </p>
          ) : null}
          {feedback ? <p className="text-xs text-rose-600">{feedback}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => void handleEnable()}
          disabled={state === "requesting"}
          className="inline-flex items-center justify-center rounded-full bg-deepGreen px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-deepGreen/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {state === "requesting"
            ? "Ativando..."
            : state === "denied"
            ? "Rever permissAes"
            : "Ativar push"}
        </button>
      </div>
    </div>
  );
}
