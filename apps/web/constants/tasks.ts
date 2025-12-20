import type { TaskStatus, TaskType } from "../types/tasks";

export const TASK_STATUS_ORDER: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "blocked",
  "review",
  "done"
];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  blocked: "Bloqueada",
  review: "Em revisao",
  done: "Concluida"
};

export const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  backlog: "bg-slate-100 text-slate-700 border-slate-200",
  todo: "bg-amber-100 text-amber-800 border-amber-200",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  blocked: "bg-red-100 text-red-800 border-red-200",
  review: "bg-purple-100 text-purple-800 border-purple-200",
  done: "bg-emerald-100 text-emerald-800 border-emerald-200"
};

export const TASK_TYPE_OPTIONS: Array<{ value: TaskType; label: string }> = [
  { value: "optimization", label: "Otimizacao" },
  { value: "report", label: "Relatorio" },
  { value: "creative", label: "Criativo" },
  { value: "meeting", label: "Reuniao" },
  { value: "feedback", label: "Feedback" },
  { value: "campaign", label: "Campanha" },
  { value: "billing", label: "Boleto" },
  { value: "note", label: "Nota" },
  { value: "other", label: "Outros" }
];

export const TASK_TYPE_LABELS = TASK_TYPE_OPTIONS.reduce<Record<TaskType, string>>((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {} as Record<TaskType, string>);
