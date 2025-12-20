export type ExternalDirectoryClient = {
  id: string;
  clientName: string;
  googleCustomerId?: string | null;
  googleCustomerIds?: string[] | null;
  metaAccountId?: string | null;
  metaAccountIds?: string[] | null;
  ga4PropertyIds?: string[] | null;
  activePlatforms?: string[] | null;
  aliases?: string[] | null;
  searchTokens?: string[] | null;
  lastSeenAt?: Record<string, string | null> | null;
  [key: string]: unknown;
};

export type ExternalDirectoryResponse = {
  ok: boolean;
  data: {
    total: number;
    limit: number;
    offset: number;
    items: ExternalDirectoryClient[];
  };
};
