'use client';

import {
  GoogleAuthProvider,
  onIdTokenChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth as FirebaseAuth
} from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import { getFirebaseAuthClient, firebaseAuthEnabled } from "../../lib/firebase";

export type AuthUser = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoUrl?: string | null;
  orgId?: string | null;
  roles: string[];
  claims: Record<string, unknown>;
  profile?: Record<string, unknown> | null;
  isAdmin?: boolean;
};

type AuthStatus = "idle" | "loading" | "authenticated" | "error";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  status: AuthStatus;
  error: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithToken: (token: string) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  supportsManualToken: boolean;
  usesFirebaseAuth: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "taskora_auth_token";
const TOKEN_REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes
const FOCUS_REFRESH_MIN_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const allowManualTokens =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ALLOW_DEV_TOKEN !== "false";
const ADMIN_EMAILS = new Set(["flacora@gmail.com", "contato@nandacora.com.br"]);

function computeIsAdmin(user: AuthUser | null): boolean {
  if (!user?.email) return false;
  return Boolean(user.isAdmin) || ADMIN_EMAILS.has(user.email.trim().toLowerCase());
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [firebaseAuth, setFirebaseAuth] = useState<FirebaseAuth | null>(null);
  const lastTokenRefreshRef = useRef<number>(0);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (firebaseAuthEnabled) {
      setFirebaseAuth(getFirebaseAuthClient());
    }
  }, []);

  const loadUser = useCallback(
    async (currentToken: string | null) => {
      if (!currentToken) {
        setUser(null);
        setStatus("idle");
        setError(null);
        return;
      }

      setStatus("loading");
      setError(null);

    try {
      const response = await apiFetch<AuthUser>("/auth/me", { token: currentToken });
      const enriched: AuthUser = { ...response, isAdmin: computeIsAdmin(response) };
      setUser(enriched);
      setStatus("authenticated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao verificar token";
      setError(message);
      setStatus("error");
        setUser(null);

        if (err instanceof ApiError && err.status === 401) {
          setToken(null);
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
    },
    []
  );

  useEffect(() => {
    if (firebaseAuth) {
      setStatus("loading");
      const unsubscribe = onIdTokenChanged(firebaseAuth, async (currentUser) => {
        if (!currentUser) {
          setToken(null);
          setUser(null);
          setStatus("idle");
          setError(null);
          if (typeof window !== "undefined") {
            window.localStorage.removeItem(STORAGE_KEY);
          }
          return;
        }

        const idToken = await currentUser.getIdToken();
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, idToken);
        }
        setToken(idToken);
      });
      return () => unsubscribe();
    }

    if (allowManualTokens && typeof window !== "undefined") {
      const storedToken = window.localStorage.getItem(STORAGE_KEY);
      if (storedToken) {
        setToken(storedToken);
      }
    }
  }, [firebaseAuth]);

  useEffect(() => {
    if (token) {
      void loadUser(token);
    }
    tokenRef.current = token;
  }, [token, loadUser]);

  // Força refresh periódico do token para evitar expiração silenciosa
  useEffect(() => {
    if (!firebaseAuth) {
      return;
    }

    const refreshToken = async () => {
      const currentUser = firebaseAuth.currentUser;
      if (!currentUser) {
        return;
      }
      const refreshed = await currentUser.getIdToken().catch(() => null);
      if (!refreshed) {
        return;
      }
      if (refreshed !== tokenRef.current) {
        setToken(refreshed);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, refreshed);
        }
        tokenRef.current = refreshed;
      }
      lastTokenRefreshRef.current = Date.now();
    };

    const interval = setInterval(refreshToken, TOKEN_REFRESH_INTERVAL_MS);

    const handleFocus = () => {
      const now = Date.now();
      if (now - lastTokenRefreshRef.current < FOCUS_REFRESH_MIN_INTERVAL_MS) {
        return;
      }
      void refreshToken();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [firebaseAuth]);

  const loginWithGoogle = useCallback(async () => {
    if (!firebaseAuth) {
      setError("Login com Google nao esta configurado neste ambiente.");
      return;
    }

    setError(null);
    setStatus("loading");

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });

    const shouldUseRedirect = () => {
      if (typeof window === "undefined") {
        return false;
      }
      const ua = window.navigator.userAgent ?? "";
      return /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
    };

    const fallbackToRedirect = async () => {
      await signInWithRedirect(firebaseAuth, provider);
    };

    try {
      if (shouldUseRedirect()) {
        await fallbackToRedirect();
        return;
      }
      await signInWithPopup(firebaseAuth, provider);
    } catch (err) {
      try {
        await fallbackToRedirect();
      } catch (redirectError) {
        const message =
          (redirectError instanceof Error && redirectError.message) ||
          (err instanceof Error && err.message) ||
          "Erro ao autenticar com o Google";
        setError(message);
        setStatus("error");
      }
    }
  }, [firebaseAuth]);

  const loginWithToken = useCallback(
    (newToken: string) => {
      if (!allowManualTokens || firebaseAuth) {
        setError("Autenticacao manual desabilitada. Use o botao de login com Google.");
        return;
      }

      const trimmed = newToken.trim();
      if (!trimmed) {
        setError("Informe um token valido.");
        return;
      }

      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, trimmed);
      }

      setToken(trimmed);
    },
    [firebaseAuth]
  );

  const logout = useCallback(async () => {
    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }

    setToken(null);
    setUser(null);
    setStatus("idle");
    setError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem("taskora_active_org");
    }
  }, [firebaseAuth]);

  const refresh = useCallback(async () => {
    await loadUser(token);
  }, [loadUser, token]);

  const supportsManualToken = allowManualTokens && !firebaseAuth;

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      status,
      error,
      loginWithGoogle,
      loginWithToken,
      logout,
      refresh,
      supportsManualToken,
      usesFirebaseAuth: Boolean(firebaseAuth)
    }),
    [
      token,
      user,
      status,
      error,
      loginWithGoogle,
      loginWithToken,
      logout,
      refresh,
      supportsManualToken,
      firebaseAuth
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
