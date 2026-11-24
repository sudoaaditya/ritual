import { Archive, Check, ChevronDown, ChevronLeft, ChevronRight, List, Plus } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { addDays, daysBetween, parseDate, weekday } from '../lib/schedule';
import { Ring } from '../components/ui';
import { PlanPhotos } from '../components/CheckIn';
import { saveMilestone } from '../lib/actions';
import { logId, today } from '../lib/db';
import { IconTile } from '../lib/icons';
import { dayProgress, fmtTime, isComplete, itemsOn, scheduleLabel, withPlanStart } from '../lib/progress';
import { useData, useUI } from '../lib/store';
import { CATEGORIES, SLOTS, type Item, type Plan } from '../lib/types';
import type { LogMap } from '../lib/progress';

export function Plans() {
  const data = useData();
  const ui = useUI();
  const [menu, setMenu] = useState(false);
  const [listMode, setListMode] = useState(false);
  const active = data.plans.filter((p) => !p.archived);
  const plan = data.plans.find((p) => p.id === ui.planId) ?? active[0] ?? data.plans[0];

  if (!plan || listMode) return <AllPlans onPick={(p) => { ui.setPlanId(p.id); setListMode(false); }} />;

  return (
    <div className="screen">
      <div className="topbar" style={{ position: 'relative' }}>
        <button className="row" style={{ gap: 6, textAlign: 'left' }} onClick={() => setMenu((m) => !m)}>
          <div>
            <div className="row" style={{ gap: 6, fontWeight: 700, fontSize: 18 }}>
              {plan.name}
              <span className="glass" style={{ width: 22, height: 22, borderRadius: 11, display: 'grid', placeItems: 'center' }}>
                <ChevronDown size={14} />
              </span>
            </div>
            <PlanSubtitle plan={plan} />
          </div>
        </button>
        <span className="spacer" />
        <button className="pill-btn glass" onClick={() => ui.open({ kind: 'plan-edit', plan })}>
          Edit
        </button>
        {menu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 59 }} onClick={() => setMenu(false)} />
            <div className="menu glass">
              {active.map((p) => (
                <button key={p.id} onClick={() => { ui.setPlanId(p.id); setMenu(false); }}>
                  <span style={{ width: 20, color: 'var(--accent)' }}>{p.id === plan.id && <Check size={18} />}</span>
                  <IconTile name={p.icon} color={p.color} size={26} />
                  {p.name}
                </button>
              ))}
              <hr />
              <button onClick={() => { setListMode(true); setMenu(false); }}>
                <List size={20} color="var(--accent)" /> All plans
              </button>
              <button onClick={() => { ui.open({ kind: 'plan-edit' }); setMenu(false); }}>
                <Plus size={20} color="var(--accent)" /> New plan
              </button>
            </div>
          </>
        )}
      </div>
      <PlanDetail plan={plan} data={data} />
    </div>
  );
}

function PlanSubtitle({ plan }: { plan: Plan }) {
  const t = today();
  const day = daysBetween(plan.startDate, t) + 1;
  const parts: string[] = [];
  if (day < 1) parts.push(`Starts ${parseDate(plan.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`);
  else if (plan.durationDays) parts.push(`Day ${Math.min(day, plan.durationDays)} of ${plan.durationDays}`);
  else parts.push(`Day ${day}`);
  if (plan.archived) parts.push('archived');
  return <div className="muted small">{parts.join(' · ')}</div>;
}

function PlanDetail({ plan, data }: { plan: Plan; data: ReturnType<typeof useData> }) {
  const ui = useUI();
  const [view, setView] = useState<'week' | 'months'>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const rawItems = data.allItems.filter((i) => i.planId === plan.id && !i.archived);
  const items = withPlanStart(rawItems, plan);
  const milestones = data.milestones.filter((m) => m.planId === plan.id);
  const t = today();
  const day = Math.max(0, daysBetween(plan.startDate, t) + 1);
  const progress = plan.durationDays ? Math.min(1, day / plan.durationDays) : undefined;

  // adherence last 30 days for this plan
  let done = 0;
  let total = 0;
  for (let i = 0; i < 30; i++) {
    const d = addDays(t, -i);
    if (d < plan.startDate) break;
    const p = dayProgress(items, d, data.logs);
    done += p.done;
    total += p.total;
  }
  const adherence = total ? done / total : 0;

  return (
    <>
      <div className="plan-hero card" style={{ ['--c' as string]: plan.color, marginTop: 8 }}>
        <div className="row">
          <Ring value={adherence} size={64} stroke={7} color={plan.color} track={`color-mix(in srgb, ${plan.color} 20%, transparent)`} />
          <div className="grow">
            <div style={{ fontSize: 26, fontWeight: 800 }} className="num">{Math.round(adherence * 100)}%</div>
            <div className="muted small">adherence · last 30 days</div>
          </div>
          <IconTile name={plan.icon} color={plan.color} size={44} />
        </div>
        {progress !== undefined && (
          <>
            <div className="bar">
              <i style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="row muted small" style={{ marginTop: 6 }}>
              <span className="grow">Started {parseDate(plan.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
              <span>{Math.max(0, plan.durationDays! - day)} days left</span>
            </div>
          </>
        )}
      </div>

      <div className="section-label" style={{ alignItems: 'center' }}>
        <span style={{ fontSize: 20, color: 'var(--text)', fontWeight: 700 }}>Schedule</span>
        <div className="seg">
          <button className={view === 'week' ? 'on' : ''} onClick={() => setView('week')}>Week</button>
          <button className={view === 'months' ? 'on' : ''} onClick={() => setView('months')}>Months</button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="card empty">
          <p>No items yet.</p>
          <button className="btn primary" onClick={() => ui.open({ kind: 'item-edit', planId: plan.id })}>
            <Plus size={18} /> Add item
          </button>
        </div>
      ) : view === 'week' ? (
        <WeekGrid items={items} logs={data.logs} offset={weekOffset} setOffset={setWeekOffset} />
      ) : (
        <MonthsHeat items={items} logs={data.logs} color={plan.color} start={plan.startDate} />
      )}

      <PlanPhotos plan={plan} />

      <div className="section-label">
        <span>Items</span>
        <button className="pill-btn" style={{ height: 28, fontSize: 15, padding: 0 }} onClick={() => ui.open({ kind: 'item-edit', planId: plan.id })}>
          <Plus size={16} /> Add
        </button>
      </div>
      {items.length > 0 && (
        <div className="card flush">
          {rawItems.map((it, idx) => (
            <Fragment key={it.id}>
              {idx > 0 && <div className="divider" />}
              <button className="item" style={{ width: '100%', textAlign: 'left' }} onClick={() => ui.open({ kind: 'item-edit', item: it })}>
                <IconTile name={it.icon} color={it.color} size={42} />
                <div className="grow">
                  <div className="t ellipsis">{it.name}</div>
                  <div className="s ellipsis">
                    {scheduleLabel(it)}
                    {it.time ? ` · ${fmtTime(it.time)}` : ''}
                    {it.target > 1 ? ` · ${it.target}× ${it.unit ?? ''}` : ''}
                  </div>
                </div>
                <ChevronRight size={18} className="faint" />
              </button>
            </Fragment>
          ))}
        </div>
      )}

      <div className="section-label">
        <span>Milestones</span>
        <button className="pill-btn" style={{ height: 28, fontSize: 15, padding: 0 }} onClick={() => ui.open({ kind: 'milestone-edit', planId: plan.id })}>
          <Plus size={16} /> Add
        </button>
      </div>
      {milestones.length === 0 ? (
        <div className="card muted small">Add check-ins like “Replace derma stamp” or “Doctor review”.</div>
      ) : (
        <div className="card flush">
          {milestones.map((m, idx) => {
            const n = daysBetween(t, m.date);
            return (
              <Fragment key={m.id}>
                {idx > 0 && <div className="divider" />}
                <div className="item">
                  <button className="row grow" style={{ textAlign: 'left', gap: 14 }} onClick={() => ui.open({ kind: 'milestone-edit', planId: plan.id, milestone: m })}>
                    <IconTile name={m.icon} color={m.done ? '#8e8e93' : plan.color} size={42} />
                    <div className="grow">
                      <div className="t" style={{ textDecoration: m.done ? 'line-through' : undefined }}>{m.title}</div>
                      <div className="s">
                        {parseDate(m.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                        {!m.done && (n >= 0 ? (n === 0 ? ' · today' : ` · in ${n} days`) : ' · overdue')}
                      </div>
                    </div>
                  </button>
                  <button className={`check ${m.done ? 'on' : ''}`} style={{ ['--c' as string]: plan.color }} onClick={() => saveMilestone({ ...m, done: !m.done })} aria-label="Toggle milestone">
                    {m.done && <Check size={18} strokeWidth={3} />}
                  </button>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}
      {plan.notes && (
        <>
          <div className="section-label">Notes</div>
          <div className="card" style={{ whiteSpace: 'pre-wrap' }}>{plan.notes}</div>
        </>
      )}
    </>
  );
}

function WeekGrid({ items, logs, offset, setOffset }: { items: Item[]; logs: LogMap; offset: number; setOffset: (n: number) => void }) {
  const t = today();
  const base = addDays(t, offset * 7);
  const start = addDays(base, -((weekday(base) + 6) % 7)); // Monday
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const label = offset === 0 ? 'This week' : offset === -1 ? 'Last week' : offset === 1 ? 'Next week' : `${parseDate(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
  const todayIdx = days.indexOf(t);

  return (
    <div className="card" style={{ padding: 16, position: 'relative' }}>
      <div className="row" style={{ marginBottom: 12 }}>
        <div className="grow" style={{ fontWeight: 700, fontSize: 17 }}>{label}</div>
        <button className="nav-btn glass" onClick={() => setOffset(offset - 1)} aria-label="Previous week"><ChevronLeft size={18} /></button>
        <button className="nav-btn glass" onClick={() => setOffset(offset + 1)} aria-label="Next week"><ChevronRight size={18} /></button>
      </div>
      <div className="grid-week">
        <div />
        {days.map((d, i) => (
          <div className={`h ${i === todayIdx ? 'today-col' : ''}`} key={d} style={{ borderRadius: '14px 14px 0 0', paddingTop: 4 }}>
            {'MTWTFSS'[i]}
            <b className={`num ${d === t ? 'today' : ''}`}>{parseDate(d).getDate()}</b>
          </div>
        ))}
        {SLOTS.map((s) => {
          const list = items.filter((i) => i.slot === s.id);
          if (!list.length) return null;
          return (
            <Fragment key={s.id}>
              <div className="slot-h">{s.label}</div>
              {list.map((it) => (
                <Fragment key={it.id}>
                  <div className="lbl">
                    <IconTile name={it.icon} color={it.color} size={26} />
                    <span className="ellipsis">{it.name}</span>
                  </div>
                  {days.map((d, i) => {
                    const dueToday = itemsOn([it], d).length > 0;
                    const l = logs.get(logId(it.id, d));
                    const cls = !dueToday ? '' : isComplete(it, l) ? 'due done' : d < t ? 'due missed' : 'due';
                    return (
                      <div key={d} className={`cell ${i === todayIdx ? 'today-col' : ''}`} style={{ ['--c' as string]: it.color }}>
                        <i className={cls} />
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </Fragment>
          );
        })}
      </div>
      <div className="row faint small" style={{ marginTop: 12, gap: 14, justifyContent: 'center' }}>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--text-2)' }} /> done</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 6, border: '2px solid var(--text-2)' }} /> due</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 12, borderRadius: 6, background: 'var(--text-2)', opacity: 0.25 }} /> missed</span>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--text-3)' }} /> rest</span>
      </div>
    </div>
  );
}

function MonthsHeat({ items, logs, color, start }: { items: Item[]; logs: LogMap; color: string; start: string }) {
  const t = today();
  const weeks = 18;
  const end = addDays(t, 6 - weekday(t));
  const first = addDays(end, -(weeks * 7 - 1));
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(first, i));
  const months = useMemo(() => {
    const out: { label: string; col: number }[] = [];
    let last = '';
    cells.forEach((d, i) => {
      const m = d.slice(0, 7);
      if (m !== last && i % 7 === 0) {
        out.push({ label: parseDate(d).toLocaleDateString(undefined, { month: 'short' }), col: i / 7 });
        last = m;
      }
    });
    return out;
  }, [first]);

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ position: 'relative', height: 16, marginBottom: 6 }}>
        {months.map((m) => (
          <span key={m.col} className="faint small" style={{ position: 'absolute', left: `${(m.col / weeks) * 100}%` }}>{m.label}</span>
        ))}
      </div>
      <div className="heat" style={{ gridTemplateColumns: `repeat(${weeks}, 1fr)` }}>
        {cells.map((d) => {
          const p = dayProgress(items, d, logs);
          const future = d > t;
          const before = d < start;
          const op = future || before || p.due === 0 ? 0 : 0.18 + p.ratio * 0.82;
          return (
            <i
              key={d}
              title={`${d}: ${p.done}/${p.total}`}
              style={{ background: op ? color : undefined, opacity: op ? op : future ? 0.35 : 1, outline: d === t ? '2px solid var(--text)' : undefined }}
            />
          );
        })}
      </div>
      <div className="row faint small" style={{ marginTop: 10, justifyContent: 'flex-end', gap: 4 }}>
        less {[0.2, 0.45, 0.7, 1].map((o) => <i key={o} style={{ width: 12, height: 12, borderRadius: 3, background: color, opacity: o }} />)} more
      </div>
    </div>
  );
}

function AllPlans({ onPick }: { onPick: (p: Plan) => void }) {
  const { plans, allItems, logs } = useData();
  const ui = useUI();
  const t = today();
  return (
    <div className="screen">
      <div className="topbar">
        <button className="pill-btn icon glass" aria-label="New plan" onClick={() => ui.open({ kind: 'plan-edit' })}>
          <Plus size={22} />
        </button>
      </div>
      <div className="large-title">Plans</div>
      <div className="subtitle">{plans.length ? `${plans.filter((p) => !p.archived).length} active` : 'Create a plan for skin, hair, diet — anything.'}</div>
      <div className="stack">
        {plans.map((p) => {
          const its = allItems.filter((i) => i.planId === p.id && !i.archived);
          const pr = dayProgress(its, t, logs);
          const cat = CATEGORIES.find((c) => c.id === p.category);
          return (
            <button key={p.id} className="plan-card press" style={{ ['--c' as string]: p.color, opacity: p.archived ? 0.55 : 1 }} onClick={() => onPick(p)}>
              <IconTile name={p.icon} color={p.color} size={50} />
              <div className="grow">
                <div style={{ fontWeight: 700, fontSize: 18 }}>{p.name}</div>
                <div className="muted small">
                  {cat?.label} · {its.length} items {p.archived && <><Archive size={12} /> archived</>}
                </div>
              </div>
              <Ring value={pr.ratio} size={44} stroke={5} color={p.color} track={`color-mix(in srgb, ${p.color} 20%, transparent)`} />
            </button>
          );
        })}
        <button className="plan-card press" style={{ ['--c' as string]: 'var(--accent)', justifyContent: 'center', color: 'var(--accent)', fontWeight: 600 }} onClick={() => ui.open({ kind: 'plan-edit' })}>
          <Plus size={20} /> New plan
        </button>
      </div>
    </div>
  );
}
