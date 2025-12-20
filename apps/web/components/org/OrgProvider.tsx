/* eslint-disable react-hooks/exhaustive-deps */
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiFetch, ApiError } from "../../lib/api";
import { getActiveOrgId as getGlobalOrgId, setActiveOrgId as setGlobalOrgId } from "../../lib/org";
import type { Organization } from "../../types/organizations";
import { useAuth } from "../auth/AuthProvider";

type OrgContextValue = {
  organizations: Organization[];
  activeOrgId: string | null;
  setActiveOrgId: (orgId: string | null) => void;
  reloadOrganizations: () => void;
  loading: boolean;
  error: string | null;
};

const OrgContext = createContext<OrgContextValue | undefined>(undefined);

const STORAGE_KEY = "taskora_active_org";

type ListOrganizationsResponse = {
  organizations: Organization[];
  activeOrgId: string | null;
};

const readStoredOrgId = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    const trimmed = stored.trim();
    return trimmed.length > 0 ? trimmed : null;
  } catch {
    return null;
  }
};

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const { token, user, status } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(getGlobalOrgId());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);

  const persistActiveOrg = useCallback((orgId: string | null) => {
    setGlobalOrgId(orgId);
    setActiveOrgIdState(orgId);
    if (typeof window !== "undefined") {
      if (orgId) {
        window.localStorage.setItem(STORAGE_KEY, orgId);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const pickActiveOrg = useCallback(
    (fetched: ListOrganizationsResponse | null): string | null => {
      const stored = readStoredOrgId();
      const orgIds = fetched?.organizations?.map((org) => org.id) ?? [];

      if (orgIds.length > 0) {
        if (stored && orgIds.includes(stored)) {
          return stored;
        }
        if (fetched?.activeOrgId && orgIds.includes(fetched.activeOrgId)) {
          return fetched.activeOrgId;
        }
        if (user?.orgId && orgIds.includes(user.orgId)) {
          return user.orgId;
        }
        return orgIds[0];
      }

      return stored ?? fetched?.activeOrgId ?? user?.orgId ?? null;
    },
    [user?.orgId]
  );

  useEffect(() => {
    if (status !== "authenticated" || !token) {
      setOrganizations([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<ListOrganizationsResponse>("/organizations", { token });
        if (cancelled) {
          return;
        }
        setOrganizations(response.organizations ?? []);
        persistActiveOrg(pickActiveOrg(response));
      } catch (err) {
        if (cancelled) {
          return;
        }
        let message = "Erro ao carregar organizacoes";
        if (err instanceof ApiError) {
          message = `${err.message} (${err.status ?? "status desconhecido"})`;
        } else if (err instanceof Error) {
          message = err.message;
        }
        setError(message);
        setOrganizations([]);
        persistActiveOrg(pickActiveOrg(null));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [status, token, user?.orgId, reloadNonce]);

  const reloadOrganizations = useCallback(() => {
    setReloadNonce((value) => value + 1);
  }, []);

  const handleSetActiveOrg = useCallback(
    (orgId: string | null) => {
      persistActiveOrg(orgId);
    },
    [persistActiveOrg]
  );

  const value = useMemo(
    () => ({
      organizations,
      activeOrgId,
      setActiveOrgId: handleSetActiveOrg,
      reloadOrganizations,
      loading,
      error
    }),
    [organizations, activeOrgId, handleSetActiveOrg, reloadOrganizations, loading, error]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useActiveOrg(): OrgContextValue {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useActiveOrg must be used within an OrgProvider");
  }
  return ctx;
}
