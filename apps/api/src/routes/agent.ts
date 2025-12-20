import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getAgentService, type AgentToolCall } from "../services/agent.js";

const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const toolSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string().min(1).optional(),
    kind: z.literal("internal_tasks"),
    limit: z.number().int().min(1).max(25).optional()
  }),
  z.object({
    id: z.string().min(1).optional(),
    kind: z.literal("external_api"),
    path: z.string().min(1),
    method: z.enum(httpMethods).optional(),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.unknown().optional()
  }),
  z.object({
    id: z.string().min(1).optional(),
    kind: z.literal("mcp"),
    tool: z.string().min(1),
    args: z.record(z.unknown()).optional()
  }),
  z.object({
    id: z.string().min(1).optional(),
    kind: z.literal("ga4"),
    path: z.string().min(1),
    method: z.enum(httpMethods).optional(),
    query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    body: z.unknown().optional()
  }),
  z.object({
    id: z.string().min(1).optional(),
    kind: z.literal("task_create"),
    projectId: z.string().min(1),
    title: z.string().min(1),
    dueDate: z.string().optional(),
    description: z.string().optional(),
    assignees: z.array(z.string().min(1)).optional(),
    status: z.enum(["backlog", "todo", "in_progress", "blocked", "review", "done"]).optional(),
    type: z.enum(["optimization", "report", "creative", "meeting", "other"]).optional()
  })
]);

const historySchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1)
});

const bodySchema = z.object({
  prompt: z.string().min(1, "prompt obrigatório"),
  tools: z.array(toolSchema).optional().default([]),
  history: z.array(historySchema).optional().default([])
});

export async function registerAgentRoutes(app: FastifyInstance): Promise<void> {
  const agentService = getAgentService();

  app.post(
    "/agent/query",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request) => {
      const { prompt, tools, history } = bodySchema.parse(request.body ?? {});

      const result = await agentService.run({
        prompt,
        tools: tools as AgentToolCall[],
        orgId: request.orgId!,
        actorId: request.user!.uid,
        actorRoles: request.user!.roles,
        history
      });

      return result;
    }
  );
}
