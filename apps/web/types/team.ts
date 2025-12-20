export type TeamMemberRole = "gestor" | "analista" | "criativo" | "suporte" | "outro";
export type TeamMemberAccessRole = "member" | "admin";
export type TeamMemberStatus = "active" | "inactive";

export type TeamMember = {
  id: string;
  orgId: string;
  name: string;
  email: string | null;
  role: TeamMemberRole;
  accessRole?: TeamMemberAccessRole;
  phone: string | null;
  color: string | null;
  weeklyCapacityMinutes: number | null;
  userId: string | null;
  status: TeamMemberStatus;
  createdAt: string;
  updatedAt: string;
};

export type TeamOverviewResponse = {
  period: { start: string; end: string; kind: string };
  cards: {
    hoursMinutes: number;
    tasksDone: number;
    onTimePercent: number | null;
    wip: number;
    blocked: number;
    overdue: number;
    missingTime: number;
  };
  charts: {
    hoursByUser: Array<{ id: string; name: string; minutes: number }>;
    hoursByClient: Array<{ id: string; name: string; minutes: number }>;
  };
  lists: {
    lastDeliveries: Array<{
      id: string;
      title: string;
      updatedAt: string;
      dueDate: string | null;
      projectName: string | null;
      clientName: string | null;
      assignees: Array<{ id: string; name: string }>;
    }>;
    risks: Array<{
      id: string;
      title: string;
      status: string;
      dueDate: string | null;
      projectName: string | null;
      clientName: string | null;
      assignees: Array<{ id: string; name: string }>;
    }>;
  };
  members: Array<{
    id: string;
    name: string;
    role: TeamMemberRole;
    email: string | null;
    status: TeamMemberStatus;
    weeklyCapacityMinutes: number | null;
    hoursMinutes: number;
    wip: number;
    blocked: number;
    done: number;
    lastTasks: Array<{ id: string; title: string; status: string; updatedAt: string }>;
    alerts: string[];
  }>;
};
