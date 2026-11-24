import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { db, today } from './db';
import { activeItems, toLogMap, type LogMap } from './progress';
import type { CheckIn, Item, Milestone, Plan, Slot } from './types';

export interface Data {
  ready: boolean;
  plans: Plan[];
  allItems: Item[];
  items: Item[]; // active items of active plans
  logs: LogMap;
  milestones: Milestone[];
  checkins: Map<string, CheckIn>;
}

export function useData(): Data {
  const res = useLiveQuery(async () => {
    const [plans, items, logs, milestones, checkins] = await Promise.all([
      db.plans.orderBy('createdAt').toArray(),
      db.items.orderBy('order').toArray(),
      db.logs.toArray(),
      db.milestones.orderBy('date').toArray(),
      db.checkins.toArray(),
    ]);
    return { plans, items, logs, milestones, checkins };
  });
  return useMemo(
    () => ({
      ready: !!res,
      plans: res?.plans ?? [],
      allItems: res?.items ?? [],
      items: activeItems(res?.items ?? [], res?.plans ?? []),
      logs: toLogMap(res?.logs ?? []),
      milestones: res?.milestones ?? [],
      checkins: new Map((res?.checkins ?? []).map((c) => [c.id, c])),
    }),
    [res],
  );
}

export type Tab = 'today' | 'calendar' | 'plans' | 'insights' | 'settings';
export type SheetState =
  | { kind: 'item-edit'; item?: Item; planId?: string }
  | { kind: 'item-detail'; itemId: string; date: string }
  | { kind: 'plan-edit'; plan?: Plan }
  | { kind: 'milestone-edit'; planId: string; milestone?: Milestone }
  | { kind: 'search' }
  | { kind: 'routine'; slot: Slot; date: string }
  | { kind: 'checkin'; planId: string; date: string }
  | { kind: 'photo'; photoId: string }
  | { kind: 'compare'; planId: string };

export interface Toast {
  msg: string;
  action?: { label: string; run: () => void };
}

interface UI {
  tab: Tab;
  setTab: (t: Tab) => void;
  date: string;
  setDate: (d: string) => void;
  planId?: string;
  setPlanId: (id?: string) => void;
  sheet?: SheetState;
  open: (s: SheetState) => void;
  close: () => void;
  toast: (msg: string, action?: Toast['action']) => void;
  toastMsg?: Toast;
  dismissToast: () => void;
  filter: string; // plan id or 'all'
  setFilter: (f: string) => void;
}

const Ctx = createContext<UI>(null!);
export const useUI = () => useContext(Ctx);

export function UIProvider({ children }: { children: ReactNode }) {
  const [tab, setTabRaw] = useState<Tab>('today');
  const [date, setDate] = useState(today());
  const [planId, setPlanId] = useState<string>();
  const [sheet, setSheet] = useState<SheetState>();
  const [toastMsg, setToast] = useState<Toast>();
  const [filter, setFilter] = useState('all');
  const toast = useCallback((msg: string, action?: Toast['action']) => {
    const t: Toast = { msg, action };
    setToast(t);
    window.setTimeout(() => setToast((cur) => (cur === t ? undefined : cur)), action ? 4500 : 2200);
  }, []);
  const dismissToast = useCallback(() => setToast(undefined), []);
  const setTab = useCallback((t: Tab) => {
    setTabRaw(t);
    window.scrollTo({ top: 0 });
  }, []);
  const value = useMemo<UI>(
    () => ({ tab, setTab, date, setDate, planId, setPlanId, sheet, open: setSheet, close: () => setSheet(undefined), toast, toastMsg, dismissToast, filter, setFilter }),
    [tab, setTab, date, planId, sheet, toast, toastMsg, dismissToast, filter],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
