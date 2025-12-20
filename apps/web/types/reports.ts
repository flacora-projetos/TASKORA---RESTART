import type { TaskType } from "./tasks";

export type HoursReport = {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  filters: {
    projectId: string | null;
    userId: string | null;
  };
  totals: {
    minutes: number;
    perProject: Array<{ id: string; minutes: number }>;
    perUser: Array<{ id: string; minutes: number }>;
    perDay?: Array<{ date: string; minutes: number }>;
  };
};

export type TaskByClientReportMode = "summary" | "all";

export type TaskByClientReportTask = {
  id: string;
  title: string;
  description: string | null;
  type: TaskType;
  completedAt: string;
  projectId: string;
  projectName: string | null;
  assignees: Array<{ id: string; name: string }>;
};

export type TaskByClientReportClient = {
  clientId: string;
  clientName: string;
  tasks: TaskByClientReportTask[];
};

export type TaskByClientReport = {
  orgId: string;
  orgName: string;
  orgSlug: string | null;
  period: { start: string; end: string };
  mode: TaskByClientReportMode;
  filters: { types: TaskType[] | null };
  generatedAt: string;
  totals: { clients: number; tasks: number };
  clients: TaskByClientReportClient[];
};
