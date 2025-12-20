import { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => {
    return {
      status: "ok",
      service: "taskora-api",
      timestamp: new Date().toISOString()
    };
  });
}
