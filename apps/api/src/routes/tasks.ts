import type { FastifyBaseLogger, FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";

import { getClientTimelineRepository } from "../repositories/client-timeline-repository.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";
import { getTeamMembersRepository } from "../repositories/team-members-repository.js";
import { getTimeEntriesRepository } from "../repositories/time-entries-repository.js";
import type { ClientEntity } from "../types/clients.js";
import type { ClientTimelineCreateInput } from "../types/client-timeline.js";
import type { ProjectEntity } from "../types/projects.js";
import { TASK_STATUS_LABELS, TASK_STATUS_VALUES, TASK_TYPE_LABELS, TASK_TYPE_VALUES } from "../constants/tasks.js";
import type { TaskEntity } from "../types/tasks.js";
import { emitOrgNotification, type NotificationEventInput } from "../services/notifications.js";

const tasksRepository = getTasksRepository();
const projectsRepository = getProjectsRepository();
const clientsRepository = getClientsRepository();
const teamMembersRepository = getTeamMembersRepository();
const clientTimelineRepository = getClientTimelineRepository();
const timeEntriesRepository = getTimeEntriesRepository();

const PLATFORM_FILTER_VALUES = ["google", "meta", "ga4", "pinterest", "tiktok", "other"] as const;

const taskStatusEnum = z.enum(TASK_STATUS_VALUES);
const taskTypeEnum = z.enum(TASK_TYPE_VALUES);
const platformFilterEnum = z.enum(PLATFORM_FILTER_VALUES);
const overviewPeriodEnum = z.enum(["today", "week", "month", "last7", "last30", "custom"] as const);

const PRIORITY_LABELS: Record<TaskPriorityTag, string> = {
  overdue: "Atrasada",
  due_today: "Hoje",
  upcoming: "Proxima",
  no_due_date: "Sem prazo",
  completed: "Concluida"
};

const TIMELINE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short"
});

const checklistItemSchema = z.object({
  id: z.string().min(1).optional(),
  label: z.string().min(1),
  done: z.boolean().optional()
});

const integrationSchema = z
  .object({
    provider: z.enum(["google", "meta", "other"]).optional(),
    externalId: z.string().min(1).nullable().optional(),
    syncStatus: z.enum(["disconnected", "pending", "synced", "error"]).optional(),
    lastSyncAt: z.string().nullable().optional(),
    notes: z.string().nullable().optional()
  })
  .nullable()
  .optional();

const taskBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  type: taskTypeEnum.optional(),
  status: taskStatusEnum.optional(),
  assignees: z.array(z.string().min(1)).max(10).optional(),
  dueDate: z.string().nullable().optional(),
  checklist: z.array(checklistItemSchema).max(25).optional(),
  integration: integrationSchema
});

const taskUpdateSchema = taskBodySchema
  .extend({
    projectId: z.string().min(1).optional()
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe algum campo para atualizar"
  });

const listQuerySchema = z.object({
  status: taskStatusEnum.optional(),
  assignee: z.string().optional(),
  search: z.string().optional()
});

const timelineEventEnum = z.enum(["note", "meeting", "integration", "task", "hour", "report", "alert"] as const);

const historyQuerySchema = z.object({
  clientId: z.string().min(1).optional(),
  eventType: timelineEventEnum.optional(),
  before: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  projectId: z.string().optional(),
  assigneeId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional()
});

const overviewQuerySchema = z.object({
  status: taskStatusEnum.optional(),
  type: taskTypeEnum.optional(),
  assigneeId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  platform: platformFilterEnum.optional(),
  period: overviewPeriodEnum.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional()
});

type OverviewQuery = z.infer<typeof overviewQuerySchema>;
type OverviewPeriod = z.infer<typeof overviewPeriodEnum>;
type PlatformFilter = z.infer<typeof platformFilterEnum>;
type TaskPriorityTag = "overdue" | "due_today" | "upcoming" | "no_due_date" | "completed";

const PLATFORM_FILTER_OPTIONS: Array<{ value: PlatformFilter; label: string }> = [
  { value: "google", label: "Google Ads" },
  { value: "meta", label: "Meta Ads" },
  { value: "ga4", label: "GA4" },
  { value: "pinterest", label: "Pinterest" },
  { value: "tiktok", label: "TikTok" },
  { value: "other", label: "Outros" }
];

async function ensureProjectOrThrow(orgId: string, projectId: string, reply: FastifyReply): Promise<ProjectEntity> {
  const project = await projectsRepository.findById(orgId, projectId);
  if (!project) {
    throw reply.notFound("Projeto nao encontrado");
  }
  return project;
}

type DateRange = {
  start: Date;
  end: Date;
};

type CardRange = {
  start: Date | null;
  end: Date | null;
};

type CardHighlight = {
  id: string;
  title: string;
  dueDate: string | null;
  clientName: string | null;
  assignees: Array<{ id: string; name: string }>;
} | null;

type TaskOverviewRecord = TaskEntity & {
  projectSnapshot: ProjectEntity | null;
  clientSnapshot: ClientEntity | null;
  dueDateValue: Date | null;
  dueDateMs: number | null;
  priorityTag: TaskPriorityTag;
  checklistSummary: {
    total: number;
    done: number;
  };
  assigneesDetailed: Array<{
    id: string;
    name: string;
    color: string | null;
    role: string | null;
  }>;
  platformTags: string[];
  createdById?: string | null;
  createdByName?: string | null;
};

function buildActorLabel(user: { email?: string | null; uid?: string | null }): string {
  return user.email ?? user.uid ?? "Alguem";
}

function haveSameAssignees(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

function formatDueDateLabel(value: string | null): string {
  if (!value) {
    return "Sem prazo";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Sem prazo";
  }
  return parsed.toLocaleDateString("pt-BR");
}

async function safeNotify(event: NotificationEventInput, logger: FastifyBaseLogger): Promise<void> {
  try {
    await emitOrgNotification(event, { logger });
  } catch (error) {
    logger.warn({ err: error, event }, "Failed to emit notification");
  }
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = startOfDay(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function startOfWeek(date: Date): Date {
  const base = startOfDay(date);
  const weekday = base.getUTCDay(); // 0 = domingo
  const diff = weekday === 0 ? -6 : 1 - weekday;
  return addDays(base, diff);
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  return endOfDay(addDays(start, 6));
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date: Date): Date {
  const start = startOfMonth(date);
  const nextMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  return new Date(nextMonth.getTime() - 1);
}

function parseDateInput(value: string | undefined, label: string, reply: FastifyReply): Date {
  if (!value) {
    throw reply.badRequest(`Informe o campo ${label}`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw reply.badRequest(`Data invalida (${label})`);
  }
  return parsed;
}

function resolveDateRange(query: OverviewQuery, reply: FastifyReply): DateRange | null {
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(todayStart);

  switch (query.period) {
    case "today":
      return { start: todayStart, end: todayEnd };
    case "week":
      return { start: startOfWeek(todayStart), end: endOfWeek(todayStart) };
    case "month": {
      const start = startOfMonth(todayStart);
      return { start, end: endOfMonth(start) };
    }
    case "last7":
      return { start: addDays(todayStart, -6), end: todayEnd };
    case "last30":
      return { start: addDays(todayStart, -29), end: todayEnd };
    case "custom": {
      const start = startOfDay(parseDateInput(query.from, "from", reply));
      const end = endOfDay(parseDateInput(query.to, "to", reply));
      if (start > end) {
        throw reply.badRequest("O campo 'from' deve ser anterior a 'to'");
      }
      return { start, end };
    }
    default:
      break;
  }

  if (!query.period && (query.from || query.to)) {
    if (!query.from || !query.to) {
      throw reply.badRequest("Defina os campos 'from' e 'to' para filtrar pelo periodo customizado");
    }
    const start = startOfDay(parseDateInput(query.from, "from", reply));
    const end = endOfDay(parseDateInput(query.to, "to", reply));
    if (start > end) {
      throw reply.badRequest("O campo 'from' deve ser anterior a 'to'");
    }
    return { start, end };
  }

  return null;
}

function parseDueDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function resolvePriority(task: TaskEntity, dueDate: Date | null, todayStart: Date): TaskPriorityTag {
  if (task.status === "done") {
    return "completed";
  }
  if (!dueDate) {
    return "no_due_date";
  }
  if (dueDate < todayStart) {
    return "overdue";
  }
  const tomorrow = addDays(todayStart, 1);
  if (dueDate < tomorrow) {
    return "due_today";
  }
  return "upcoming";
}

function resolveTaskPlatforms(client: ClientEntity | null): string[] {
  if (!client) {
    return ["other"];
  }

  const tags = new Set<string>();
  client.platforms.forEach((platform) => tags.add(platform));

  if ((client.googleCustomerIds?.length ?? 0) > 0) {
    tags.add("google");
  }
  if ((client.metaAccountIds?.length ?? 0) > 0) {
    tags.add("meta");
  }
  if ((client.ga4PropertyIds?.length ?? 0) > 0) {
    tags.add("ga4");
  }
  if ((client.pinterestAccountIds?.length ?? 0) > 0) {
    tags.add("pinterest");
  }
  if (tags.size === 0) {
    tags.add("other");
  }

  return Array.from(tags);
}

type TimelineActor = {
  id: string | null;
  label: string | null;
};

function formatTimelineDueDate(value: string | null): string {
  if (!value) {
    return "Sem prazo";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Sem prazo";
  }
  return TIMELINE_DATE_FORMATTER.format(parsed);
}

async function registerQuickActionTimelineEvents({
  orgId,
  project,
  previous,
  updated,
  actor
}: {
  orgId: string;
  project: ProjectEntity;
  previous: TaskEntity;
  updated: TaskEntity;
  actor: TimelineActor;
}): Promise<void> {
  const clientId = project.clientId;
  if (!clientId) {
    return;
  }

  const events: ClientTimelineCreateInput[] = [];
  const metadataBase = {
    taskId: updated.id,
    taskTitle: updated.title,
    projectId: project.id,
    projectName: project.name,
    assignees: updated.assignees ?? [],
    taskType: updated.type
  };

  if (previous.status !== updated.status) {
    events.push({
      eventType: "task",
      title: `Status atualizado: ${TASK_STATUS_LABELS[updated.status]}`,
      description: `A tarefa "${updated.title}" mudou de ${TASK_STATUS_LABELS[previous.status]} para ${TASK_STATUS_LABELS[updated.status]}.`,
      metadata: {
        ...metadataBase,
        fromStatus: previous.status,
        toStatus: updated.status
      },
      tags: ["tarefas", "status", updated.status],
      source: "tasks"
    });
  }

  if (previous.dueDate !== updated.dueDate) {
    events.push({
      eventType: "task",
      title: "Prazo atualizado",
      description: `A tarefa "${updated.title}" foi reagendada de ${formatTimelineDueDate(previous.dueDate)} para ${formatTimelineDueDate(updated.dueDate)}.`,
      metadata: {
        ...metadataBase,
        fromDueDate: previous.dueDate,
        toDueDate: updated.dueDate
      },
      tags: ["tarefas", "prazo"],
      source: "tasks"
    });
  }

  const todayStart = startOfDay(new Date());
  const previousPriority = resolvePriority(previous, parseDueDate(previous.dueDate), todayStart);
  const nextPriority = resolvePriority(updated, parseDueDate(updated.dueDate), todayStart);
  if (previousPriority !== nextPriority) {
    events.push({
      eventType: "task",
      title: "Prioridade ajustada",
      description: `A tarefa "${updated.title}" mudou de ${PRIORITY_LABELS[previousPriority]} para ${PRIORITY_LABELS[nextPriority]}.`,
      metadata: {
        ...metadataBase,
        fromPriority: previousPriority,
        toPriority: nextPriority
      },
      tags: ["tarefas", "prioridade"],
      source: "tasks"
    });
  }

  const typeLabel = TASK_TYPE_LABELS[updated.type];
  if (updated.type === "report" && updated.status === "done" && previous.status !== "done") {
    events.push({
      eventType: "report",
      title: "Relatorio concluido",
      description: `O relatorio "${updated.title}" foi concluido (${typeLabel}).`,
      metadata: {
        ...metadataBase,
        fromStatus: previous.status,
        toStatus: updated.status
      },
      tags: ["relatorio", "tarefas"],
      source: "tasks"
    });
  }

  if (updated.type === "meeting" && updated.status === "done" && previous.status !== "done") {
    events.push({
      eventType: "meeting",
      title: "Reuniao concluida",
      description: `A reuniao "${updated.title}" foi marcada como concluida.`,
      metadata: {
        ...metadataBase,
        fromStatus: previous.status,
        toStatus: updated.status
      },
      tags: ["reuniao", "tarefas"],
      source: "tasks"
    });
  }

  if (events.length === 0) {
    return;
  }

  await Promise.all(
    events.map((event) => clientTimelineRepository.add(orgId, clientId, event, actor))
  );
}

function isWithinRange(date: Date | null, range: DateRange): boolean {
  if (!date) {
    return false;
  }
  return date >= range.start && date <= range.end;
}

function buildCardHighlight(tasks: TaskOverviewRecord[]): CardHighlight {
  if (tasks.length === 0) {
    return null;
  }
  const next = [...tasks].sort((a, b) => {
    const aTime = a.dueDateMs ?? Number.POSITIVE_INFINITY;
    const bTime = b.dueDateMs ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  })[0];

  return {
    id: next.id,
    title: next.title,
    dueDate: next.dueDate,
    clientName: next.clientSnapshot?.name ?? null,
    assignees: next.assigneesDetailed.map((assignee) => ({
      id: assignee.id,
      name: assignee.name
    }))
  };
}

function buildCardBlock(tasks: TaskOverviewRecord[], range: CardRange) {
  return {
    total: tasks.length,
    range: {
      start: range.start ? range.start.toISOString() : null,
      end: range.end ? range.end.toISOString() : null
    },
    highlight: buildCardHighlight(tasks)
  };
}

function matchesFilters(
  task: TaskOverviewRecord,
  filters: OverviewQuery,
  range: DateRange | null,
  searchTerm: string | null,
  options: { ignoreDateRange?: boolean } = {}
): boolean {
  if (filters.status && task.status !== filters.status) {
    return false;
  }
  if (filters.type && task.type !== filters.type) {
    return false;
  }
  if (filters.assigneeId && !task.assignees.includes(filters.assigneeId)) {
    return false;
  }
  if (filters.projectId && task.projectId !== filters.projectId) {
    return false;
  }
  if (filters.clientId && task.clientSnapshot?.id !== filters.clientId) {
    return false;
  }
  if (filters.platform && !task.platformTags.includes(filters.platform)) {
    return false;
  }
  if (range && !options.ignoreDateRange) {
    if (task.dueDateValue && (task.dueDateValue < range.start || task.dueDateValue > range.end)) {
      return false;
    }
  }
  if (searchTerm) {
    const haystack = `${task.title} ${task.description ?? ""}`.toLowerCase();
    if (!haystack.includes(searchTerm)) {
      return false;
    }
  }
  return true;
}

export async function registerTaskRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/tasks/history",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const orgId = request.orgId!;
      const parsedQuery = historyQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw reply.badRequest(parsedQuery.error.issues.map((issue) => issue.message).join(", "));
      }

      const { clientId, eventType, before, from, to, projectId, assigneeId } = parsedQuery.data;
      const limit = Math.min(Math.max(parsedQuery.data.limit ?? 20, 1), 100);
      const queryLimit = projectId || assigneeId ? Math.min(limit * 5, 200) : limit;

      const tz = "-03:00";
      const normalizeDate = (value: string | undefined, endOfDay = false): string | undefined => {
        if (!value) return undefined;
        const suffix = endOfDay ? "T23:59:59.999" : "T00:00:00.000";
        return new Date(`${value}${suffix}${tz}`).toISOString();
      };

      const normalizedFrom = normalizeDate(from);
      const normalizedTo = normalizeDate(to, true);

      const items = await clientTimelineRepository.listByOrg(orgId, {
        clientId: clientId ?? undefined,
        eventType: eventType ?? undefined,
        before: before ?? undefined,
        from: normalizedFrom,
        to: normalizedTo,
        limit: queryLimit
      });

      const filteredByProject = projectId
        ? items.filter((item) => item.metadata?.["projectId"] === projectId || item.projectId === projectId)
        : items;
      const filteredByAssignee = assigneeId
        ? filteredByProject.filter((item) => {
            const metadataAssignee = item.metadata?.["assigneeId"] === assigneeId;
            const metadataAssignees =
              Array.isArray(item.metadata?.["assignees"]) && item.metadata?.["assignees"].includes(assigneeId);
            return item.actorId === assigneeId || metadataAssignee || metadataAssignees;
          })
        : filteredByProject;

      const sliced = filteredByAssignee.slice(0, limit);
      const nextCursor = items.length === queryLimit ? items[items.length - 1]?.occurredAt ?? null : null;

      return {
        items: sliced,
        nextCursor
      };
    }
  );

  app.get(
    "/projects/:projectId/tasks",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const orgId = request.orgId!;
      const { projectId } = request.params as { projectId: string };
      await ensureProjectOrThrow(orgId, projectId, reply);

      const parsedQuery = listQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw reply.badRequest(parsedQuery.error.issues.map((issue) => issue.message).join(", "));
      }

      const items = await tasksRepository.list(orgId, projectId, parsedQuery.data);
      return { items };
    }
  );

  app.post(
    "/projects/:projectId/tasks",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista"].includes(role))) {
        throw reply.forbidden("Somente gestores ou analistas podem criar tarefas");
      }

      const orgId = request.orgId!;
      const { projectId } = request.params as { projectId: string };
      const project = await ensureProjectOrThrow(orgId, projectId, reply);

      const parsed = taskBodySchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const record = await tasksRepository.create(orgId, projectId, parsed.data, user.uid);
      void safeNotify(
        {
          orgId,
          title: `Nova tarefa: ${record.title}`,
          body: `${buildActorLabel(user)} criou no projeto ${project.name}`,
          eventType: "task_created",
          entityId: record.id,
          entityType: "task",
          actorId: user.uid ?? null,
          actorName: user.email ?? null,
          data: {
            projectId,
            taskId: record.id,
            status: record.status,
            dueDate: record.dueDate ?? ""
          }
        },
        request.log
      );
      return reply.code(201).send(record);
    }
  );

  app.put(
    "/projects/:projectId/tasks/:taskId",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const orgId = request.orgId!;
      const { projectId, taskId } = request.params as { projectId: string; taskId: string };
      const project = await ensureProjectOrThrow(orgId, projectId, reply);

      const parsed = taskUpdateSchema.safeParse(request.body);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }
      const payload = parsed.data;

      const currentTask = await tasksRepository.findById(orgId, projectId, taskId);
      if (!currentTask) {
        throw reply.notFound("Tarefa nao encontrada");
      }

      let targetProject = project;
      if (payload.projectId && payload.projectId !== projectId) {
        targetProject = await ensureProjectOrThrow(orgId, payload.projectId, reply);
      }

      try {
        const updated = await tasksRepository.update(orgId, projectId, taskId, payload, user.uid);
        if (payload.projectId && payload.projectId !== currentTask.projectId) {
          try {
            await timeEntriesRepository.reassignProject(orgId, updated.id, updated.projectId);
          } catch (reassignError) {
            request.log.error(
              { err: reassignError, taskId, projectId: payload.projectId },
              "Failed to reassign time entries for task"
            );
          }
        }
        const actor: TimelineActor = { id: user.uid ?? null, label: user.email ?? user.uid ?? null };
        try {
          await registerQuickActionTimelineEvents({
            orgId,
            project: targetProject,
            previous: currentTask,
            updated,
            actor
          });
        } catch (timelineError) {
          request.log.error(
            { err: timelineError, taskId, projectId },
            "Failed to record timeline event for task update"
          );
        }

        const actorLabel = buildActorLabel(user);
        const baseEvent: Partial<NotificationEventInput> = {
          orgId,
          entityId: updated.id,
          entityType: "task",
          actorId: user.uid ?? null,
          actorName: user.email ?? null,
          data: {
            projectId: updated.projectId,
            taskId: updated.id
          }
        };

        const notifications: NotificationEventInput[] = [];

        if (currentTask.status !== updated.status) {
          notifications.push({
            ...baseEvent,
            orgId,
            title: `Status atualizado: ${updated.title}`,
            body: `${actorLabel} mudou para ${TASK_STATUS_LABELS[updated.status]}`,
            eventType: "task_status_changed",
            data: {
              ...baseEvent.data,
              fromStatus: currentTask.status,
              toStatus: updated.status
            }
          } as NotificationEventInput);
        }

        if (!haveSameAssignees(currentTask.assignees, updated.assignees)) {
          notifications.push({
            ...baseEvent,
            orgId,
            title: `Responsaveis atualizados: ${updated.title}`,
            body: `${actorLabel} ajustou responsaveis (${updated.assignees.length})`,
            eventType: "task_assignees_changed",
            data: {
              ...baseEvent.data,
              assignees: updated.assignees.join(",")
            }
          } as NotificationEventInput);
        }

        if (currentTask.dueDate !== updated.dueDate) {
          notifications.push({
            ...baseEvent,
            orgId,
            title: `Prazo atualizado: ${updated.title}`,
            body: `${actorLabel} definiu prazo para ${formatDueDateLabel(updated.dueDate)}`,
            eventType: "task_due_changed",
            data: {
              ...baseEvent.data,
              dueDate: updated.dueDate ?? ""
            }
          } as NotificationEventInput);
        }

        if (notifications.length === 0) {
          notifications.push({
            ...baseEvent,
            orgId,
            title: `Tarefa atualizada: ${updated.title}`,
            body: `${actorLabel} editou no projeto ${targetProject.name}`,
            eventType: "task_updated"
          } as NotificationEventInput);
        }

        notifications.forEach((event) => {
          void safeNotify(event, request.log);
        });
        return updated;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to update task");
        throw reply.notFound("Tarefa nao encontrada");
      }
    }
  );

  app.delete(
    "/projects/:projectId/tasks/:taskId",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.includes("gestor")) {
        throw reply.forbidden("Somente gestores podem arquivar tarefas");
      }

      const orgId = request.orgId!;
      const { projectId, taskId } = request.params as { projectId: string; taskId: string };
      const project = await ensureProjectOrThrow(orgId, projectId, reply);

      try {
        const archived = await tasksRepository.archive(orgId, projectId, taskId, user.uid);
        void safeNotify(
          {
            orgId,
            title: `Tarefa arquivada: ${archived.title}`,
            body: `${buildActorLabel(user)} arquivou em ${project.name}`,
            eventType: "task_archived",
            entityId: archived.id,
            entityType: "task",
            actorId: user.uid ?? null,
            actorName: user.email ?? null,
            data: {
              projectId,
              taskId: archived.id
            }
          },
          request.log
        );
        return archived;
      } catch (error) {
        request.log.warn({ err: error }, "Failed to archive task");
        throw reply.notFound("Tarefa nao encontrada");
      }
    }
  );

  app.get(
    "/tasks/overview",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsedQuery = overviewQuerySchema.safeParse(request.query);
      if (!parsedQuery.success) {
        throw reply.badRequest(parsedQuery.error.issues.map((issue) => issue.message).join(", "));
      }

      const filters = parsedQuery.data;
      const orgId = request.orgId!;

      const [tasks, projects, clients, teamMembers] = await Promise.all([
        tasksRepository.listAll(orgId),
        projectsRepository.list(orgId),
        clientsRepository.list(orgId),
        teamMembersRepository.list(orgId)
      ]);

      const dateRange = resolveDateRange(filters, reply);
      const searchInput = filters.search?.trim() ?? null;
      const searchTerm = searchInput && searchInput.length > 0 ? searchInput.toLowerCase() : null;

      const todayStart = startOfDay(new Date());
      const todayEnd = endOfDay(todayStart);
      const weekStart = startOfWeek(todayStart);
      const weekEnd = endOfWeek(todayStart);

      const projectIndex = new Map<string, ProjectEntity>();
      projects.forEach((project) => {
        projectIndex.set(project.id, project);
      });

      const clientIndex = new Map<string, ClientEntity>();
      clients.forEach((client) => {
        clientIndex.set(client.id, client);
      });

      const memberIndex = new Map<
        string,
        { name: string; color: string | null; role: string | null; userId: string | null }
      >();
      const memberUserIndex = new Map<string, { name: string; color: string | null; role: string | null }>();
      teamMembers.forEach((member) => {
        memberIndex.set(member.id, {
          name: member.name,
          color: member.color ?? null,
          role: member.role ?? null,
          userId: member.userId ?? null
        });
        if (member.userId) {
          memberUserIndex.set(member.userId, {
            name: member.name,
            color: member.color ?? null,
            role: member.role ?? null
          });
        }
      });

      const overviewTasks: TaskOverviewRecord[] = tasks.map((task) => {
        const project = projectIndex.get(task.projectId) ?? null;
        const client = project ? clientIndex.get(project.clientId) ?? null : null;
        const dueDateValue = parseDueDate(task.dueDate);
        const dueDateMs = dueDateValue?.getTime() ?? null;
        const priorityTag = resolvePriority(task, dueDateValue, todayStart);
        const checklistDone = task.checklist.filter((item) => item.done).length;
        const assigneesDetailed = task.assignees.map((assigneeId) => {
          const member = memberIndex.get(assigneeId);
          return {
            id: assigneeId,
            name: member?.name ?? "Sem cadastro",
            color: member?.color ?? null,
            role: member?.role ?? null
          };
        });
        const platformTags = resolveTaskPlatforms(client);
        const createdEntry = task.activityLog.find((entry) => entry.type === "created");
        const createdById = createdEntry?.actorId ?? task.createdById ?? null;
        const createdMember =
          (createdById ? memberIndex.get(createdById) ?? memberUserIndex.get(createdById) ?? null : null) ?? null;

        return {
          ...task,
          projectSnapshot: project,
          clientSnapshot: client,
          dueDateValue,
          dueDateMs,
          priorityTag,
          checklistSummary: {
            total: task.checklist.length,
            done: checklistDone
          },
          assigneesDetailed,
          platformTags,
          createdById,
          createdByName: createdMember?.name ?? task.createdByName ?? null
        };
      });

      const filtered = overviewTasks.filter((task) => matchesFilters(task, filters, dateRange, searchTerm));
      const filteredWithoutDate = overviewTasks.filter((task) =>
        matchesFilters(task, filters, dateRange, searchTerm, { ignoreDateRange: true })
      );

      const actionable = filtered.filter((task) => task.status !== "done");
      const actionableWithoutDate = filteredWithoutDate.filter((task) => task.status !== "done");

      const todayTasks = actionable.filter((task) =>
        isWithinRange(task.dueDateValue, { start: todayStart, end: todayEnd })
      );
      const weekTasks = actionable.filter((task) =>
        isWithinRange(task.dueDateValue, { start: weekStart, end: weekEnd })
      );
      const overdueTasks = actionableWithoutDate.filter(
        (task) => task.dueDateValue && task.dueDateValue < todayStart
      );

      const priorityOrder: Record<TaskPriorityTag, number> = {
        overdue: 0,
        due_today: 1,
        upcoming: 2,
        no_due_date: 3,
        completed: 4
      };

      const sorted = [...filtered].sort((a, b) => {
        if (priorityOrder[a.priorityTag] !== priorityOrder[b.priorityTag]) {
          return priorityOrder[a.priorityTag] - priorityOrder[b.priorityTag];
        }
        if (a.dueDateMs !== b.dueDateMs) {
          if (a.dueDateMs === null) {
            return 1;
          }
          if (b.dueDateMs === null) {
            return -1;
          }
          return a.dueDateMs - b.dueDateMs;
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });

      const items = sorted.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        type: task.type,
        dueDate: task.dueDate,
        priority: task.priorityTag,
        createdById: task.createdById ?? null,
        createdByName: task.createdByName ?? null,
        project: task.projectSnapshot
          ? {
              id: task.projectSnapshot.id,
              name: task.projectSnapshot.name,
              clientId: task.projectSnapshot.clientId
            }
          : null,
        client: task.clientSnapshot
          ? {
              id: task.clientSnapshot.id,
              name: task.clientSnapshot.name,
              segment: task.clientSnapshot.segment,
              responsibleId: task.clientSnapshot.responsibleId
            }
          : null,
        assignees: task.assigneesDetailed,
        platforms: task.platformTags,
        checklist: task.checklistSummary,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }));

      const totalsByStatus = TASK_STATUS_VALUES.reduce(
        (acc, status) => {
          acc[status] = 0;
          return acc;
        },
        {} as Record<(typeof TASK_STATUS_VALUES)[number], number>
      );

      const totalsByType = TASK_TYPE_VALUES.reduce(
        (acc, type) => {
          acc[type] = 0;
          return acc;
        },
        {} as Record<(typeof TASK_TYPE_VALUES)[number], number>
      );

      filtered.forEach((task) => {
        totalsByStatus[task.status] += 1;
        totalsByType[task.type] += 1;
      });

      const cards = {
        today: buildCardBlock(todayTasks, { start: todayStart, end: todayEnd }),
        week: buildCardBlock(weekTasks, { start: weekStart, end: weekEnd }),
        overdue: buildCardBlock(overdueTasks, { start: null, end: todayStart })
      };

      const appliedRange = dateRange
        ? {
            start: dateRange.start.toISOString(),
            end: dateRange.end.toISOString()
          }
        : null;

      return {
        metadata: {
          generatedAt: new Date().toISOString(),
          total: filtered.length,
          appliedFilters: {
            ...filters,
            search: searchInput && searchInput.length > 0 ? searchInput : null,
            range: appliedRange
          }
        },
        cards,
        totals: {
          byStatus: totalsByStatus,
          byType: totalsByType
        },
        filters: {
          assignees: teamMembers
            .filter((member) => member.status === "active")
            .map((member) => ({
              id: member.id,
              name: member.name,
              role: member.role,
              color: member.color ?? null
            })),
          clients: clients
            .filter((client) => client.status === "active")
            .map((client) => ({
              id: client.id,
              name: client.name,
              segment: client.segment,
              responsibleId: client.responsibleId
            })),
          projects: projects
            .filter((project) => !project.archivedAt)
            .map((project) => ({
              id: project.id,
              name: project.name,
              clientId: project.clientId
            })),
          platforms: PLATFORM_FILTER_OPTIONS
        },
        items
      };
    }
  );
}
