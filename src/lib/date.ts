/** Local-calendar helpers. Records are grouped by the local day a session started. */

export function dayKey(d: Date | number): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfDay(d: Date | number): Date {
  const date = new Date(typeof d === 'number' ? d : d.getTime());
  date.setHours(0, 0, 0, 0);
  return date;
}

/** Monday 00:00 of the week containing `d`. */
export function startOfWeek(d: Date | number): Date {
  const date = startOfDay(d);
  const dow = (date.getDay() + 6) % 7; // Mon=0 … Sun=6
  date.setDate(date.getDate() - dow);
  return date;
}

export function startOfMonth(d: Date | number): Date {
  const date = startOfDay(d);
  date.setDate(1);
  return date;
}

export function addDays(d: Date, days: number): Date {
  const date = new Date(d.getTime());
  date.setDate(date.getDate() + days);
  return date;
}

export const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'] as const;
