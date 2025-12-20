export type OrganizationEntity = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  ownerUid?: string | null;
};

export type OrganizationMemberRole = "admin" | "member";

export type OrganizationMemberEntity = {
  id: string;
  orgId: string;
  userId: string;
  roles: OrganizationMemberRole[];
  createdAt: string;
};
