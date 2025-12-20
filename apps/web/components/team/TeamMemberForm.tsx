'use client';

import { FormEvent } from "react";

import type {
  TeamMember,
  TeamMemberRole,
  TeamMemberStatus,
  TeamMemberAccessRole
} from "../../types/team";

export type TeamMemberFormState = {
  id?: string;
  name: string;
  email: string;
  role: TeamMemberRole;
  accessRole: TeamMemberAccessRole;
  phone: string;
  color: string;
  weeklyCapacityHours: string;
  status: TeamMemberStatus;
};

const ROLE_OPTIONS: Array<{ value: TeamMemberRole; label: string }> = [
  { value: "gestor", label: "Gestor(a)" },
  { value: "analista", label: "Analista" },
  { value: "criativo", label: "Criativo(a)" },
  { value: "suporte", label: "Suporte" },
  { value: "outro", label: "Outro" }
];

const ACCESS_ROLE_OPTIONS: Array<{ value: TeamMemberAccessRole; label: string }> = [
  { value: "member", label: "Membro" },
  { value: "admin", label: "Admin (acesso avançado)" }
];

const STATUS_OPTIONS: Array<{ value: TeamMemberStatus; label: string }> = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" }
];

export type TeamMemberFormProps = {
  state: TeamMemberFormState;
  onChange: (field: keyof TeamMemberFormState, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  isSaving: boolean;
  error: string | null;
  mode: "create" | "edit";
  canSetAdminRole: boolean;
};

export function createTeamMemberFormState(member?: TeamMember): TeamMemberFormState {
  return {
    id: member?.id,
    name: member?.name ?? "",
    email: member?.email ?? "",
    role: member?.role ?? "analista",
    accessRole: member?.accessRole ?? "member",
    phone: member?.phone ?? "",
    color: member?.color ?? "",
    weeklyCapacityHours: member?.weeklyCapacityMinutes
      ? String(Math.round(member.weeklyCapacityMinutes / 60))
      : "",
    status: member?.status ?? "active"
  };
}

export function buildTeamMemberPayload(state: TeamMemberFormState) {
  const hours = state.weeklyCapacityHours.trim() ? Number(state.weeklyCapacityHours) : null;
  return {
    name: state.name.trim(),
    email: state.email.trim() ? state.email.trim() : null,
    role: state.role,
    accessRole: state.accessRole,
    phone: state.phone.trim() ? state.phone.trim() : null,
    color: state.color.trim() ? state.color.trim() : null,
    weeklyCapacityMinutes: hours !== null && !Number.isNaN(hours) ? hours * 60 : null,
    status: state.status
  };
}

export function TeamMemberForm({
  state,
  onChange,
  onSubmit,
  onClose,
  isSaving,
  error,
  mode,
  canSetAdminRole
}: TeamMemberFormProps): JSX.Element {
  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">
            {mode === "create" ? "Novo membro" : "Editar membro"}
          </p>
          <h2 className="text-2xl font-semibold text-deepGreen">
            {mode === "create" ? "Adicionar ao time" : "Atualizar integrante"}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-deepGreen/20 px-4 py-1 text-xs font-semibold text-deepGreen hover:border-deepGreen/50"
        >
          Fechar
        </button>
      </div>

      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-semibold text-deepGreen">
          Nome
          <input
            type="text"
            value={state.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            placeholder="Ex.: Ana Prado"
            required
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Função
          <select
            value={state.role}
            onChange={(event) => onChange("role", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
          >
            {ROLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {canSetAdminRole ? (
          <label className="text-sm font-semibold text-deepGreen">
            Papel de acesso
            <select
              value={state.accessRole}
              onChange={(event) => onChange("accessRole", event.target.value)}
              className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            >
              {ACCESS_ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-deepGreen/70">
              Admin liberado apenas para emails autorizados (allowlist interna).
            </span>
          </label>
        ) : (
          <input type="hidden" value={state.accessRole} name="accessRole" />
        )}

        <label className="text-sm font-semibold text-deepGreen">
          Email
          <input
            type="email"
            value={state.email}
            onChange={(event) => onChange("email", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            placeholder="nome@empresa.com"
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Telefone
          <input
            type="tel"
            value={state.phone}
            onChange={(event) => onChange("phone", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            placeholder="Opcional"
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Cor do crachá (hex)
          <input
            type="text"
            value={state.color}
            onChange={(event) => onChange("color", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            placeholder="#006644"
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Capacidade semanal (horas)
          <input
            type="number"
            min="0"
            step="1"
            value={state.weeklyCapacityHours}
            onChange={(event) => onChange("weeklyCapacityHours", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            placeholder="Ex.: 40"
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Status
          <select
            value={state.status}
            onChange={(event) => onChange("status", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-deepGreen/20 px-5 py-2 text-sm font-semibold text-deepGreen hover:border-deepGreen/40"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="rounded-full bg-deepGreen px-6 py-2 text-sm font-semibold text-white shadow-lg shadow-deepGreen/30 transition hover:bg-deepGreen/90 disabled:opacity-60"
        >
          {isSaving ? "Salvando..." : mode === "create" ? "Adicionar" : "Salvar mudancas"}
        </button>
      </div>
    </form>
  );
}
