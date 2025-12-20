import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { buildApp } from "../app.js";
import { getClientsRepository } from "../repositories/clients-repository.js";
import { getProjectsRepository } from "../repositories/projects-repository.js";
import { getTasksRepository } from "../repositories/tasks-repository.js";
import { getTeamMembersRepository } from "../repositories/team-members-repository.js";
import { getTimeEntriesRepository } from "../repositories/time-entries-repository.js";

const orgId = "org-team-overview";
const gestorToken = Buffer.from(
  JSON.stringify({ uid: "tester", roles: ["gestor"], orgId })
).toString("base64");

const mockUsers: Record<string, { displayName?: string; name?: string; email?: string }> = {
  "uid-123": { displayName: "Directory User", email: "user@test.com" }
};

vi.mock("../firebase.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../firebase.js");
  return {
    ...actual,
    getFirestoreDb: () => ({
      collection: () => ({
        doc: (uid: string) => ({
          async get() {
            const data = mockUsers[uid];
            return {
              id: uid,
              exists: Boolean(data),
              data: () => data
            };
          }
        })
      })
    })
  };
});

describe("team overview names resolution", () => {
  const app = buildApp();
  const clientsRepo = getClientsRepository();
  const projectsRepo = getProjectsRepository();
  const tasksRepo = getTasksRepository();
  const membersRepo = getTeamMembersRepository();
  const timeEntriesRepo = getTimeEntriesRepository();

  let projectId: string;
  let taskId: string;
  let memberName: string;

  beforeAll(async () => {
    await app.ready();

    const client = await clientsRepo.create(orgId, { name: "Team Overview Client" }, "tester");
    const project = await projectsRepo.create(
      orgId,
      {
        clientId: client.id,
        name: "Team Overview Project"
      },
      "tester"
    );

    projectId = project.id;

    const member = await membersRepo.create(
      orgId,
      {
        name: "Alice Without UID",
        email: "user@test.com",
        role: "analista",
        status: "active"
      },
      "tester"
    );
    memberName = member.name;

    const task = await tasksRepo.create(
      orgId,
      project.id,
      {
        title: "Task for hours",
        assignees: [],
        status: "backlog"
      },
      "tester"
    );
    taskId = task.id;

    await timeEntriesRepo.create(
      orgId,
      {
        projectId,
        taskId,
        date: new Date().toISOString(),
        reportedMinutes: 90
      },
      "uid-123"
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("resolves hours by user using user directory email when member has no userId", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/team/overview",
      headers: {
        authorization: `Bearer ${gestorToken}`
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      charts: { hoursByUser: Array<{ id: string; name: string; minutes: number }> };
      members: Array<{ id: string; hoursMinutes: number }>;
    };

    const owner = body.charts.hoursByUser[0];
    expect(owner.name).toBe(memberName);
    expect(owner.minutes).toBe(90);

    const memberHours = body.members.find((member) => member.id === owner.id);
    expect(memberHours?.hoursMinutes).toBe(90);
  });
});
