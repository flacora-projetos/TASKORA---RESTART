export function formatEventType(type: string): string {
  const map: Record<string, string> = {
    task_status_updated: "Status atualizado",
    task_priority_changed: "Prioridade ajustada",
    task_moved: "Tarefa movida",
    task: "Tarefa",
    hour: "Hora registrada",
    report: "Relatorio",
    integration: "Integracao",
    note: "Anotacao",
    alert: "Alerta",
    meeting: "Reuniao"
  };
  return map[type] ?? type;
}

export function formatPlatform(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const map: Record<string, string> = {
    google_ads: "Google Ads",
    meta_ads: "Meta Ads",
    ga4: "GA4",
    pinterest_ads: "Pinterest Ads",
    tiktok_ads: "TikTok Ads",
    google: "Google Ads",
    meta: "Meta Ads"
  };
  return map[code] ?? code;
}

export function formatSource(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const map: Record<string, string> = {
    tasks: "Taskora",
    taskora: "Taskora",
    hours: "Taskora",
    reports: "Taskora"
  };
  return map[raw] ?? raw;
}

export function formatUserName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.includes("@")) {
    return raw;
  }
  const [name] = raw.split("@");
  if (!name) return raw;
  return name
    .split(".")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
