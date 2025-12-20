const ADMIN_EMAILS = new Set(["flacora@gmail.com", "contato@nandacora.com.br"]);

export function isAdminUser(user?: { email?: string | null }): boolean {
  if (!user?.email) {
    return false;
  }
  return ADMIN_EMAILS.has(user.email.trim().toLowerCase());
}

export function getAdminAllowlist(): string[] {
  return Array.from(ADMIN_EMAILS);
}
