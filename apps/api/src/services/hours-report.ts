import { getTimeEntriesRepository } from "../repositories/time-entries-repository.js";

const timeEntriesRepository = getTimeEntriesRepository();

export type HoursReportFilters = {
  startDate?: string | null;
  endDate?: string | null;
  projectId?: string | null;
  userId?: string | null;
  groupBy?: "day";
};

export async function getHoursReport(orgId: string, filters: HoursReportFilters = {}) {
  const entries = await timeEntriesRepository.list(orgId, {
    startDate: filters.startDate ?? undefined,
    endDate: filters.endDate ?? undefined,
    projectId: filters.projectId ?? undefined,
    userId: filters.userId ?? undefined,
    limit: 500
  });

  const totalMinutes = entries.reduce((acc, entry) => acc + entry.reportedMinutes, 0);
  const perProject = aggregate(entries, (entry) => entry.projectId);
  const perUser = aggregate(entries, (entry) => entry.userId);
  const perDay = filters.groupBy === "day" ? aggregateByDay(entries) : undefined;

  return {
    period: {
      startDate: filters.startDate ?? null,
      endDate: filters.endDate ?? null
    },
    filters: {
      projectId: filters.projectId ?? null,
      userId: filters.userId ?? null
    },
    totals: {
      minutes: totalMinutes,
      perProject,
      perUser,
      perDay
    }
  };
}

type TimeEntry = Awaited<ReturnType<typeof timeEntriesRepository.list>>[number];

function aggregate(
  entries: TimeEntry[],
  keySelector: (entry: TimeEntry) => string
): Array<{ id: string; minutes: number }> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const key = keySelector(entry);
    map.set(key, (map.get(key) ?? 0) + entry.reportedMinutes);
  }
  return Array.from(map.entries()).map(([id, minutes]) => ({ id, minutes }));
}

function aggregateByDay(entries: TimeEntry[]): Array<{ date: string; minutes: number }> {
  const map = new Map<string, number>();
  for (const entry of entries) {
    const dateKey = entry.date.slice(0, 10);
    map.set(dateKey, (map.get(dateKey) ?? 0) + entry.reportedMinutes);
  }
  return Array.from(map.entries())
    .map(([date, minutes]) => ({ date, minutes }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
