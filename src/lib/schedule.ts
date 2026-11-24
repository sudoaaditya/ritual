// Dates are local calendar dates as 'YYYY-MM-DD'; times are 'HH:MM'.

export type Schedule =
  | { kind: 'daily' }
  | { kind: 'weekdays'; days: number[] } // 0 = Sunday
  | { kind: 'interval'; every: number; anchor: string }; // every N days counting from anchor

export function parseDate(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day, 12); // noon avoids DST edge cases
}

export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d: string, n: number): string {
  const x = parseDate(d);
  x.setDate(x.getDate() + n);
  return fmtDate(x);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86400000);
}

export function weekday(d: string): number {
  return parseDate(d).getDay();
}

export function isScheduledOn(
  s: Schedule,
  date: string,
  startDate?: string,
  endDate?: string,
): boolean {
  if (startDate && date < startDate) return false;
  if (endDate && date > endDate) return false;
  switch (s.kind) {
    case 'daily':
      return true;
    case 'weekdays':
      return s.days.includes(weekday(date));
    case 'interval': {
      const diff = daysBetween(s.anchor, date);
      return diff >= 0 && diff % Math.max(1, s.every) === 0;
    }
  }
}

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
