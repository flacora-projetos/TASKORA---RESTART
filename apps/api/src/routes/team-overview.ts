import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";
import { getTeamMembersRepository } from "../repositories/team-members-repository.js";
import { getTimeEntriesRepository } from "../repositories/time-entries-repository.js";
import { getFirestoreDb } from "../firebase.js";
import type { TeamMemberEntity } from "../types/team-members.js";
import type { TaskEntity, TaskStatus } from "../types/tasks.js";

const tasksRepository = getTasksRepository();
const projectsRepository = getProjectsRepository();
const clientsRepository = getClientsRepository();
const teamMembersRepository = getTeamMembersRepository();
const timeEntriesRepository = getTimeEntriesRepository();

const periodEnum = z.enum(["today", "week", "month", "last7", "last30", "custom"] as const);

const querySchema = z.object({
  period: periodEnum.default("last7"),
  from: z.string().optional(),
  to: z.string().optional()
});

type Period = z.infer<typeof periodEnum>;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setUTCHours(23, 59, 59, 999);
  return copy;
}

function resolveDateRange(period: Period, from?: string, to?: string): { start: string; end: string } {
  const today = new Date();

  if (period === "custom" && from && to) {
    return { start: startOfDay(new Date(from)).toISOString(), end: endOfDay(new Date(to)).toISOString() };
  }

  const end = endOfDay(today);
  let start = startOfDay(today);

  switch (period) {
    case "today":
      start = startOfDay(today);
      break;
    case "week": {
      const currentDay = today.getUTCDay();
      const diff = currentDay === 0 ? 6 : currentDay - 1; // week starts on Monday
      start = startOfDay(new Date(today.getTime() - diff * 24 * 60 * 60 * 1000));
      break;
    }
    case "month":
      start = startOfDay(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
      break;
    case "last30":
      start = startOfDay(new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000));
      break;
    default:
    case "last7":
      start = startOfDay(new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000));
      break;
  }

  return { start: start.toISOString(), end: end.toISOString() };
}

function isWithinRange(dateIso: string, start: string, end: string): boolean {
  return dateIso >= start && dateIso <= end;
}

export async function registerTeamOverviewRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/team/overview",
    {
      preHandler: [app.authenticate, app.requireOrg()]
    },
    async (request, reply) => {
      const user = request.user!;
      if (!user.roles.some((role) => ["gestor", "analista", "suporte"].includes(role))) {
        throw reply.forbidden("Permissao insuficiente");
      }

      const parsed = querySchema.safeParse(request.query);
      if (!parsed.success) {
        throw reply.badRequest(parsed.error.issues.map((issue) => issue.message).join(", "));
      }

      const { start, end } = resolveDateRange(parsed.data.period, parsed.data.from, parsed.data.to);
      const orgId = request.orgId!;

      const [tasks, timeEntries, teamMembers, projects, clients] = await Promise.all([
        tasksRepository.listAll(orgId),
        timeEntriesRepository.list(orgId, { startDate: start, endDate: end, limit: 10000 }),
        teamMembersRepository.list(orgId, {}),
        projectsRepository.list(orgId),
        clientsRepository.list(orgId)
      ]);

      const clientById = new Map(clients.map((client) => [client.id, client]));
      const projectById = new Map(projects.map((project) => [project.id, project]));
      const memberLookups = buildMemberLookups(teamMembers);
      const memberById = memberLookups.byId;

      const userIdsForDirectory = new Set<string>();
      timeEntries.forEach((entry) => {
        if (entry.userId) {
          userIdsForDirectory.add(entry.userId);
        }
      });
      tasks.forEach((task) => {
        task.assignees.forEach((assigneeId) => {
          if (assigneeId) {
            userIdsForDirectory.add(assigneeId);
          }
        });
      });

      const doneTasks = tasks.filter((task) => task.status === "done" && isWithinRange(task.updatedAt, start, end));
      const tasksWithDue = doneTasks.filter((task) => Boolean(task.dueDate));
      const onTimeTasks = tasksWithDue.filter((task) => task.dueDate && task.updatedAt <= task.dueDate);
      const onTimePercent = tasksWithDue.length > 0 ? Math.round((onTimeTasks.length / tasksWithDue.length) * 100) : null;

      const wipStatuses: TaskStatus[] = ["in_progress", "review"];
      const wipCount = tasks.filter((task) => wipStatuses.includes(task.status)).length;
      const blockedCount = tasks.filter((task) => task.status === "blocked").length;
      const overdueCount = tasks.filter(
        (task) =>
          task.status !== "done" &&
          task.dueDate !== null &&
          new Date(task.dueDate).toISOString() < startOfDay(new Date()).toISOString()
      ).length;

      const timeByTaskId = new Set(
        timeEntries.filter((entry) => entry.taskId).map((entry) => entry.taskId as string)
      );
      const missingTimeCount = doneTasks.filter((task) => !timeByTaskId.has(task.id)).length;

      const userDirectory = await loadUserDirectory(userIdsForDirectory);

      // Resolve horas por pessoa priorizando o membro vinculado ao uid (via userId ou email no cadastro)
      const hoursByUser = aggregateMinutes(timeEntries, (entry) => {
        const resolvedMember = resolveMemberForUser(entry.userId, memberLookups, userDirectory);
        return resolvedMember?.id ?? entry.userId ?? "sem_usuario";
      }).map((item) => ({
        id: item.id,
        name: resolveHoursOwnerName(item.id, memberLookups, userDirectory),
        minutes: item.minutes
      }));

      const hoursByClient = aggregateMinutes(timeEntries, (entry) => {
        const project = entry.projectId ? projectById.get(entry.projectId) : null;
        return project?.clientId ?? "sem_cliente";
      }).map((item) => ({
        id: item.id,
        name: item.id === "sem_cliente" ? "Sem cliente" : clientById.get(item.id)?.name ?? item.id,
        minutes: item.minutes
      }));

      const lastDeliveries = doneTasks
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, 10)
        .map((task) => ({
          id: task.id,
          title: task.title,
          updatedAt: task.updatedAt,
          dueDate: task.dueDate,
          status: task.status,
          projectId: task.projectId,
          projectName: projectById.get(task.projectId)?.name ?? null,
          clientId: projectById.get(task.projectId)?.clientId ?? null,
          clientName: projectById.get(task.projectId)?.clientId
            ? clientById.get(projectById.get(task.projectId)!.clientId)?.name ?? null
            : null,
          assignees: task.assignees.map((id) => ({
            id,
            name: resolveAssigneeName(id, memberLookups, userDirectory)
          }))
        }));

      const risks = tasks
        .filter(
          (task) =>
            task.status === "blocked" ||
            (task.status !== "done" && task.dueDate !== null && task.dueDate < new Date().toISOString())
        )
        .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
        .slice(0, 10)
        .map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          dueDate: task.dueDate,
          assignees: task.assignees.map((id) => ({
            id,
            name: resolveAssigneeName(id, memberLookups, userDirectory)
          })),
          projectName: projectById.get(task.projectId)?.name ?? null,
          clientName: projectById.get(task.projectId)?.clientId
            ? clientById.get(projectById.get(task.projectId)!.clientId)?.name ?? null
            : null
        }));

      const tasksByMember = new Map<string, TaskEntity[]>();
      tasks.forEach((task) => {
        task.assignees.forEach((id) => {
          tasksByMember.set(id, [...(tasksByMember.get(id) ?? []), task]);
        });
      });

      const timeByMember = aggregateMinutes(timeEntries, (entry) => {
        const resolvedMember = resolveMemberForUser(entry.userId, memberLookups, userDirectory);
        return resolvedMember ? resolvedMember.id : entry.userId ?? "sem_usuario";
      });

      const members = teamMembers.map((member) => {
        const memberTasks = tasksByMember.get(member.id) ?? [];
        const memberWip = memberTasks.filter((task) => wipStatuses.includes(task.status)).length;
        const memberBlocked = memberTasks.filter((task) => task.status === "blocked").length;
        const memberDone = memberTasks.filter((task) => task.status === "done" && isWithinRange(task.updatedAt, start, end))
          .length;
        const memberHours = timeByMember.find((item) => item.id === member.id)?.minutes ?? 0;
        const lastTasks = memberTasks
          .filter((task) => task.status === "done")
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
          .slice(0, 5)
          .map((task) => ({
            id: task.id,
            title: task.title,
            status: task.status,
            updatedAt: task.updatedAt
          }));

        const alerts: string[] = [];
        if (memberWip >= 5) {
          alerts.push("Sobrecarga (WIP alto)");
        }
        if (memberBlocked > 0) {
          alerts.push("Tarefas bloqueadas");
        }
        if (memberDone > 0 && memberHours === 0) {
          alerts.push("Entregas sem horas registradas");
        }

        return {
          id: member.id,
          name: member.name,
          role: member.role,
          email: member.email,
          status: member.status,
          weeklyCapacityMinutes: member.weeklyCapacityMinutes,
          hoursMinutes: memberHours,
          wip: memberWip,
          blocked: memberBlocked,
          done: memberDone,
          lastTasks,
          alerts
        };
      });

      return {
        period: { start, end, kind: parsed.data.period },
        cards: {
          hoursMinutes: timeEntries.reduce((acc, entry) => acc + entry.reportedMinutes, 0),
          tasksDone: doneTasks.length,
          onTimePercent,
          wip: wipCount,
          blocked: blockedCount,
          overdue: overdueCount,
          missingTime: missingTimeCount
        },
        charts: {
          hoursByUser,
          hoursByClient
        },
        lists: {
          lastDeliveries,
          risks
        },
        members
      };
    }
  );
}

type UserProfile = { name: string | null; email: string | null };

type MemberLookups = {
  byId: Map<string, TeamMemberEntity>;
  byUserId: Map<string, TeamMemberEntity>;
  byEmail: Map<string, TeamMemberEntity>;
};

function buildMemberLookups(teamMembers: TeamMemberEntity[]): MemberLookups {
  const byId = new Map<string, TeamMemberEntity>();
  const byUserId = new Map<string, TeamMemberEntity>();
  const byEmail = new Map<string, TeamMemberEntity>();

  teamMembers.forEach((member) => {
    byId.set(member.id, member);
    if (member.userId) {
      byUserId.set(member.userId, member);
    }
    if (member.email) {
      byEmail.set(member.email.toLowerCase(), member);
    }
  });

  return { byId, byUserId, byEmail };
}

function resolveMemberForUser(
  userId: string | null | undefined,
  memberLookups: MemberLookups,
  userDirectory: Map<string, UserProfile>
): TeamMemberEntity | null {
  if (!userId) {
    return null;
  }
  const memberByUid = memberLookups.byUserId.get(userId);
  if (memberByUid) {
    return memberByUid;
  }

  const profile = userDirectory.get(userId);
  const email = profile?.email?.toLowerCase();
  if (email) {
    const matchedByEmail = memberLookups.byEmail.get(email);
    if (matchedByEmail) {
      return matchedByEmail;
    }
  }

  return null;
}

function resolveHoursOwnerName(
  key: string,
  memberLookups: MemberLookups,
  userDirectory: Map<string, UserProfile>
): string {
  const member = memberLookups.byId.get(key) ?? memberLookups.byUserId.get(key);
  if (member) {
    return member.name;
  }

  const profile = userDirectory.get(key);
  if (profile) {
    if (profile.name) {
      return profile.name;
    }
    if (profile.email) {
      return profile.email;
    }
  }

  if (key === "sem_usuario") {
    return "Sem usuario";
  }

  return `Usuario desconhecido (${key})`;
}

function resolveAssigneeName(
  id: string,
  memberLookups: MemberLookups,
  userDirectory: Map<string, UserProfile>
): string {
  if (memberLookups.byId.has(id)) {
    return memberLookups.byId.get(id)!.name;
  }
  if (memberLookups.byUserId.has(id)) {
    return memberLookups.byUserId.get(id)!.name;
  }
  if (id.includes("@")) {
    const matchedByEmail = memberLookups.byEmail.get(id.toLowerCase());
    if (matchedByEmail) {
      return matchedByEmail.name;
    }
  }
  const profile = userDirectory.get(id);
  if (profile) {
    if (profile.name) {
      return profile.name;
    }
    if (profile.email) {
      const matchedByEmail = memberLookups.byEmail.get(profile.email.toLowerCase());
      if (matchedByEmail) {
        return matchedByEmail.name;
      }
      return profile.email;
    }
  }
  if (id === "sem_usuario") {
    return "Sem usuario";
  }
  return `Usuario desconhecido (${id})`;
}

async function loadUserDirectory(userIds: Set<string>): Promise<Map<string, UserProfile>> {
  const directory = new Map<string, UserProfile>();
  if (userIds.size === 0) {
    return directory;
  }

  const db = getFirestoreDb();
  if (!db) {
    return directory;
  }

  const ids = Array.from(userIds).filter(Boolean);
  const chunkSize = 50;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const snapshots = await Promise.all(
      chunk.map(async (uid) => {
        try {
          return await db.collection("users").doc(uid).get();
        } catch {
          return null;
        }
      })
    );

    snapshots.forEach((doc) => {
      if (!doc || !doc.exists) {
        return;
      }
      const data = doc.data() as Record<string, unknown> | undefined;
      const name =
        data && typeof data.displayName === "string"
          ? data.displayName
          : data && typeof data.name === "string"
            ? data.name
            : null;
      const email = data && typeof data.email === "string" ? data.email : null;
      if (name || email) {
        directory.set(doc.id, { name, email });
      }
    });
  }

  return directory;
}

function aggregateMinutes<T extends { reportedMinutes?: number }>(
  items: T[],
  keySelector: (item: T) => string
): Array<{ id: string; minutes: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keySelector(item);
    const minutes = item.reportedMinutes ?? 0;
    map.set(key, (map.get(key) ?? 0) + minutes);
  }
  return Array.from(map.entries()).map(([id, minutes]) => ({ id, minutes }));
}
