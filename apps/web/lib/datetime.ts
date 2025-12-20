const SAO_PAULO_OFFSET_HOURS = 3;

export function dateInputToSaoPauloISOString(value: string): string | null {
  if (!value) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const iso = new Date(Date.UTC(year, month - 1, day, SAO_PAULO_OFFSET_HOURS)).toISOString();
  return iso;
}

export function formatMinutesAsClock(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "00:00";
  }

  const safeMinutes = Math.floor(minutes);
  const hours = Math.floor(safeMinutes / 60);
  const remaining = safeMinutes % 60;

  const hoursLabel = hours.toString().padStart(2, "0");
  const minutesLabel = remaining.toString().padStart(2, "0");

  return `${hoursLabel}:${minutesLabel}`;
}
