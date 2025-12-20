import { z } from "zod";

import { env } from "../env.js";
import { findClientPinterestIntegration } from "./client-repository.js";
import { fetchPinterestAnalytics } from "./pinterest-api.js";
import type { ToolArgs, ToolResponse } from "../types/mcp.js";
import { resolveDateRange } from "../utils/date-range.js";

const summaryArgsSchema = z.object({
  clientId: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  orgId: z.string().min(1).optional(),
  range: z.string().optional()
});

const DEFAULT_COLUMNS = [
  "PAID_IMPRESSION",
  "TOTAL_CLICKTHROUGH",
  "SPEND_IN_DOLLAR",
  "TOTAL_CHECKOUT"
] as const;

type ColumnKey = (typeof DEFAULT_COLUMNS)[number];

type AggregatedMetrics = {
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
};

function ensureAccountId(accountIds: string[], provided?: string | null): { accountId: string; source: string } {
  if (provided) {
    return { accountId: provided, source: "argument" };
  }
  if (accountIds.length === 0) {
    throw new Error("Cliente não possui IDs de conta Pinterest cadastrados.");
  }
  if (accountIds.length > 1) {
    throw new Error("Informe o accountId desejado ao chamar a ferramenta (cliente possui múltiplas contas).");
  }
  return { accountId: accountIds[0], source: "client" };
}

function buildTotals(rows: Array<Record<string, string | number>>): AggregatedMetrics {
  return rows.reduce(
    (acc, row) => {
      const impressions = Number(row.PAID_IMPRESSION ?? 0);
      const clicks = Number(row.TOTAL_CLICKTHROUGH ?? 0);
      const spend = Number(row.SPEND_IN_DOLLAR ?? 0);
      const conversions = Number(row.TOTAL_CHECKOUT ?? 0);
      return {
        impressions: acc.impressions + (Number.isFinite(impressions) ? impressions : 0),
        clicks: acc.clicks + (Number.isFinite(clicks) ? clicks : 0),
        spend: acc.spend + (Number.isFinite(spend) ? spend : 0),
        conversions: acc.conversions + (Number.isFinite(conversions) ? conversions : 0)
      };
    },
    { impressions: 0, clicks: 0, spend: 0, conversions: 0 }
  );
}

function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

export async function handlePinterestSummary(args: ToolArgs): Promise<ToolResponse> {
  const parsed = summaryArgsSchema.safeParse(args ?? {});
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.errors.map((issue) => issue.message).join(", ")
    };
  }

  const { clientId, accountId, range: rangePreset, orgId } = parsed.data;

  if (!clientId) {
    return {
      status: "error",
      error: "Informe o clientId para consultar as métricas do Pinterest."
    };
  }

  const resolvedRange = (() => {
    try {
      return resolveDateRange(rangePreset);
    } catch (error) {
      return {
        preset: rangePreset ?? "LAST_7_DAYS",
        startDate: null,
        endDate: null,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  })();

  if ("error" in resolvedRange) {
    return {
      status: "error",
      error: resolvedRange.error
    };
  }

  const effectiveOrgId = orgId ?? env.DEFAULT_ORG_ID ?? null;
  if (!clientId) {
    return {
      status: "error",
      error: "Informe um clientId para identificarmos o token do Pinterest."
    };
  }

  let integration: Awaited<ReturnType<typeof findClientPinterestIntegration>>;
  try {
    integration = await findClientPinterestIntegration(clientId, effectiveOrgId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao consultar o cliente.";
    return {
      status: "error",
      error: message
    };
  }

  let selectedAccountId: string;
  try {
    selectedAccountId = ensureAccountId(integration.pinterestAccountIds, accountId).accountId;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao identificar a conta do Pinterest.";
    return {
      status: "error",
      error: message
    };
  }

  let analyticsRows: Array<Record<string, string | number>> = [];
  try {
    analyticsRows = await fetchPinterestAnalytics({
      accessToken: integration.pinterest.accessToken,
      accountId: selectedAccountId,
      startDate: resolvedRange.startDate,
      endDate: resolvedRange.endDate,
      granularity: "DAY",
      columns: [...DEFAULT_COLUMNS]
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível consultar as métricas do Pinterest Ads.";
    return {
      status: "error",
      error: message
    };
  }

  const totals = buildTotals(analyticsRows);
  const ctr = safeRatio(totals.clicks, totals.impressions);
  const cpc = safeRatio(totals.spend, totals.clicks);
  const cpa = safeRatio(totals.spend, totals.conversions);

  return {
    status: "ok",
    data: {
      clientId: integration.clientId,
      clientName: integration.clientName,
      orgId: integration.orgId,
      accountId: selectedAccountId,
      range: resolvedRange,
      tokenExpiresAt: integration.pinterest.expiresAt,
      totals: {
        impressions: totals.impressions,
        clicks: totals.clicks,
        spend: {
          amount: totals.spend,
          currency: "USD"
        },
        conversions: totals.conversions
      },
      averages: {
        ctr,
        cpc,
        cpa
      },
      rows: analyticsRows
    }
  };
}
