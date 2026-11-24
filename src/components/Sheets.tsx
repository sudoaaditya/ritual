import { Check, Search as SearchIcon, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addDays, parseDate } from '../lib/schedule';
import { clearLog, deleteMilestone, markDone, markSkipped, saveMilestone } from '../lib/actions';
import { logId, today, uid } from '../lib/db';
import { IconTile } from '../lib/icons';
import { fmtTime, isComplete, itemsOn, scheduleLabel } from '../lib/progress';
import { useData, useUI, type SheetState } from '../lib/store';
import type { Milestone } from '../lib/types';
import { Sheet } from './ui';
import { IconPicker, ItemEditor, PlanEditor } from './Editors';
import { RoutinePlayer } from './Routine';
import { CheckInSheet, CompareSheet, PhotoSheet } from './CheckIn';

export function SheetHost() {
  const { sheet, close } = useUI();
  if (!sheet) return null;
  return <SheetSwitch key={JSON.stringify(sheet).slice(0, 200)} sheet={sheet} close={close} />;
}

function SheetSwitch({ sheet, close }: { sheet: SheetState; close: () => void }) {
  switch (sheet.kind) {
    case 'item-edit':
      return <ItemEditor item={sheet.item} planId={sheet.planId} onClose={close} />;
    case 'item-detail':
      return <ItemDetail itemId={sheet.itemId} date={sheet.date} onClose={close} />;
    case 'plan-edit':
      return <PlanEditor plan={sheet.plan} onClose={close} />;
    case 'milestone-edit':
      return <MilestoneEditor planId={sheet.planId} milestone={sheet.milestone} onClose={close} />;
    case 'search':
      return <SearchSheet onClose={close} />;
    case 'routine':
      return <RoutinePlayer slot={sheet.slot} date={sheet.date} onClose={close} />;
    case 'checkin':
      return <CheckInSheet planId={sheet.planId} date={sheet.date} onClose={close} />;
    case 'photo':
      return <PhotoSheet photoId={sheet.photoId} onClose={close} />;
    case 'compare':
      return <CompareSheet planId={sheet.planId} onClose={close} />;
  }
}

/* ------------------------------------------------------------------ */

function ItemDetail({ itemId, date, onClose }: { itemId: string; date: string; onClose: () => void }) {
  const { allItems, plans, logs } = useData();
  const ui = useUI();
  const item = allItems.find((i) => i.id === itemId);
  if (!item) return <Sheet title="" onClose={onClose}><div className="empty">This item no longer exists.</div></Sheet>;
  const plan = plans.find((p) => p.id === item.planId);
  const log = logs.get(logId(item.id, date));
  const done = isComplete(item, log);
  const skipped = log?.status === 'skipped';
  const t = today();
  const scheduledToday = itemsOn([item], date).length > 0;

  // 5-week history ending this week
  const end = addDays(t, 6 - parseDate(t).getDay());
  const days = Array.from({ length: 35 }, (_, i) => addDays(end, -34 + i));
  let due = 0;
  let ok = 0;
  for (const d of days) {
    if (d > t || !itemsOn([item], d).length) continue;
    const l = logs.get(logId(item.id, d));
    if (l?.status === 'skipped') continue;
    due++;
    if (isComplete(item, l)) ok++;
  }

  return (
    <Sheet
      title=""
      onClose={onClose}
      right={<button className="pill-btn" onClick={() => ui.open({ kind: 'item-edit', item })}>Edit</button>}
    >
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <IconTile name={item.icon} color={item.color} size={72} />
        <h2 style={{ margin: '12px 0 4px', fontSize: 24 }}>{item.name}</h2>
        <div className="muted small">
          {plan?.name} · {scheduleLabel(item)}
          {item.time ? ` · ${fmtTime(item.time)}` : ''}
        </div>
      </div>
      {item.notes && <div className="card" style={{ marginBottom: 16, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{item.notes}</div>}

      <div className="form-label">{date === t ? 'Today' : parseDate(date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}</div>
      {scheduledToday || log ? (
        <div className="row" style={{ gap: 10, marginBottom: 20, ['--c' as string]: item.color }}>
          {done || skipped ? (
            <>
              <div className="grow card row" style={{ padding: '12px 16px' }}>
                {done ? <Check color="var(--green)" /> : null}
                <span>{done ? `Done${log && item.target > 1 ? ` (${log.count}/${item.target})` : ''}` : 'Skipped'}</span>
                {log && <span className="muted small" style={{ marginLeft: 'auto' }}>{new Date(log.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>}
              </div>
              <button className="btn secondary" onClick={() => clearLog(item.id, date)}>Undo</button>
            </>
          ) : (
            <>
              <button className="btn primary grow" style={{ background: item.color }} onClick={() => markDone(item, date, item.target === 1)}>
                {item.target > 1 ? `+1 ${item.unit ?? ''} (${log?.count ?? 0}/${item.target})` : 'Mark done'}
              </button>
              <button className="btn secondary" onClick={() => markSkipped(item, date)}>Skip</button>
            </>
          )}
        </div>
      ) : (
        <div className="card muted small" style={{ marginBottom: 20 }}>Not scheduled on this day.</div>
      )}

      <div className="form-label">Last 5 weeks · {due ? Math.round((ok / due) * 100) : 0}%</div>
      <div className="card">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, justifyItems: 'center' }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i} className="faint small">{d}</span>)}
          {days.map((d) => {
            const sch = itemsOn([item], d).length > 0;
            const l = logs.get(logId(item.id, d));
            const c = isComplete(item, l);
            const future = d > t;
            return (
              <span
                key={d}
                title={d}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  background: c ? item.color : sch && !future ? `color-mix(in srgb, ${item.color} 16%, transparent)` : 'transparent',
                  color: c ? '#fff' : sch ? 'var(--text)' : 'var(--text-3)',
                  outline: d === t ? '2px solid var(--text)' : undefined,
                  opacity: future ? 0.5 : 1,
                }}
              >
                {parseDate(d).getDate()}
              </span>
            );
          })}
        </div>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function MilestoneEditor({ planId, milestone, onClose }: { planId: string; milestone?: Milestone; onClose: () => void }) {
  const { plans } = useData();
  const plan = plans.find((p) => p.id === planId);
  const [m, setM] = useState<Milestone>(() => milestone ?? { id: uid(), planId, title: '', date: addDays(today(), 30), icon: 'star' });
  const set = (x: Partial<Milestone>) => setM((o) => ({ ...o, ...x }));
  return (
    <Sheet
      title={milestone ? 'Milestone' : 'New milestone'}
      onClose={onClose}
      left={<button className="pill-btn" onClick={onClose}>Cancel</button>}
      right={
        <button className="pill-btn" style={{ fontWeight: 700 }} disabled={!m.title.trim()} onClick={async () => { await saveMilestone({ ...m, title: m.title.trim() }); onClose(); }}>
          Save
        </button>
      }
    >
      <div className="form-group">
        <div className="field">
          <IconTile name={m.icon} color={plan?.color ?? '#0a84ff'} size={32} />
          <input className="big" type="text" placeholder="e.g. Doctor review" value={m.title} onChange={(e) => set({ title: e.target.value })} autoFocus={!milestone} />
        </div>
        <div className="field">
          <span className="grow">Date</span>
          <input type="date" value={m.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
        </div>
      </div>
      <div className="form-group">
        <IconPicker value={m.icon} color={plan?.color ?? '#0a84ff'} onChange={(icon) => set({ icon })} />
      </div>
      {milestone && (
        <button className="btn danger block" onClick={async () => { await deleteMilestone(milestone.id); onClose(); }}>
          <Trash2 size={18} /> Delete
        </button>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

function SearchSheet({ onClose }: { onClose: () => void }) {
  const { allItems, plans } = useData();
  const ui = useUI();
  const [q, setQ] = useState('');
  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const res = allItems.filter((i) => (i.name + ' ' + (i.notes ?? '') + ' ' + (planMap.get(i.planId)?.name ?? '')).toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet title="Search" onClose={onClose}>
      <div className="form-group">
        <div className="field">
          <SearchIcon size={18} className="muted" />
          <input className="big" style={{ fontSize: 17, fontWeight: 400 }} type="text" placeholder="Items, notes, plans" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
      </div>
      <div className="card flush">
        {res.slice(0, 50).map((it, idx) => (
          <div key={it.id}>
            {idx > 0 && <div className="divider" />}
            <button className="item" style={{ width: '100%', textAlign: 'left' }} onClick={() => ui.open({ kind: 'item-detail', itemId: it.id, date: today() })}>
              <IconTile name={it.icon} color={it.color} size={38} />
              <div className="grow">
                <div className="t ellipsis">{it.name}</div>
                <div className="s ellipsis">{planMap.get(it.planId)?.name} · {scheduleLabel(it)}{it.time ? ` · ${fmtTime(it.time)}` : ''}</div>
              </div>
            </button>
          </div>
        ))}
        {res.length === 0 && <div className="empty">No matches.</div>}
      </div>
    </Sheet>
  );
}
