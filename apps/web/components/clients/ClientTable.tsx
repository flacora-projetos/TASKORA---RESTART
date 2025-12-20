'use client';

import type { Client, ClientPlatform } from "../../types/clients";
import type { TeamMember } from "../../types/team";

type ClientTableProps = {
  clients: Client[];
  loading: boolean;
  onEdit: (client: Client) => void;
  onArchive: (client: Client) => void;
  responsibleLookup: Map<string, TeamMember>;
};

const FEATURE_CHIPS = ["Linha do tempo", "Integrações", "Métricas", "Relatórios"];

const PLATFORM_LABELS: Record<ClientPlatform, string> = {
  google: "Google Ads",
  meta: "Meta Ads",
  pinterest: "Pinterest",
  tiktok: "TikTok",
  other: "Outras"
};

const STATUS_STYLES: Record<Client["status"], string> = {
  active: "bg-emerald-50 text-emerald-700",
  archived: "bg-slate-100 text-slate-600"
};

export function ClientTable({
  clients,
  loading,
  onEdit,
  onArchive,
  responsibleLookup
}: ClientTableProps): JSX.Element {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Clientes</p>
          <h2 className="text-lg font-semibold text-gray-900">Listagem completa</h2>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-600">Carregando clientes...</p>
      ) : clients.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">Nenhum cliente encontrado para os filtros selecionados.</p>
      ) : (
        <div className="mt-6 space-y-4">
          {clients.map((client) => {
            const formattedBudget = client.monthlyBudget
              ? `R$ ${client.monthlyBudget.toLocaleString("pt-BR")}`
              : "Sem registro";
            const platforms = Array.isArray(client.platforms) ? client.platforms : [];

            return (
              <article
                key={client.id}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-gray-300 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1">
                    <a
                      href={`/clients/${client.id}`}
                      className="text-lg font-semibold text-gray-900 hover:underline"
                    >
                      {client.name}
                    </a>
                    <p className="text-sm text-gray-500">{client.segment ?? "Segmento não informado"}</p>
                    <p className="text-xs text-gray-400">
                      Atualizado em {new Date(client.updatedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[client.status]}`}>
                    {client.status === "active" ? "Ativo" : "Arquivado"}
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Investimento mensal</p>
                    <p className="text-sm font-medium text-gray-900">{formattedBudget}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Responsável</p>
                    <ResponsibleBadge client={client} responsibleLookup={responsibleLookup} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Plataformas</p>
                    {platforms.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {platforms.map((platform) => (
                          <span
                            key={`${client.id}-${platform}`}
                            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600"
                          >
                            {PLATFORM_LABELS[platform] ?? platform}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Sem plataformas cadastradas</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500">Integrações</p>
                    <IntegrationBadges client={client} />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {FEATURE_CHIPS.map((feature) => (
                      <span
                        key={`${client.id}-${feature}`}
                        className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/clients/${client.id}`}
                      className="inline-flex items-center rounded-full bg-deepGreen px-4 py-2 text-xs font-semibold text-white transition hover:bg-deepGreen/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deepGreen/30"
                    >
                      Visão 360
                    </a>
                    <button
                      type="button"
                      onClick={() => onEdit(client)}
                      className="inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:border-gray-400 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-200"
                    >
                      Editar
                    </button>
                    {client.status !== "archived" ? (
                      <button
                        type="button"
                        onClick={() => onArchive(client)}
                        className="inline-flex items-center rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-100"
                      >
                        Arquivar
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function IntegrationBadges({ client }: { client: Client }) {
  const info = client.integrations;
  const googleIds = client.googleCustomerIds ?? [];
  const metaIds = client.metaAccountIds ?? [];
  const ga4Ids = client.ga4PropertyIds ?? [];
  const pinterestIds = client.pinterestAccountIds ?? [];

  const items = [
    {
      label: "Diretório",
      connected: Boolean(info?.directoryId),
      value: info?.directoryId ?? ""
    },
    {
      label: "Google Ads",
      connected: googleIds.length > 0,
      value: googleIds.join(", ")
    },
    {
      label: "Meta Ads",
      connected: metaIds.length > 0,
      value: metaIds.join(", ")
    },
    {
      label: "GA4",
      connected: ga4Ids.length > 0,
      value: ga4Ids.join(", ")
    },
    {
      label: "Pinterest",
      connected: pinterestIds.length > 0,
      value: pinterestIds.join(", ")
    }
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            item.connected
              ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border border-gray-200 bg-gray-50 text-gray-500"
          }`}
          title={item.value || `${item.label} não configurado`}
        >
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ResponsibleBadge({
  client,
  responsibleLookup
}: {
  client: Client;
  responsibleLookup: Map<string, TeamMember>;
}) {
  if (!client.responsibleId) {
    return <p className="text-sm text-gray-500">Sem responsável</p>;
  }

  const member = responsibleLookup.get(client.responsibleId);
  if (!member) {
    return <p className="text-sm text-amber-600">Responsável não encontrado</p>;
  }

  return (
    <div>
      <p className="text-sm font-medium text-gray-900">{member.name}</p>
      {member.status === "inactive" ? (
        <p className="text-xs text-amber-600">Integrante inativo</p>
      ) : (
        <p className="text-xs text-gray-500">{member.role}</p>
      )}
    </div>
  );
}

