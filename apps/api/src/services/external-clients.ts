import { env } from "../env.js";

const apiBaseUrl = env.EXTERNAL_API_BASE_URL.replace(/\/$/, "");
const mcpBaseUrl = env.EXTERNAL_MCP_BASE_URL.replace(/\/$/, "");
const ga4BaseUrl = env.EXTERNAL_GA4_BASE_URL.replace(/\/$/, "");

type FetchOptions = {
  path: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  authHeaderName?: string;
  authorizationType?: "bearer" | "raw";
};

function buildQueryString(
  params: Record<string, string | number | boolean | undefined> | undefined,
): string {
  if (!params) {
    return "";
  }
  const entries = Object.entries(params).filter(
    ([, value]) => value !== undefined && value !== null && value !== "",
  );
  if (entries.length === 0) {
    return "";
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of entries) {
    searchParams.set(key, String(value));
  }

  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

async function performFetch(
  baseUrl: string,
  token: string | undefined,
  {
    path,
    method = "GET",
    headers = {},
    body,
    query,
    authHeaderName,
    authorizationType = "bearer",
  }: FetchOptions,
) {
  const queryString = buildQueryString(query);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}${queryString}`;
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  if (token) {
    const headerName = authHeaderName ?? "Authorization";
    finalHeaders[headerName] =
      authorizationType === "bearer" ? `Bearer ${token}` : token;
  }

  if (body !== undefined) {
    finalHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`External call failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<unknown>;
}

export function callExternalApi(options: FetchOptions) {
  if (!env.EXTERNAL_API_BEARER) {
    throw new Error("EXTERNAL_API_BEARER not configured");
  }
  return performFetch(apiBaseUrl, env.EXTERNAL_API_BEARER, options);
}

export function callExternalMcp(options: FetchOptions) {
  if (!env.EXTERNAL_MCP_TOKEN) {
    throw new Error("EXTERNAL_MCP_TOKEN not configured");
  }
  return performFetch(mcpBaseUrl, env.EXTERNAL_MCP_TOKEN, options);
}

export function callExternalGa4(options: FetchOptions) {
  if (!env.EXTERNAL_GA4_TOKEN) {
    throw new Error("EXTERNAL_GA4_TOKEN not configured");
  }
  return performFetch(ga4BaseUrl, env.EXTERNAL_GA4_TOKEN, {
    ...options,
    authHeaderName: "x-internal-token",
    authorizationType: "raw",
  });
}
