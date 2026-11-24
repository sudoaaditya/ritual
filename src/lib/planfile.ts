/**
 * Human-writable "plan file" format, for sharing a routine or importing one
 * without wiping existing data (unlike a full backup).
 *
 * {
 *   "app": "ritual", "type": "plans", "version": 1,
 *   "plans": [{
 *     "name": "Hair care", "category": "hair", "startDate": "2026-11-20", "durationDays": 90,
 *     "items": [{
 *       "name": "Hair serum", "time": "08:00", "slot": "morning",
 *       "schedule": "daily" | { "days": ["wed","sat"] } | { "every": 2, "from": "2026-11-20" },
 *       "notes": "...", "timer": "7m", "target": 1, "unit": "glass", "startDate": "...", "endDate": "..."
 *     }],
 *     "milestones": [{ "title": "Doctor review", "date": "2026-12-20", "icon": "doctor" }]
 *   }]
 * }
 */
import { db, today, uid } from './db';
import { ICONS } from './icons';
import { slotForTime } from './progress';
import { CATEGORIES, SLOTS, type Category, type Item, type Milestone, type Plan, type Schedule, type Slot } from './types';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const isDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: unknown): s is string => typeof s === 'string' && /^\d{2}:\d{2}$/.test(s);

type FileSchedule = 'daily' | { days: string[] } | { every: number; from?: string };
interface FileItem {
  name: string;
  icon?: string;
  color?: string;
  notes?: string;
  slot?: Slot;
  time?: string;
  schedule?: FileSchedule;
  target?: number;
  unit?: string;
  timer?: number | string;
  startDate?: string;
  endDate?: string;
}
interface FilePlan {
  name: string;
  category?: Category;
  color?: string;
  icon?: string;
  startDate?: string;
  durationDays?: number;
  notes?: string;
  items?: FileItem[];
  milestones?: { title: string; date: string; icon?: string }[];
}
export interface PlanFile {
  app: 'ritual';
  type: 'plans';
  version: 1;
  plans: FilePlan[];
}

function parseTimer(t: unknown): number | undefined {
  if (typeof t === 'number') return t > 0 ? Math.round(t) : undefined;
  if (typeof t !== 'string') return undefined;
  const m = t.trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|m|min|h|hr)?$/i);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  const u = (m[2] ?? 's').toLowerCase();
  return Math.round(u.startsWith('h') ? n * 3600 : u.startsWith('m') ? n * 60 : n);
}

function parseSchedule(s: FileSchedule | undefined, fallbackAnchor: string, where: string): Schedule {
  if (!s || s === 'daily') return { kind: 'daily' };
  if (typeof s === 'object' && 'days' in s) {
    const days = s.days.map((d) => DAYS.indexOf(String(d).slice(0, 3).toLowerCase()));
    if (!days.length || days.some((d) => d < 0)) throw new Error(`${where}: "days" must be names like "mon", "thu"`);
    return { kind: 'weekdays', days: [...new Set(days)].sort() };
  }
  if (typeof s === 'object' && 'every' in s) {
    if (!(s.every >= 1)) throw new Error(`${where}: "every" must be 1 or more`);
    if (s.from && !isDate(s.from)) throw new Error(`${where}: "from" must be YYYY-MM-DD`);
    return { kind: 'interval', every: Math.round(s.every), anchor: s.from ?? fallbackAnchor };
  }
  throw new Error(`${where}: unknown schedule`);
}

/** Validate + convert. Throws a readable error on bad input. */
export function parsePlanFile(data: unknown): { plans: Plan[]; items: Item[]; milestones: Milestone[] } {
  const f = data as PlanFile;
  if (f?.app !== 'ritual' || f.type !== 'plans' || !Array.isArray(f.plans)) throw new Error('Not a Ritual plan file');
  const plans: Plan[] = [];
  const items: Item[] = [];
  const milestones: Milestone[] = [];
  f.plans.forEach((fp, pi) => {
    const where = `Plan ${pi + 1}`;
    if (!fp?.name) throw new Error(`${where}: missing "name"`);
    if (fp.startDate && !isDate(fp.startDate)) throw new Error(`${where}: startDate must be YYYY-MM-DD`);
    const cat = CATEGORIES.find((c) => c.id === fp.category) ?? CATEGORIES.find((c) => c.id === 'custom')!;
    const plan: Plan = {
      id: uid(),
      name: fp.name,
      category: cat.id,
      color: fp.color ?? cat.color,
      icon: fp.icon && ICONS[fp.icon] ? fp.icon : cat.icon,
      startDate: fp.startDate ?? today(),
      durationDays: fp.durationDays,
      notes: fp.notes,
      createdAt: Date.now() + pi,
    };
    plans.push(plan);
    (fp.items ?? []).forEach((fi, ii) => {
      const w = `${fp.name} → item ${ii + 1}${fi?.name ? ` (${fi.name})` : ''}`;
      if (!fi?.name) throw new Error(`${w}: missing "name"`);
      if (fi.time && !isTime(fi.time)) throw new Error(`${w}: time must be HH:MM (24h)`);
      if (fi.slot && !SLOTS.some((s) => s.id === fi.slot)) throw new Error(`${w}: slot must be morning/afternoon/evening/night/any`);
      for (const k of ['startDate', 'endDate'] as const) if (fi[k] && !isDate(fi[k])) throw new Error(`${w}: ${k} must be YYYY-MM-DD`);
      items.push({
        id: uid(),
        planId: plan.id,
        name: fi.name,
        icon: fi.icon && ICONS[fi.icon] ? fi.icon : 'droplet',
        color: fi.color ?? plan.color,
        notes: fi.notes,
        slot: fi.slot ?? slotForTime(fi.time),
        time: fi.time,
        schedule: parseSchedule(fi.schedule, plan.startDate, w),
        target: Math.max(1, Math.round(fi.target ?? 1)),
        unit: fi.unit,
        timer: parseTimer(fi.timer),
        startDate: fi.startDate,
        endDate: fi.endDate,
        order: Date.now() + pi * 1000 + ii,
      });
    });
    (fp.milestones ?? []).forEach((m, mi) => {
      if (!m?.title || !isDate(m.date)) throw new Error(`${fp.name} → milestone ${mi + 1}: needs "title" and "date" (YYYY-MM-DD)`);
      milestones.push({ id: uid(), planId: plan.id, title: m.title, date: m.date, icon: m.icon && ICONS[m.icon] ? m.icon : 'star' });
    });
  });
  return { plans, items, milestones };
}

/** Adds plans alongside existing ones (never deletes anything). */
export async function importPlanFile(data: unknown) {
  const { plans, items, milestones } = parsePlanFile(data);
  await db.transaction('rw', [db.plans, db.items, db.milestones], async () => {
    await db.plans.bulkAdd(plans);
    await db.items.bulkAdd(items);
    await db.milestones.bulkAdd(milestones);
  });
  return { plans: plans.length, items: items.length };
}

function toFileSchedule(s: Schedule): FileSchedule {
  if (s.kind === 'daily') return 'daily';
  if (s.kind === 'weekdays') return { days: s.days.map((d) => DAYS[d]) };
  return { every: s.every, from: s.anchor };
}

/** One plan → shareable file (no history, check-ins or photos). */
export async function exportPlanFile(planId: string): Promise<PlanFile> {
  const plan = await db.plans.get(planId);
  if (!plan) throw new Error('Plan not found');
  const [items, ms] = await Promise.all([db.items.where('planId').equals(planId).sortBy('order'), db.milestones.where('planId').equals(planId).toArray()]);
  const strip = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T;
  return {
    app: 'ritual',
    type: 'plans',
    version: 1,
    plans: [
      strip({
        name: plan.name,
        category: plan.category,
        color: plan.color,
        icon: plan.icon,
        startDate: plan.startDate,
        durationDays: plan.durationDays,
        notes: plan.notes,
        items: items
          .filter((i) => !i.archived)
          .map((i) =>
            strip({
              name: i.name,
              icon: i.icon,
              color: i.color,
              notes: i.notes,
              slot: i.slot,
              time: i.time,
              schedule: toFileSchedule(i.schedule),
              target: i.target > 1 ? i.target : undefined,
              unit: i.unit,
              timer: i.timer,
              startDate: i.startDate,
              endDate: i.endDate,
            }),
          ),
        milestones: ms.map((m) => ({ title: m.title, date: m.date, icon: m.icon })),
      }),
    ],
  };
}

/** Save/share a JSON file: native share sheet on phones when available, else download. */
export async function shareJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
