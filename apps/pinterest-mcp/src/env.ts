import fs from "node:fs";

import { z } from "zod";

const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH;
const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;

function applyFirebaseJson(json: {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}): void {
  if (json.project_id && !process.env.FIREBASE_PROJECT_ID) {
    process.env.FIREBASE_PROJECT_ID = json.project_id;
  }
  if (json.client_email && !process.env.FIREBASE_CLIENT_EMAIL) {
    process.env.FIREBASE_CLIENT_EMAIL = json.client_email;
  }
  if (json.private_key && !process.env.FIREBASE_PRIVATE_KEY) {
    process.env.FIREBASE_PRIVATE_KEY = json.private_key;
  }
}

if (credentialsPath) {
  try {
    const raw = fs.readFileSync(credentialsPath, "utf-8");
    applyFirebaseJson(JSON.parse(raw));
  } catch (error) {
    console.warn(`Failed to load Firebase credentials from ${credentialsPath}:`, error);
  }
}

if (credentialsJson) {
  try {
    applyFirebaseJson(JSON.parse(credentialsJson));
  } catch (error) {
    console.warn("Failed to parse FIREBASE_CREDENTIALS_JSON:", error);
  }
}

const nodeEnv =
  (process.env.NODE_ENV as "development" | "test" | "production" | undefined) ?? "development";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default(nodeEnv),
  PORT: z.coerce.number().default(8080),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  MCP_INTERNAL_TOKEN: z.string().default("taskora-pinterest-dev"),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((value) => (value ? value.replace(/\\n/g, "\n") : undefined)),
  FIREBASE_CREDENTIALS_PATH: z.string().optional(),
  FIREBASE_CREDENTIALS_JSON: z.string().optional(),
  PINTEREST_API_BASE_URL: z.string().url().default("https://api.pinterest.com/v5"),
  PINTEREST_DEFAULT_METRICS: z
    .string()
    .default("SPEND,IMPRESSIONS,CLICKS,TOTAL_CONVERSIONS"),
  DEFAULT_ORG_ID: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;
export const env: AppEnv = envSchema.parse(process.env);
