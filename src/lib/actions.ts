import { db, logId, uid } from './db';
import type { CheckIn, Item, Log, Milestone, Photo, Plan } from './types';
import { addDays } from './schedule';
import { milestonesFor, type Template } from './templates';

export async function savePlan(p: Plan) {
  await db.plans.put(p);
}

export async function deletePlan(planId: string) {
  await db.transaction('rw', [db.plans, db.items, db.logs, db.milestones, db.checkins, db.photos], async () => {
    await db.checkins.where('planId').equals(planId).delete();
    await db.photos.where('planId').equals(planId).delete();
    await db.items.where('planId').equals(planId).delete();
    await db.logs.where('planId').equals(planId).delete();
    await db.milestones.where('planId').equals(planId).delete();
    await db.plans.delete(planId);
  });
}

export async function saveItem(it: Item) {
  await db.items.put(it);
}

export async function deleteItem(itemId: string) {
  await db.transaction('rw', [db.items, db.logs], async () => {
    await db.logs.where('itemId').equals(itemId).delete();
    await db.items.delete(itemId);
  });
}

export async function saveMilestone(m: Milestone) {
  await db.milestones.put(m);
}
export async function deleteMilestone(id: string) {
  await db.milestones.delete(id);
}

/** Mark done. For multi-count items each call adds one; reaching target = done. */
export async function markDone(item: Item, date: string, full = false) {
  const id = logId(item.id, date);
  const cur = await db.logs.get(id);
  const prev = cur?.status === 'done' || !cur ? cur?.count ?? 0 : 0;
  const count = full ? item.target : Math.min(item.target, prev + 1);
  const log: Log = { id, itemId: item.id, planId: item.planId, date, status: 'done', count, at: Date.now() };
  await db.logs.put(log);
  vibrate();
}

export async function decrement(item: Item, date: string) {
  const id = logId(item.id, date);
  const cur = await db.logs.get(id);
  if (!cur) return;
  if (cur.count <= 1) await db.logs.delete(id);
  else await db.logs.put({ ...cur, count: cur.count - 1, at: Date.now() });
}

export async function markSkipped(item: Item, date: string) {
  const id = logId(item.id, date);
  await db.logs.put({ id, itemId: item.id, planId: item.planId, date, status: 'skipped', count: 0, at: Date.now() });
}

export async function clearLog(itemId: string, date: string) {
  await db.logs.delete(logId(itemId, date));
}

export function vibrate(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* noop */
  }
}

export function newItem(planId: string, partial: Partial<Item> = {}): Item {
  return {
    id: uid(),
    planId,
    name: '',
    icon: 'droplet',
    color: '#0a84ff',
    slot: 'morning',
    time: '08:00',
    schedule: { kind: 'daily' },
    target: 1,
    order: Date.now(),
    ...partial,
  };
}

/** Create a plan from a template, optionally keeping only some of its items (by index). */
export async function createFromTemplate(tpl: Template, plan: Plan, keep?: Set<number>) {
  await db.plans.put(plan);
  const items: Item[] = tpl.items
    .map((ti, i) => ({ ti, i }))
    .filter(({ i }) => !keep || keep.has(i))
    .map(({ ti, i }) => ({
      ...ti,
      id: uid(),
      planId: plan.id,
      order: Date.now() + i,
      schedule: ti.schedule.kind === 'interval' ? { ...ti.schedule, anchor: plan.startDate } : ti.schedule,
    }));
  await db.items.bulkPut(items);
  await db.milestones.bulkPut(milestonesFor(tpl, plan.id, plan.startDate, addDays, uid));
}

/** Snapshot an item's log for a day; returns a function that restores it (for Undo). */
export async function snapshotLog(itemId: string, date: string) {
  const id = logId(itemId, date);
  const prev = await db.logs.get(id);
  return async () => {
    if (prev) await db.logs.put(prev);
    else await db.logs.delete(id);
  };
}

/* ---------- check-ins ---------- */
export const checkinId = (planId: string, date: string) => `${planId}|${date}`;

export async function saveCheckIn(planId: string, date: string, patch: Partial<CheckIn>) {
  const id = checkinId(planId, date);
  const cur = await db.checkins.get(id);
  await db.checkins.put({ id, planId, date, flags: [], ...cur, ...patch, at: Date.now() });
}

/* ---------- photos ---------- */
/** Downscale to keep IndexedDB small (≈150–300 KB per photo). */
export async function resizeImage(file: Blob, max = 1440, quality = 0.82): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', quality));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function addPhoto(planId: string, date: string, file: Blob) {
  const blob = await resizeImage(file);
  const p: Photo = { id: uid(), planId, date, blob, createdAt: Date.now() };
  await db.photos.put(p);
  return p;
}

export async function deletePhoto(id: string) {
  await db.photos.delete(id);
}

/* ---------- backup ---------- */
const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(b);
  });

export async function exportData() {
  const [plans, items, logs, milestones, checkins, photos] = await Promise.all([
    db.plans.toArray(),
    db.items.toArray(),
    db.logs.toArray(),
    db.milestones.toArray(),
    db.checkins.toArray(),
    db.photos.toArray(),
  ]);
  const photoData = await Promise.all(photos.map(async ({ blob, ...p }) => ({ ...p, data: await blobToDataUrl(blob) })));
  return { app: 'ritual', version: 2, exportedAt: new Date().toISOString(), plans, items, logs, milestones, checkins, photos: photoData };
}

type Backup = Awaited<ReturnType<typeof exportData>>;
const ALL = () => [db.plans, db.items, db.logs, db.milestones, db.checkins, db.photos];

export async function importData(data: Backup) {
  if (data?.app !== 'ritual') throw new Error('Not a Rituals backup file');
  const photos: Photo[] = await Promise.all(
    (data.photos ?? []).map(async ({ data: d, ...p }) => ({ ...p, blob: await (await fetch(d)).blob() })),
  );
  await db.transaction('rw', ALL(), async () => {
    await Promise.all(ALL().map((t) => t.clear()));
    await db.plans.bulkPut(data.plans);
    await db.items.bulkPut(data.items);
    await db.logs.bulkPut(data.logs);
    await db.milestones.bulkPut(data.milestones);
    await db.checkins.bulkPut(data.checkins ?? []);
    await db.photos.bulkPut(photos);
  });
}

export async function resetAll() {
  await db.transaction('rw', ALL(), async () => {
    await Promise.all(ALL().map((t) => t.clear()));
  });
}
