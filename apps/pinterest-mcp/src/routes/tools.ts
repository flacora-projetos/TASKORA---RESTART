import type { FastifyInstance } from "fastify";

import { handlePinterestSummary } from "../services/pinterest-summary.js";
import type { ToolHandler } from "../types/mcp.js";
import { ensureAuthorized } from "../utils/auth.js";

const toolHandlers: Record<string, ToolHandler> = {
  health: async () => ({
    status: "ok",
    data: {
      service: "pinterest-mcp",
      timestamp: new Date().toISOString()
    }
  }),
  pinterest_summary: handlePinterestSummary
};

export async function registerToolRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { tool: string };
    Body: { args?: Record<string, unknown> | null };
  }>("/tools/:tool/call", async (request, reply) => {
    try {
      ensureAuthorized(request);
    } catch {
      return reply.status(401).send({
        status: "error",
        error: "Token inválido."
      });
    }

    const handler = toolHandlers[request.params.tool];
    if (!handler) {
      return reply.status(404).send({
        status: "error",
        error: "Ferramenta não encontrada."
      });
    }

    try {
      const response = await handler(request.body?.args);
      return reply.send(response);
    } catch (error) {
      request.log.error(
        {
          err: error,
          tool: request.params.tool
        },
        "Erro ao executar ferramenta."
      );
      return reply.status(500).send({
        status: "error",
        error: "Erro interno ao executar ferramenta."
      });
    }
  });
}
