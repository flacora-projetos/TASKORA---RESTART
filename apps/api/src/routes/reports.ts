import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { TASK_TYPE_VALUES } from "../constants/tasks.js";
import { getHoursReport } from "../services/hours-report.js";
import type { TaskType } from "../types/tasks.js";
import {
  buildTasksByClientCsv,
  buildTasksByClientPdf,
  getTasksByClientReport,
  type TaskByClientReportMode
} from "../services/tasks-by-client-report.js";

const hoursQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  projectId: z.string().optional(),
  userId: z.string().optional(),
  groupBy: z.enum(["day"]).optional()
});

const tasksByClientQuerySchema = z.object({
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  mode: z.enum(["summary", "all"]).optional(),
  types: z.string().optional()
});

const tasksByClientExportSchema = tasksByClientQuerySchema.extend({
  format: z.enum(["pdf", "csv"])
});

function parseDateInput(value: string, label: string, reply: FastifyReply): { date: Date; dateOnly: boolean } {
  const trimmed = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);

  if (dateOnly) {
    const [year, month, day] = trimmed.split("-").map((part) => Number(part));
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      throw reply.badRequest(`Data invalida (${label})`);
    }
    return { date: new Date(Date.UTC(year, month - 1, day)), dateOnly };
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw reply.badRequest(`Data invalida (${label})`);
  }

  return { date: parsed, dateOnly };
}

function normalizeRange(periodStart: string, periodEnd: string, reply: FastifyReply): { start: Date; end: Date } {
  const startParsed = parseDateInput(periodStart, "periodStart", reply);
  const endParsed = parseDateInput(periodEnd, "periodEnd", reply);

  const start = startParsed.date;
  const end = new Date(endParsed.date);
  if (endParsed.dateOnly) {
    end.setUTCHours(23, 59, 59, 999);
  }

  if (start > end) {
    throw reply.badRequest("periodStart deve ser anterior a periodEnd");
  }

  return { start, end };
}

function parseTypes(raw: string | undefined, reply: FastifyReply): TaskType[] | null {
  if (raw === undefined) {
    return null;
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const allowed = new Set(TASK_TYPE_VALUES as readonly string[]);
  const values = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  const invalid = values.filter((value) => !allowed.has(value));
  if (invalid.length > 0) {
    throw reply.badRequest(`Tipos invalidos: ${invalid.join(", ")}`);
  }

  return values as TaskType[];
}

function slugifyFilename(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function buildExportFilename(
  report: { orgName: string; orgSlug?: string | null; generatedAt: string; mode: string },
  format: string
): string {
  const rawSlug = report.orgSlug ?? report.orgName ?? "org";
  const orgSlug = slugifyFilename(rawSlug) || "org";
  const dateLabel = report.generatedAt.slice(0, 10);
  const modeLabel = report.mode ?? "summary";
  return `Relatorio-de-Entregas_${orgSlug}_${dateLabel}_modo-${modeLabel}.${format}`;
}

export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/reports/hours",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsed = hoursQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const orgId = request.orgId!;
      return getHoursReport(orgId, parsed.data);
    }
  );

  app.get(
    "/reports/tasks-by-client",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsed = tasksByClientQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const orgId = request.orgId!;
      const { start, end } = normalizeRange(parsed.data.periodStart, parsed.data.periodEnd, reply);
      const mode = (parsed.data.mode ?? "summary") as TaskByClientReportMode;
      const types = parseTypes(parsed.data.types, reply);

      return getTasksByClientReport(orgId, user, {
        periodStart: start,
        periodEnd: end,
        mode,
        types
      });
    }
  );

  app.get(
    "/reports/tasks-by-client/export",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsed = tasksByClientExportSchema.safeParse(request.query);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const orgId = request.orgId!;
      const { start, end } = normalizeRange(parsed.data.periodStart, parsed.data.periodEnd, reply);
      const mode = (parsed.data.mode ?? "summary") as TaskByClientReportMode;
      const types = parseTypes(parsed.data.types, reply);

      const report = await getTasksByClientReport(orgId, user, {
        periodStart: start,
        periodEnd: end,
        mode,
        types
      });

      const filename = buildExportFilename(report, parsed.data.format);
      if (parsed.data.format === "csv") {
        const csv = buildTasksByClientCsv(report);
        reply.header("Content-Type", "text/csv; charset=utf-8");
        reply.header("Content-Disposition", `attachment; filename="${filename}"`);
        return reply.send(csv);
      }

      const pdf = await buildTasksByClientPdf(report);
      reply.header("Content-Type", "application/pdf");
      reply.header("Content-Disposition", `attachment; filename="${filename}"`);
      return reply.send(pdf);
    }
  );
}
