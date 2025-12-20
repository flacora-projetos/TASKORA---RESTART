"use client";

import { CalendarDays, ClipboardList, FileText, FolderKanban, History, LayoutDashboard, Lightbulb, Users, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { fetchHealth } from "../../lib/health";
import { useAuth } from "../auth/AuthProvider";
import { GeminiIcon } from "../icons/GeminiIcon";
import { useActiveOrg } from "../org/OrgProvider";

const NAV_ITEMS: Array<{
  label: string;
  href: string;
  available: boolean;
  icon: LucideIcon;
}> = [
  { label: "Dashboard", href: "/", available: true, icon: LayoutDashboard },
  { label: "Tarefas", href: "/tasks", available: true, icon: ClipboardList },
  { label: "Projetos", href: "/projects", available: true, icon: FolderKanban },
  { label: "Clientes", href: "/clients", available: true, icon: Users },
  { label: "Equipe", href: "/team", available: true, icon: UserRound },
  { label: "Calendario", href: "/calendar", available: true, icon: CalendarDays },
  { label: "Historico de tarefas", href: "/tasks/history", available: true, icon: History },
  { label: "Relatorios", href: "/reports/deliveries", available: true, icon: FileText },
  { label: "Central de Insights", href: "/insights", available: true, icon: Lightbulb }
];

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onOpenAssistant?: () => void;
};

export function AppSidebar({ isOpen, onClose, onOpenAssistant }: Props): JSX.Element {
  const pathname = usePathname();
  const { status, user, loginWithGoogle, logout } = useAuth();
  const { organizations, activeOrgId, setActiveOrgId, reloadOrganizations, loading: orgLoading, error: orgError } =
    useActiveOrg();
  const isAuthenticated = status === "authenticated" && Boolean(user);
  const userLabel =
    (user?.displayName as string | undefined) ??
    (user?.email as string | undefined) ??
    (user?.claims?.name as string | undefined) ??
    user?.uid ??
    "Sem identificacao";
  const profilePhoto =
    user?.profile && typeof (user.profile as Record<string, unknown>).photoURL === "string"
      ? ((user.profile as Record<string, unknown>).photoURL as string)
      : undefined;
  const avatarUrl = (user?.photoUrl as string | undefined) ?? profilePhoto;
  const avatarInitial =
    (typeof userLabel === "string" && userLabel.length > 0
      ? userLabel[0]
      : user?.email?.[0] ?? user?.uid?.[0] ?? "?")?.toUpperCase?.() ?? "?";
  const [healthState, setHealthState] = useState<{
    status: "ok" | "warning" | "error" | "unknown";
    timestamp: string | null;
  }>({ status: "unknown", timestamp: null });

  useEffect(() => {
    let active = true;
    fetchHealth()
      .then((payload) => {
        if (!active) {
          return;
        }
        if (!payload) {
          setHealthState({ status: "error", timestamp: null });
          return;
        }
        const normalized =
          payload.status === "warning" || payload.status === "error" ? payload.status : "ok";
        setHealthState({ status: normalized, timestamp: payload.timestamp ?? null });
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setHealthState({ status: "error", timestamp: null });
      });

    return () => {
      active = false;
    };
  }, []);

  const healthLabel: Record<typeof healthState.status, string> = {
    ok: "Operante",
    warning: "Atenção",
    error: "Instável",
    unknown: "Verificando"
  };

  const healthTone: Record<typeof healthState.status, string> = {
    ok: "text-emerald-300",
    warning: "text-amber-300",
    error: "text-rose-300",
    unknown: "text-offWhite/60"
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-gradient-to-b from-green-900 to-green-950/80 text-white shadow-[inset_-4px_0px_8px_rgba(0,0,0,0.3)] transition-transform duration-300 md:static md:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/50">Operação</p>
          <p className="text-lg font-semibold text-white">Taskora</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-white/30 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 md:hidden"
        >
          Fechar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
        <div className="border-b border-white/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">Módulos</p>
          <nav className="mt-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = item.available && pathname?.startsWith(item.href);
              const baseClasses =
                "inline-flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition";
              const stateClasses = item.available
                ? active
                  ? "bg-white text-green-900 shadow-sm"
                  : "text-white/80 hover:bg-white/15"
                : "cursor-not-allowed text-white/40";

              const iconClasses = active ? "text-green-900" : item.available ? "text-white/60" : "text-white/30";

              if (!item.available) {
                return (
                  <div key={item.label} className={`${baseClasses} ${stateClasses}`}>
                    <Icon className={`size-4 ${iconClasses}`} aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-[11px] uppercase tracking-wide text-white/40">Em breve</span>
                  </div>
                );
              }

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`${baseClasses} ${stateClasses}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className={`size-4 ${iconClasses}`} aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="border-b border-white/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">Assistente</p>
          <button
            type="button"
            onClick={onOpenAssistant}
            className="mt-3 flex w-full items-center gap-3 rounded-xl border border-white/20 bg-white/5 px-3 py-3 text-left text-white transition hover:bg-white/15"
          >
            <GeminiIcon className="size-9" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">Gemini no Taskora</p>
              <p className="text-xs text-white/70">Abra o chat lateral para pedir análises operacionais.</p>
            </div>
          </button>
        </div>

        <div className="border-b border-white/10 pb-4">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40">Conta</p>
          <div className="mt-3 rounded-lg bg-white/10 p-3 text-sm">
            {isAuthenticated ? (
              <>
                <div className="flex items-center gap-3">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt="Foto do usuario"
                      className="size-10 rounded-full border border-white/30 object-cover"
                    />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-sm font-semibold text-white">
                      {avatarInitial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{userLabel}</p>
                    <p className="text-xs text-white/70">Conectado</p>
                  </div>
                </div>
                {organizations.length > 1 ? (
                  <div className="mt-3 space-y-2 rounded-md bg-white/5 p-2">
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Organizacao ativa</p>
                    <select
                      value={activeOrgId ?? ""}
                      onChange={(event) => {
                        const nextOrgId = event.target.value || null;
                        if (nextOrgId === activeOrgId) {
                          return;
                        }
                        setActiveOrgId(nextOrgId);
                        if (typeof window !== "undefined") {
                          window.location.assign("/clients");
                        }
                      }}
                      className="w-full rounded-md border border-white/20 bg-green-900/60 px-2 py-1 text-sm text-white shadow-sm outline-none"
                    >
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : organizations.length === 1 && activeOrgId ? (
                  <div className="mt-3 rounded-md bg-white/5 p-2 text-xs text-white/80">
                    <p className="text-[11px] uppercase tracking-wide text-white/60">Organizacao</p>
                    <p className="text-sm text-white">
                      {organizations.find((org) => org.id === activeOrgId)?.name ?? activeOrgId}
                    </p>
                  </div>
                ) : null}
                {orgLoading ? (
                  <p className="mt-3 text-xs text-white/60">Carregando organizacoes...</p>
                ) : null}
                {orgError ? (
                  <div className="mt-3 rounded-md border border-rose-200/40 bg-rose-500/10 p-2 text-xs text-rose-100">
                    <p>{orgError}</p>
                    <button
                      type="button"
                      onClick={() => reloadOrganizations()}
                      className="mt-2 inline-flex items-center rounded-full border border-rose-200/50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-100 hover:bg-rose-100/10"
                    >
                      Recarregar orgs
                    </button>
                  </div>
                ) : organizations.length === 0 ? (
                  <div className="mt-3 rounded-md border border-white/20 bg-white/5 p-2 text-xs text-white/80">
                    <p>Nenhuma organizacao carregada.</p>
                    <button
                      type="button"
                      onClick={() => reloadOrganizations()}
                      className="mt-2 inline-flex items-center rounded-full border border-white/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/80 hover:bg-white/10"
                    >
                      Recarregar orgs
                    </button>
                  </div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="mt-3 inline-flex items-center rounded-full border border-white/40 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white hover:bg-white/10"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <p className="text-sm text-white/80">Entre para liberar os módulos.</p>
                <button
                  type="button"
                  onClick={() => void loginWithGoogle()}
                  className="mt-3 inline-flex items-center rounded-full border border-white/40 px-3 py-1 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Entrar com Google
                </button>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg bg-white/10 p-3 text-sm text-white/80">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-white/50">Status dos serviços</p>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[11px] font-semibold ${healthTone[healthState.status]}`}
            >
              <span className="size-2 rounded-full bg-current" />
              {healthLabel[healthState.status]}
            </span>
          </div>
          <p className="mt-2 text-white">Cloud Run / Firestore</p>
          <p className="text-[11px] text-white/60">
            {healthState.timestamp
              ? `Atualizado ${new Date(healthState.timestamp).toLocaleString("pt-BR")}`
              : "Sincronizando status..."}
          </p>
        </div>
      </div>

      <div className="border-t border-white/10 px-5 py-3">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.4em] text-white/30">
          Powered by Taskora
        </p>
      </div>
    </aside>
  );
}
