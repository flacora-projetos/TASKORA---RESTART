'use client';

import type { Client, ClientIntegrationInfo } from "../../types/clients";

type StepStatus = "done" | "todo";

type Step = {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  href: string;
};

const STATUS_LABEL: Record<StepStatus, string> = {
  done: "Pronto",
  todo: "Pendencia"
};

const STATUS_STYLE: Record<StepStatus, string> = {
  done: "bg-emerald-50 text-emerald-800 border-emerald-100",
  todo: "bg-amber-50 text-amber-800 border-amber-100"
};

type Props = {
  client: Client;
};

function formatSyncDate(value?: string): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString("pt-BR");
}

export function ClientAssistBanner({ client }: Props): JSX.Element {
  const integration: ClientIntegrationInfo | null = client.integrations;
  const googleIds = client.googleCustomerIds ?? [];
  const metaIds = client.metaAccountIds ?? [];
  const ga4Ids = client.ga4PropertyIds ?? [];
  const pinterestIds = client.pinterestAccountIds ?? [];

  const hasDirectory = Boolean(integration?.directoryId);
  const hasGoogle = googleIds.length > 0;
  const hasMeta = metaIds.length > 0;
  const hasGa4 = ga4Ids.length > 0;
  const hasPinterest = pinterestIds.length > 0;
  const hasAnyId = hasGoogle || hasMeta || hasGa4 || hasPinterest;

  const steps: Step[] = [
    {
      id: "step-directory",
      title: "1. Conectar cadastro oficial",
      description: hasDirectory
        ? `Registro sincronizado (${formatSyncDate(integration?.syncedAt)})`
        : "Use o campo \"Buscar no cadastro oficial\" e clique em Conectar.",
      status: hasDirectory ? "done" : "todo",
      href: "#cadastro-oficial"
    },
    {
      id: "step-ids",
      title: "2. Preencher os IDs das plataformas",
      description: hasAnyId
        ? "IDs salvos. Confira abaixo quais plataformas estao prontas."
        : "Use os campos do formulario do cliente para registrar os IDs compartilhados pelo cliente ou pelo time de integrações.",
      status: hasAnyId ? "done" : "todo",
      href: "#cadastro-oficial"
    },
    {
      id: "step-metrics",
      title: "3. Ver métricas automaticamente",
      description: hasAnyId
        ? "Abra o card de métricas para trocar o periodo ou exportar."
        : "As métricas so aparecem depois que pelo menos um ID estiver preenchido.",
      status: hasAnyId ? "done" : "todo",
      href: "#metricas"
    }
  ];

  const platformStatus = [
    {
      label: "Google Ads",
      ready: hasGoogle,
      value: googleIds.join(", ") || "Informe o ID no formato 123-456-7890."
    },
    {
      label: "Meta Ads",
      ready: hasMeta,
      value: metaIds.join(", ") || "Use o formato act_1234567890."
    },
    {
      label: "GA4",
      ready: hasGa4,
      value: ga4Ids.join(", ") || "Ex.: properties/123456789."
    },
    {
      label: "Pinterest Ads",
      ready: hasPinterest,
      value: pinterestIds.join(", ") || "Ex.: 549769130861."
    }
  ];

  return (
    <section
      className="rounded-2xl border border-deepGreen/10 bg-gradient-to-br from-offWhite to-white/80 p-6 shadow-sm"
      aria-labelledby="client-assist-title"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Guia rapido</p>
          <h2 id="client-assist-title" className="text-xl font-semibold text-deepGreen">
            Como liberar as métricas para humanos
          </h2>
          <p className="text-sm text-deepGreen/60">
            Passe estes 3 passos para qualquer pessoa do time: conectar, preencher IDs e rodar métricas. Sem jargoes de
            API.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {steps.map((step) => (
          <article
            key={step.id}
            className="rounded-2xl border border-deepGreen/10 bg-white/90 p-4 text-sm text-deepGreen shadow-inner shadow-deepGreen/5"
          >
            <p className={`mb-2 inline-flex rounded-full border px-3 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[step.status]}`}>
              {STATUS_LABEL[step.status]}
            </p>
            <h3 className="text-base font-semibold text-deepGreen">{step.title}</h3>
            <p className="mt-1 text-xs text-deepGreen/70">{step.description}</p>
            <a
              href={step.href}
              className="mt-3 inline-flex text-xs font-semibold text-terracota underline-offset-4 hover:underline"
            >
              Ir para esta etapa
            </a>
          </article>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-deepGreen/20 bg-white/80 p-4">
        <p className="text-sm font-semibold text-deepGreen">Status rapido das plataformas</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {platformStatus.map((platform) => (
            <div
              key={platform.label}
              className="rounded-xl border border-deepGreen/10 bg-offWhite/70 px-3 py-2 text-xs text-deepGreen/80"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-deepGreen">{platform.label}</span>
                <span
                  className={`text-[11px] font-semibold ${
                    platform.ready ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {platform.ready ? "ID cadastrado" : "Pendente"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-deepGreen/60">{platform.value}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
