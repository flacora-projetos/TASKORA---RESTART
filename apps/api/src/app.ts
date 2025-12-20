import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import Fastify, { FastifyInstance } from "fastify";

import authPlugin from "./plugins/auth.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerClientIntegrationRoutes } from "./routes/client-integrations.js";
import { registerClientRoutes } from "./routes/clients.js";
import { registerClientMetricsRoutes } from "./routes/client-metrics.js";
import { registerClientTimelineRoutes } from "./routes/client-timeline.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerDirectoryIntegrationRoutes } from "./routes/integrations-directory.js";
import { registerProjectRoutes } from "./routes/projects.js";
import { registerTaskRoutes } from "./routes/tasks.js";
import { registerIntegrationStatusRoutes } from "./routes/integration-status.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { registerTimeEntryRoutes } from "./routes/time-entries.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerMaintenanceRoutes } from "./routes/maintenance.js";
import { registerTeamMemberRoutes } from "./routes/team-members.js";
import { registerTeamOverviewRoutes } from "./routes/team-overview.js";
import { registerAgentRoutes } from "./routes/agent.js";
import { registerInsightsRoutes } from "./routes/insights.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerOrganizationRoutes } from "./routes/organizations.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : {
              target: "pino-pretty",
              options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname"
              }
            }
    }
  });

  app.register(helmet, { global: true });
  app.register(cors, { origin: true, credentials: true });
  app.register(sensible);
  app.register(authPlugin);

  app.register(registerAuthRoutes, { prefix: "/auth" });
  app.register(registerHealthRoutes, { prefix: "/health" });
  app.register(registerClientRoutes, { prefix: "/clients" });
  app.register(registerClientTimelineRoutes, { prefix: "/clients" });
  app.register(registerClientMetricsRoutes, { prefix: "/clients" });
  app.register(registerClientIntegrationRoutes, { prefix: "/clients" });
  app.register(registerProjectRoutes);
  app.register(registerTaskRoutes);
  app.register(registerMetricsRoutes);
  app.register(registerIntegrationStatusRoutes);
  app.register(registerTimeEntryRoutes);
  app.register(registerReportRoutes, { prefix: "" });
  app.register(registerDirectoryIntegrationRoutes, { prefix: "/integrations" });
  app.register(registerMaintenanceRoutes);
  app.register(registerTeamMemberRoutes);
  app.register(registerTeamOverviewRoutes);
  app.register(registerAgentRoutes);
  app.register(registerInsightsRoutes);
  app.register(registerNotificationRoutes);
  app.register(registerOrganizationRoutes);

  return app;
}
