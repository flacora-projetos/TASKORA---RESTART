'use client';

type ClientModuleHighlightsProps = {
  onCreateClient?: () => void;
};

const HIGHLIGHTS = [
  {
    title: "Integracoes Google / Meta / GA4",
    description: "Cadastre os IDs uma unica vez e verifique se cada plataforma esta atualizando corretamente.",
    href: "/clients",
    cta: "Ver integracoes"
  },
  {
    title: "Linha do tempo inteligente",
    description: "Notas internas e reunioes ficam registradas ao lado dos alertas automaticos de cada integracao.",
    href: "/clients",
    cta: "Abrir timeline"
  },
  {
    title: "Relatorios compartilhaveis",
    description: "Exporte CSVs que ja combinam metricas e horas por projeto para enviar a clientes ou lideres.",
    href: "/clients",
    cta: "Exportar CSV"
  }
];

export function ClientModuleHighlights({ onCreateClient }: ClientModuleHighlightsProps): JSX.Element {
  return (
    <section className="rounded-2xl border border-deepGreen/15 bg-gradient-to-br from-white via-offWhite to-terracota/10 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/50">Modulo de clientes</p>
          <h2 className="text-xl font-semibold text-deepGreen">Tudo o que ja esta disponivel</h2>
          <p className="text-sm text-deepGreen/70">
            Estes recursos ja estao ativos nas paginas /clients e /clients/[id] e nao exigem configuracao adicional.
          </p>
        </div>
        {onCreateClient ? (
          <button
            type="button"
            onClick={onCreateClient}
            className="rounded-full bg-terracota px-4 py-2 text-sm font-semibold text-offWhite shadow shadow-terracota/40 transition hover:bg-terracota/90"
          >
            Criar cliente
          </button>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <article
            key={item.title}
            className="rounded-2xl border border-deepGreen/10 bg-white/90 p-4 shadow-inner shadow-black/5"
          >
            <h3 className="text-base font-semibold text-deepGreen">{item.title}</h3>
            <p className="mt-2 text-sm text-deepGreen/70">{item.description}</p>
            <a
              href={item.href}
              className="mt-4 inline-flex items-center text-xs font-semibold text-terracota underline-offset-4 hover:underline"
            >
              {item.cta}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
