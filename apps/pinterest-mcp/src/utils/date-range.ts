const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

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

function daysAgo(days: number): Date {
  return startOfDay(new Date(Date.now() - days * MILLIS_PER_DAY));
}

export type DateRangeResult = {
  preset: string;
  startDate: string;
  endDate: string;
};

export function resolveDateRange(input?: string | null): DateRangeResult {
  const preset = (input ?? "LAST_7_DAYS").toUpperCase();
  const today = startOfDay(new Date());

  switch (true) {
    case preset === "LAST_7_DAYS": {
      const start = daysAgo(6);
      return {
        preset,
        startDate: formatDate(start),
        endDate: formatDate(endOfDay(today))
      };
    }
    case preset === "LAST_30_DAYS": {
      const start = daysAgo(29);
      return {
        preset,
        startDate: formatDate(start),
        endDate: formatDate(endOfDay(today))
      };
    }
    case preset === "THIS_MONTH": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
      return {
        preset,
        startDate: formatDate(start),
        endDate: formatDate(endOfDay(today))
      };
    }
    case preset === "LAST_MONTH": {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
      const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59, 999));
      return {
        preset,
        startDate: formatDate(start),
        endDate: formatDate(end)
      };
    }
    case preset.startsWith("CUSTOM:"): {
      const [, startStr, endStr] = preset.split(":");
      if (!startStr || !endStr) {
        throw new Error("Formato CUSTOM inválido. Use CUSTOM:AAAA-MM-DD:BBBB-MM-DD");
      }
      const start = new Date(`${startStr}T00:00:00.000Z`);
      const end = new Date(`${endStr}T23:59:59.999Z`);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new Error("Datas inválidas no preset CUSTOM.");
      }
      if (end.getTime() < start.getTime()) {
        throw new Error("Data final deve ser posterior à inicial.");
      }
      return {
        preset,
        startDate: formatDate(start),
        endDate: formatDate(end)
      };
    }
    default: {
      throw new Error(`Preset de range não suportado: ${preset}`);
    }
  }
}
