const STORAGE_KEY = "taskora_active_org";

let activeOrgId: string | null = null;

function readStoredOrgId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && stored.trim().length > 0 ? stored : null;
  } catch {
    return null;
  }
}

export function setActiveOrgId(orgId: string | null): void {
  activeOrgId = orgId;
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (orgId) {
      window.localStorage.setItem(STORAGE_KEY, orgId);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getActiveOrgId(): string | null {
  if (!activeOrgId) {
    activeOrgId = readStoredOrgId();
  }
  return activeOrgId;
}
