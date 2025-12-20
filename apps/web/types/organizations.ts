export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
  ownerUid?: string | null;
};

export type OrganizationMember = {
  id: string;
  orgId: string;
  userId: string;
  roles: string[];
  createdAt: string;
};
