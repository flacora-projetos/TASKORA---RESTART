import fs from "node:fs";

import { z } from "zod";

const credentialsPath = process.env.FIREBASE_CREDENTIALS_PATH;
const credentialsJson = process.env.FIREBASE_CREDENTIALS_JSON;

function applyFirebaseJson(json: {
  project_id?: string;
  client_email?: string;
  private_key?: string;
}) {
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

const nodeEnv = (process.env.NODE_ENV as "development" | "test" | "production" | undefined) ?? "development";
const defaultAllowInsecure = nodeEnv !== "production" ? "true" : "false";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default(nodeEnv),
  PORT: z.coerce.number().default(8080),
  FIREBASE_PROJECT_ID: z.string().min(1, "FIREBASE_PROJECT_ID is required in production").optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z
    .string()
    .optional()
    .transform((value) => (value ? value.replace(/\\n/g, "\n") : undefined)),
  FIREBASE_CREDENTIALS_PATH: z.string().optional(),
  FIREBASE_CREDENTIALS_JSON: z.string().optional(),
  AUTH_ALLOW_INSECURE: z
    .enum(["true", "false"])
    .default(defaultAllowInsecure)
    .transform((value) => value === "true"),
  EXTERNAL_API_BASE_URL: z.string().url().default("https://api-wviue4ksza-uc.a.run.app/api"),
  EXTERNAL_API_BEARER: z.string().optional(),
  EXTERNAL_MCP_BASE_URL: z.string().url().default("https://saldos-mcp-817801200453.us-central1.run.app"),
  EXTERNAL_MCP_TOKEN: z.string().optional(),
  EXTERNAL_GA4_BASE_URL: z.string().url().default("https://agente-ga4-api-860407662159.us-central1.run.app"),
  EXTERNAL_GA4_TOKEN: z.string().optional(),
  VERTEX_API_BASE_URL: z.string().url().default("https://us-central1-aiplatform.googleapis.com/v1"),
  VERTEX_MODEL: z.string().default("gemini-1.5-flash"),
  VERTEX_API_KEY: z.string().optional(),
  VERTEX_PROJECT_ID: z.string().optional(),
  VERTEX_LOCATION: z.string().default("us-central1"),
  PINTEREST_APP_ID: z.string().default("test-pinterest-app"),
  PINTEREST_APP_SECRET: z.string().default("test-pinterest-secret"),
  PINTEREST_ALLOWED_REDIRECTS: z
    .string()
    .default(
      "http://localhost:3000/integrations/pinterest/callback,https://taskora-dashboard.web.app/integrations/pinterest/callback"
    ),
  PINTEREST_SCOPES: z
    .string()
    .default("ads:read,catalogs:read,user_accounts:read,pins:read,boards:read"),
  PINTEREST_AUTHORIZE_URL: z.string().url().default("https://www.pinterest.com/oauth/"),
  PINTEREST_TOKEN_URL: z.string().url().default("https://api.pinterest.com/v5/oauth/token"),
  NOTIFICATIONS_CRON_SECRET: z.string().optional()
});

export type AppEnv = z.infer<typeof envSchema>;

export const env: AppEnv = envSchema.parse(process.env);
