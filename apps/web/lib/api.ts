export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

import { getActiveOrgId } from "./org";

const DEFAULT_BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://taskora-api-fq54fov6wq-rj.a.run.app"
    : "http://localhost:8080";

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");

type QueryValue = string | number | boolean | null | undefined;

type ApiFetchOptions = {
  token?: string | null;
  query?: Record<string, QueryValue>;
  method?: RequestInit["method"];
  body?: unknown;
  headers?: HeadersInit;
  init?: RequestInit;
};

function buildQueryString(query?: Record<string, QueryValue>): string {
  if (!query) {
    return "";
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) {
      continue;
    }
    searchParams.append(key, String(value));
  }

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : "";
}

function serializeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) {
    return undefined;
  }

  if (
    typeof body === "string" ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    ArrayBuffer.isView(body) ||
    body instanceof FormData ||
    body instanceof URLSearchParams ||
    body instanceof ReadableStream
  ) {
    return body as BodyInit;
  }

  return JSON.stringify(body);
}

export async function apiFetch<TResponse>(path: string, options: ApiFetchOptions = {}): Promise<TResponse> {
  const { token, query, method, body, headers: headerOverrides, init } = options;
  const basePath = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE_URL}${basePath}${buildQueryString(query)}`;

  const serializedBody = body !== undefined ? serializeBody(body) : init?.body;

  const headers = new Headers();

  const applyHeaders = (input?: HeadersInit) => {
    if (!input) {
      return;
    }
    const normalized = new Headers(input);
    normalized.forEach((value, key) => {
      headers.set(key, value);
    });
  };

  applyHeaders(init?.headers);
  applyHeaders(headerOverrides);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const activeOrgId = getActiveOrgId();
  if (activeOrgId) {
    headers.set("X-Org-Id", activeOrgId);
  }

  const shouldSendJson =
    serializedBody !== undefined &&
    !(serializedBody instanceof FormData) &&
    !(serializedBody instanceof URLSearchParams) &&
    !(serializedBody instanceof Blob) &&
    !(serializedBody instanceof ArrayBuffer) &&
    !ArrayBuffer.isView(serializedBody as ArrayBufferView) &&
    !(serializedBody instanceof ReadableStream);

  if (shouldSendJson && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (!shouldSendJson) {
    headers.delete("Content-Type");
  }

  const response = await fetch(url, {
    ...init,
    method: method ?? init?.method,
    headers,
    body: serializedBody,
    cache: init?.cache ?? "no-store"
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.message === "string") {
        message = body.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, response.status);
  }

  return response.json() as Promise<TResponse>;
}
