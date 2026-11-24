import { isScheduledOn, timeToMin } from './schedule';
import { logId } from './db';
import type { Item, Log, Plan, Slot } from './types';

export type LogMap = Map<string, Log>;

export const toLogMap = (logs: Log[]): LogMap => new Map(logs.map((l) => [l.id, l]));

/** Items never start before their plan does. */
export function withPlanStart(items: Item[], plan: Plan): Item[] {
  return items.map((i) => (i.startDate && i.startDate >= plan.startDate ? i : { ...i, startDate: plan.startDate }));
}

export function activeItems(items: Item[], plans: Plan[]): Item[] {
  const live = new Map(plans.filter((p) => !p.archived).map((p) => [p.id, p]));
  return items.flatMap((i) => {
    const p = live.get(i.planId);
    return !i.archived && p ? withPlanStart([i], p) : [];
  });
}

export function itemsOn(items: Item[], date: string): Item[] {
  return items
    .filter((i) => isScheduledOn(i.schedule, date, i.startDate, i.endDate))
    .sort((a, b) => slotRank(a.slot) - slotRank(b.slot) || (a.time ?? '99').localeCompare(b.time ?? '99') || a.order - b.order);
}

const SLOT_ORDER: Slot[] = ['morning', 'afternoon', 'evening', 'night', 'any'];
export const slotRank = (s: Slot) => SLOT_ORDER.indexOf(s);

export function isComplete(item: Item, log?: Log) {
  return !!log && log.status === 'done' && log.count >= item.target;
}

/** Progress for a day: skipped items are removed from the denominator. */
export function dayProgress(items: Item[], date: string, logs: LogMap) {
  const due = itemsOn(items, date);
  let done = 0;
  let skipped = 0;
  for (const it of due) {
    const l = logs.get(logId(it.id, date));
    if (l?.status === 'skipped') skipped++;
    else if (isComplete(it, l)) done++;
  }
  const total = due.length - skipped;
  return { due: due.length, done, skipped, total, ratio: total <= 0 ? (due.length ? 1 : 0) : done / total };
}

export function streak(items: Item[], logs: LogMap, todayStr: string, addDays: (d: string, n: number) => string) {
  // Current streak: consecutive fully-complete days ending today (today counts only if complete) or yesterday.
  let d = todayStr;
  const p = dayProgress(items, d, logs);
  if (p.due === 0 || p.ratio < 1) d = addDays(d, -1);
  let n = 0;
  for (let i = 0; i < 730; i++) {
    const q = dayProgress(items, d, logs);
    if (q.due === 0) {
      d = addDays(d, -1);
      continue;
    }
    if (q.ratio < 1) break;
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export function slotForTime(t?: string): Slot {
  if (!t) return 'any';
  const m = timeToMin(t);
  if (m < 12 * 60) return 'morning';
  if (m < 17 * 60) return 'afternoon';
  if (m < 21 * 60) return 'evening';
  return 'night';
}

export function fmtTime(t?: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ap}`;
}

export function scheduleLabel(item: Item) {
  const s = item.schedule;
  if (s.kind === 'daily') return 'Every day';
  if (s.kind === 'interval') return s.every === 1 ? 'Every day' : `Every ${s.every} days`;
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (s.days.length === 7) return 'Every day';
  if (s.days.length === 5 && [1, 2, 3, 4, 5].every((x) => s.days.includes(x))) return 'Weekdays';
  if (s.days.length === 2 && s.days.includes(0) && s.days.includes(6)) return 'Weekends';
  return [...s.days].sort().map((x) => names[x]).join(', ');
}
