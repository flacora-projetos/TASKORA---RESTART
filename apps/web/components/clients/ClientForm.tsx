'use client';

import { useMemo } from "react";

import type { Client, ClientPayload, ClientPlatform, ClientStatus } from "../../types/clients";
import type { TeamMember } from "../../types/team";

export type ClientFormProps = {
  isEditing: boolean;
  formState: ClientFormState;
  onChange: (field: keyof ClientFormState, value: string | string[] | null) => void;
  onPlatformToggle: (platform: ClientPlatform) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  isSaving: boolean;
  error: string | null;
  teamMembers: TeamMember[];
};

export type ClientFormState = {
  id?: string;
  name: string;
  segment: string;
  monthlyBudget: string;
  platforms: ClientPlatform[];
  driveLink: string;
  whatsappGroup: string;
  status: ClientStatus;
  googleCustomerIds: string;
  metaAccountIds: string;
  ga4PropertyIds: string;
  pinterestAccountIds: string;
  responsibleId: string;
};

const PLATFORM_OPTIONS: { label: string; value: ClientPlatform }[] = [
  { label: "Google", value: "google" },
  { label: "Meta", value: "meta" },
  { label: "Pinterest", value: "pinterest" },
  { label: "TikTok", value: "tiktok" },
  { label: "Outros", value: "other" }
];

export function createFormStateFromClient(client?: Client): ClientFormState {
  return {
    id: client?.id,
    name: client?.name ?? "",
    segment: client?.segment ?? "",
    monthlyBudget: client?.monthlyBudget ? String(client.monthlyBudget) : "",
    platforms: client?.platforms ?? [],
    driveLink: client?.driveLink ?? "",
    whatsappGroup: client?.whatsappGroup ?? "",
    status: client?.status ?? "active",
    googleCustomerIds: client?.googleCustomerIds?.join("\n") ?? "",
    metaAccountIds: client?.metaAccountIds?.join("\n") ?? "",
    ga4PropertyIds: client?.ga4PropertyIds?.join("\n") ?? "",
    pinterestAccountIds: client?.pinterestAccountIds?.join("\n") ?? "",
    responsibleId: client?.responsibleId ?? ""
  };
}

export function ClientForm({
  isEditing,
  formState,
  onChange,
  onPlatformToggle,
  onSubmit,
  onCancelEdit,
  isSaving,
  error,
  teamMembers
}: ClientFormProps): JSX.Element {
  const selectedPlatforms = useMemo(() => new Set(formState.platforms), [formState.platforms]);
  const responsibleOptions = useMemo(() => {
    const known = new Map<string, { id: string; name: string; status: TeamMember["status"] }>();
    teamMembers.forEach((member) => {
      known.set(member.id, { id: member.id, name: member.name, status: member.status });
    });
    if (formState.responsibleId && !known.has(formState.responsibleId)) {
      known.set(formState.responsibleId, {
        id: formState.responsibleId,
        name: "Responsável anterior",
        status: "inactive"
      });
    }
    return Array.from(known.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [teamMembers, formState.responsibleId]);
  const currentResponsible = responsibleOptions.find((option) => option.id === formState.responsibleId);

  return (
    <form
      id="client-form"
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-deepGreen/15 bg-white/90 p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">
            {isEditing ? "Editar cliente" : "Novo cliente"}
          </p>
          <h2 className="text-xl font-semibold text-deepGreen">
            {isEditing ? `Atualizar ${formState.name || "cliente"}` : "Adicionar cliente"}
          </h2>
        </div>
        {isEditing ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-full border border-deepGreen/30 px-3 py-1 text-xs font-semibold text-deepGreen hover:border-deepGreen/60"
          >
            Cancelar edição
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-deepGreen">
          Nome
          <input
            type="text"
            value={formState.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
            required
            placeholder="Ex.: Agência Exemplo"
            disabled={isSaving}
          />
        </label>
        <label className="text-xs font-semibold text-deepGreen">
          Segmento
          <input
            type="text"
            value={formState.segment}
            onChange={(event) => onChange("segment", event.target.value)}
            className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
            placeholder="E-commerce, SaaS, etc."
            disabled={isSaving}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-deepGreen">
          Orçamento mensal (R$)
          <input
            type="number"
            min="0"
            step="100"
            value={formState.monthlyBudget}
            onChange={(event) => onChange("monthlyBudget", event.target.value)}
            className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
            placeholder="12000"
            disabled={isSaving}
          />
        </label>
        <label className="text-xs font-semibold text-deepGreen">
          Status
          <select
            value={formState.status}
            onChange={(event) => onChange("status", event.target.value)}
            className="mt-1 w-full rounded-lg border border-deepGreen/20 bg-white px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
            disabled={isSaving}
          >
            <option value="active">Ativo</option>
            <option value="archived">Arquivado</option>
          </select>
        </label>
      </div>

      <label className="block text-xs font-semibold text-deepGreen">
        Responsável
        <select
          value={formState.responsibleId}
          onChange={(event) => onChange("responsibleId", event.target.value)}
          className="mt-1 w-full rounded-lg border border-deepGreen/20 bg-white px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
          disabled={isSaving}
        >
          <option value="">Sem responsável definido</option>
          {responsibleOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-[11px] text-deepGreen/60">
          {currentResponsible
            ? currentResponsible.status === "inactive"
              ? "Este membro está inativo; escolha outro responsável se necessário."
              : `Coordenado por ${currentResponsible.name}.`
            : "Selecione quem acompanha este cliente no dia a dia."}
        </span>
      </label>

      <label className="text-xs font-semibold text-deepGreen block">
        Plataformas
        <div className="mt-2 flex flex-wrap gap-3">
          {PLATFORM_OPTIONS.map((option) => (
            <label key={option.value} className="inline-flex items-center gap-2 text-sm text-deepGreen/80">
              <input
                type="checkbox"
                checked={selectedPlatforms.has(option.value)}
                onChange={() => onPlatformToggle(option.value)}
                className="rounded border-deepGreen/30 text-terracota focus:ring-terracota"
                disabled={isSaving}
              />
              {option.label}
            </label>
          ))}
        </div>
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-semibold text-deepGreen">
          Link do drive
          <input
            type="url"
            value={formState.driveLink}
            onChange={(event) => onChange("driveLink", event.target.value)}
            className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
            placeholder="https://drive.google.com/..."
            disabled={isSaving}
          />
        </label>
        <label className="text-xs font-semibold text-deepGreen">
          Grupo WhatsApp
          <input
            type="url"
            value={formState.whatsappGroup}
            onChange={(event) => onChange("whatsappGroup", event.target.value)}
            className="mt-1 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
            placeholder="https://chat.whatsapp.com/..."
            disabled={isSaving}
          />
        </label>
      </div>

      <div>
        <p className="text-xs font-semibold text-deepGreen">
          IDs conectados
          <span className="ml-2 text-[11px] font-normal text-deepGreen/60">
            (um ID por linha; usamos esses valores para sincronizar Google, Meta, GA4 e Pinterest)
          </span>
        </p>
        <div className="mt-2 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold text-deepGreen">
            Google Ads
            <textarea
              value={formState.googleCustomerIds}
              onChange={(event) => onChange("googleCustomerIds", event.target.value)}
              className="mt-1 h-24 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
              placeholder="123-456-7890"
              disabled={isSaving}
            />
          </label>
          <label className="text-xs font-semibold text-deepGreen">
            Meta Ads
            <textarea
              value={formState.metaAccountIds}
              onChange={(event) => onChange("metaAccountIds", event.target.value)}
              className="mt-1 h-24 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
              placeholder="act_1234567890"
              disabled={isSaving}
            />
          </label>
          <label className="text-xs font-semibold text-deepGreen">
            GA4
            <textarea
              value={formState.ga4PropertyIds}
              onChange={(event) => onChange("ga4PropertyIds", event.target.value)}
              className="mt-1 h-24 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
              placeholder="properties/123456789"
              disabled={isSaving}
            />
          </label>
          <label className="text-xs font-semibold text-deepGreen">
            Pinterest Ads
            <textarea
              value={formState.pinterestAccountIds}
              onChange={(event) => onChange("pinterestAccountIds", event.target.value)}
              className="mt-1 h-24 w-full rounded-lg border border-deepGreen/20 px-3 py-2 text-sm shadow-inner focus:border-terracota focus:outline-none focus:ring-2 focus:ring-terracota/20"
              placeholder="549769130861"
              disabled={isSaving}
            />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex items-center justify-center rounded-full bg-terracota px-6 py-2 text-sm font-semibold text-offWhite shadow shadow-terracota/40 transition hover:bg-terracota/90 disabled:opacity-60"
      >
        {isEditing ? (isSaving ? "Salvando..." : "Salvar alterações") : isSaving ? "Criando..." : "Criar cliente"}
      </button>
    </form>
  );
}

export function buildClientPayload(formState: ClientFormState): ClientPayload {
  const toArray = (value: string): string[] =>
    value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  const normalizedResponsible = formState.responsibleId?.trim() ?? "";

  return {
    name: formState.name.trim(),
    segment: formState.segment.trim() || undefined,
    monthlyBudget: formState.monthlyBudget ? Number(formState.monthlyBudget) : undefined,
    platforms: formState.platforms,
    driveLink: formState.driveLink.trim() || undefined,
    whatsappGroup: formState.whatsappGroup.trim() || undefined,
    status: formState.status,
    googleCustomerIds: toArray(formState.googleCustomerIds),
    metaAccountIds: toArray(formState.metaAccountIds),
    ga4PropertyIds: toArray(formState.ga4PropertyIds),
    pinterestAccountIds: toArray(formState.pinterestAccountIds),
    responsibleId: normalizedResponsible ? normalizedResponsible : null
  };
}
