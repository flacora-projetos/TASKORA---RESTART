import { buildApp } from "./app.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

async function start() {
  const app = buildApp();
  try {
    await app.listen({
      port: env.PORT,
      host: "0.0.0.0"
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to start Pinterest MCP");
    process.exit(1);
  }
}

void start();
