import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { logger } from "./logger.js";
import { registerToolRoutes } from "./routes/tools.js";

export function buildApp() {
  const app = Fastify({
    logger
  });

  void app.register(helmet, {
    global: true,
    crossOriginEmbedderPolicy: false
  });
  void app.register(cors, {
    origin: false
  });

  app.get("/health", async () => ({
    status: "ok",
    service: "pinterest-mcp",
    timestamp: new Date().toISOString()
  }));

  void app.register(registerToolRoutes);

  return app;
}
