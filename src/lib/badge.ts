import { liveQuery } from 'dexie';
import { db, today } from './db';
import { activeItems, dayProgress, toLogMap } from './progress';

/** Best-effort app-icon badge with the number of items left today (installed PWAs that support it). */
export function startBadge() {
  const nav = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> };
  if (!nav.setAppBadge) return;
  const update = async () => {
    const [plans, items, logs] = await Promise.all([db.plans.toArray(), db.items.toArray(), db.logs.where('date').equals(today()).toArray()]);
    const p = dayProgress(activeItems(items, plans), today(), toLogMap(logs));
    const left = Math.max(0, p.total - p.done);
    try {
      if (left) await nav.setAppBadge!(left);
      else await nav.clearAppBadge?.();
    } catch {
      /* not allowed on this platform */
    }
  };
  liveQuery(() => db.logs.count().then(() => db.items.count())).subscribe(() => update());
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && update());
}
