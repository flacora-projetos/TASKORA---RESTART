import type { TaskStatus, TaskType } from "../types/tasks.js";

export const TASK_STATUS_VALUES = ["backlog", "todo", "in_progress", "blocked", "review", "done"] as const;

export const TASK_TYPE_VALUES = [
  "optimization",
  "report",
  "creative",
  "meeting",
  "feedback",
  "campaign",
  "billing",
  "note",
  "other"
] as const;

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  in_progress: "Em andamento",
  blocked: "Bloqueada",
  review: "Em revisao",
  done: "Concluida"
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  optimization: "Otimizacao",
  report: "Relatorio",
  creative: "Criativo",
  meeting: "Reuniao",
  feedback: "Feedback",
  campaign: "Campanha",
  billing: "Boleto",
  note: "Nota",
  other: "Outros"
};

export const SUMMARY_TASK_TYPES: TaskType[] = ["report", "feedback", "billing", "meeting"];

