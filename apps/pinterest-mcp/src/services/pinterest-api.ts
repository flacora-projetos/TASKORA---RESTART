import { env } from "../env.js";

type AnalyticsParams = {
  accessToken: string;
  accountId: string;
  startDate: string;
  endDate: string;
  columns: string[];
  granularity?: "DAY" | "WEEK" | "MONTH";
};

export type PinterestAnalyticsRow = Record<string, string | number>;

export async function fetchPinterestAnalytics({
  accessToken,
  accountId,
  startDate,
  endDate,
  columns,
  granularity = "DAY"
}: AnalyticsParams): Promise<PinterestAnalyticsRow[]> {
  if (!columns.length) {
    return [];
  }

  const url = new URL(`/ad_accounts/${accountId}/analytics`, env.PINTEREST_API_BASE_URL);
  url.searchParams.set("start_date", startDate);
  url.searchParams.set("end_date", endDate);
  url.searchParams.set("granularity", granularity);
  for (const column of columns) {
    url.searchParams.append("columns", column);
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    let errorBody: unknown = null;
    try {
      errorBody = await response.json();
    } catch {
      // ignore
    }
    const error = new Error(
      `Pinterest analytics request failed with status ${response.status}${
        errorBody ? `: ${JSON.stringify(errorBody)}` : ""
      }`
    );
    throw error;
  }

  const data = (await response.json()) as PinterestAnalyticsRow[];
  if (!Array.isArray(data)) {
    return [];
  }
  return data;
}
