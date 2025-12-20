type StatusCardProps = {
  title: string;
  description: string;
  status: "ok" | "warning" | "error";
  timestamp?: string | null;
  variant?: "default" | "compact";
};

const statusStyles: Record<StatusCardProps["status"], string> = {
  ok: "bg-green-100 text-green-800 border-green-300",
  warning: "bg-amber-100 text-amber-800 border-amber-300",
  error: "bg-red-100 text-red-800 border-red-300"
};

const statusLabel: Record<StatusCardProps["status"], string> = {
  ok: "Operante",
  warning: "Atenção",
  error: "Indisponível"
};

export function StatusCard({ title, description, status, timestamp, variant = "default" }: StatusCardProps) {
  const isCompact = variant === "compact";
  const containerClass = isCompact
    ? "rounded-2xl border border-deepGreen/10 bg-offWhite/80 p-4 space-y-3"
    : "card p-6";
  const titleClass = isCompact ? "text-base font-semibold text-deepGreen" : "text-lg font-semibold text-deepGreen";
  const descriptionClass = isCompact ? "text-xs text-deepGreen/60" : "text-sm text-deepGreen/70";
  const badgeClass = isCompact
    ? "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition"
    : "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition";
  const timestampClass = isCompact ? "text-[11px] text-deepGreen/50" : "text-xs text-deepGreen/60";

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className={titleClass}>{title}</h2>
          <p className={descriptionClass}>{description}</p>
        </div>
        <span className={`${badgeClass} ${statusStyles[status]}`}>
          <span className="size-2 rounded-full bg-current" />
          {statusLabel[status]}
        </span>
      </div>
      {timestamp ? (
        <p className={`mt-4 ${timestampClass}`}>Última verificação: {new Date(timestamp).toLocaleString("pt-BR")}</p>
      ) : null}
    </div>
  );
}
