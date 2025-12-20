export type TeamMemberRole = "gestor" | "analista" | "criativo" | "suporte" | "outro";
export type TeamMemberAccessRole = "member" | "admin";

export type TeamMemberStatus = "active" | "inactive";

export type TeamMemberCreateInput = {
  name: string;
  email?: string | null;
  role?: TeamMemberRole;
  accessRole?: TeamMemberAccessRole;
  phone?: string | null;
  color?: string | null;
  weeklyCapacityMinutes?: number | null;
  userId?: string | null;
  status?: TeamMemberStatus;
};

export type TeamMemberUpdateInput = Partial<TeamMemberCreateInput>;

export type TeamMemberEntity = {
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
  archivedAt: string | null;
};
