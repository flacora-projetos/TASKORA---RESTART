'use client';

const SHORTCUTS = [
  {
    title: "Sincronizar diretório",
    description: "Atualiza a coleção directory_clients com os dados oficiais.",
    command: "pnpm --filter @taskora/api directory:cache:sync"
  },
  {
    title: "Sincronizar métricas",
    description: "Popular o cache offline de Google, Meta e GA4.",
    command: "pnpm --filter @taskora/api metrics:sync"
  },
  {
    title: "Executar job no Cloud Run",
    description: "Útil para disparos pontuais via Scheduler.",
    command: "gcloud run jobs execute metrics-sync --region=southamerica-east1 --wait"
  }
];

type Props = {
  variant?: "default" | "compact";
};

export function ConfigurationShortcutsCard({ variant = "default" }: Props): JSX.Element {
  const isCompact = variant === "compact";
  const containerClass = isCompact
    ? "rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-4 space-y-3"
    : "card space-y-4 p-6";
  const titleClass = isCompact ? "text-base font-semibold text-deepGreen" : "text-xl font-semibold text-deepGreen";
  const descriptionClass = isCompact ? "text-xs text-deepGreen/60" : "text-sm text-deepGreen/60";

  return (
    <div className={containerClass}>
      <p className="text-xs uppercase tracking-[0.3em] text-deepGreen/60">Configurações</p>
      <h2 className={titleClass}>Ações rápidas</h2>
      <p className={descriptionClass}>
        Use estes atalhos quando precisar atualizar o diretório ou as métricas sem esperar os horários automáticos.
      </p>
      <ul className="space-y-2">
        {SHORTCUTS.map((item) => (
          <li key={item.title} className="rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-3">
            <p className="text-sm font-semibold text-deepGreen">{item.title}</p>
            <p className="text-xs text-deepGreen/60">{item.description}</p>
            <code className="mt-2 block rounded-lg bg-deepGreen/5 px-3 py-1.5 text-xs font-semibold text-deepGreen/80">
              {item.command}
            </code>
          </li>
        ))}
      </ul>
    </div>
  );
}
