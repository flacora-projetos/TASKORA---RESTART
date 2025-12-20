import { API_BASE_URL } from "./api";

export type HealthPayload = {
  status: string;
  service: string;
  timestamp: string;
};

export async function fetchHealth(): Promise<HealthPayload | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
    if (!res.ok) {
      return null;
    }
    return (await res.json()) as HealthPayload;
  } catch (error) {
    console.error("Failed to reach API health endpoint", error);
    return null;
  }
}
