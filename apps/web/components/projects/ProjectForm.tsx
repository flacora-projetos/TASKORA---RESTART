'use client';

import { FormEvent } from "react";

import type { Project, ProjectStatus } from "../../types/projects";

export type ProjectFormState = {
  id?: string;
  name: string;
  clientId: string;
  ownerId: string;
  budget: string;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
  notes: string;
};

export const PROJECT_STATUS_OPTIONS: Array<{ value: ProjectStatus; label: string }> = [
  { value: "draft", label: "Rascunho" },
  { value: "active", label: "Em andamento" },
  { value: "paused", label: "Pausado" },
  { value: "completed", label: "Concluido" }
];

type ClientOption = {
  id: string;
  name: string;
};

type MemberOption = {
  id: string;
  name: string;
  role?: string;
};

export type ProjectFormProps = {
  state: ProjectFormState;
  clients: ClientOption[];
  members: MemberOption[];
  onChange: (field: keyof ProjectFormState, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
  isSaving: boolean;
  error: string | null;
  mode: "create" | "edit";
};

export function createProjectFormState(project?: Project): ProjectFormState {
  return {
    id: project?.id,
    name: project?.name ?? "",
    clientId: project?.clientId ?? "",
    ownerId: project?.ownerId ?? "",
    budget: project?.budget !== null && project?.budget !== undefined ? String(project.budget) : "",
    startDate: project?.startDate?.substring(0, 10) ?? "",
    endDate: project?.endDate?.substring(0, 10) ?? "",
    status: project?.status ?? "draft",
    notes: project?.notes ?? ""
  };
}

export function buildProjectPayload(state: ProjectFormState) {
  return {
    clientId: state.clientId,
    name: state.name.trim(),
    ownerId: state.ownerId.trim() || null,
    budget: state.budget ? Number(state.budget) : null,
    startDate: state.startDate || null,
    endDate: state.endDate || null,
    status: state.status,
    notes: state.notes.trim() || null
  };
}

export function ProjectForm({
  state,
  clients,
  members,
  onChange,
  onSubmit,
  onClose,
  isSaving,
  error,
  mode
}: ProjectFormProps): JSX.Element {
  return (
    <form onSubmit={onSubmit} className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">
            {mode === "create" ? "Novo projeto" : "Editar projeto"}
          </p>
          <h2 className="text-2xl font-semibold text-deepGreen">
            {mode === "create" ? "Cadastrar projeto" : "Atualizar projeto"}
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
          Nome do projeto
          <input
            type="text"
            value={state.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            placeholder="Ex.: Campanha Black Friday"
            required
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Cliente
          <select
            value={state.clientId}
            onChange={(event) => onChange("clientId", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            required
          >
            <option value="">Selecione um cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Responsavel
          <select
            value={state.ownerId}
            onChange={(event) => onChange("ownerId", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
          >
            <option value="">Definir depois</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {member.role ? ` • ${member.role}` : ""}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Budget (R$)
          <input
            type="number"
            min="0"
            step="0.01"
            value={state.budget}
            onChange={(event) => onChange("budget", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
            placeholder="Opcional"
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Início
          <input
            type="date"
            value={state.startDate}
            onChange={(event) => onChange("startDate", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Término
          <input
            type="date"
            value={state.endDate}
            onChange={(event) => onChange("endDate", event.target.value)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
          />
        </label>

        <label className="text-sm font-semibold text-deepGreen">
          Status
          <select
            value={state.status}
            onChange={(event) => onChange("status", event.target.value as ProjectStatus)}
            className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
          >
            {PROJECT_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="text-sm font-semibold text-deepGreen">
        Notas
        <textarea
          value={state.notes}
          onChange={(event) => onChange("notes", event.target.value)}
          className="mt-1 w-full rounded-2xl border border-deepGreen/20 px-3 py-2 text-sm"
          rows={4}
          placeholder="Observações adicionais para o time"
        />
      </label>

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
          {isSaving ? "Salvando..." : mode === "create" ? "Criar projeto" : "Salvar mudanças"}
        </button>
      </div>
    </form>
  );
}
