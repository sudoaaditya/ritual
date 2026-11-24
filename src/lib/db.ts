import Dexie, { type Table } from 'dexie';
import type { CheckIn, Item, Log, Milestone, Photo, Plan } from './types';
import { fmtDate } from './schedule';

export interface Meta {
  key: string;
  value: unknown;
}

class RitualDB extends Dexie {
  plans!: Table<Plan, string>;
  items!: Table<Item, string>;
  logs!: Table<Log, string>;
  milestones!: Table<Milestone, string>;
  meta!: Table<Meta, string>;
  checkins!: Table<CheckIn, string>;
  photos!: Table<Photo, string>;

  constructor() {
    super('ritual');
    this.version(1).stores({
      plans: 'id, category, createdAt',
      items: 'id, planId, order',
      logs: 'id, itemId, planId, date, [itemId+date]',
      milestones: 'id, planId, date',
      meta: 'key',
    });
    this.version(2).stores({
      checkins: 'id, planId, date',
      photos: 'id, planId, date',
    });
  }
}

export const db = new RitualDB();

export const uid = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const today = () => fmtDate(new Date());
export const logId = (itemId: string, date: string) => `${itemId}|${date}`;

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}
export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

export async function getDeviceId(): Promise<string> {
  let id = await getMeta<string>('deviceId');
  if (!id) {
    id = uid();
    await setMeta('deviceId', id);
  }
  return id;
}
