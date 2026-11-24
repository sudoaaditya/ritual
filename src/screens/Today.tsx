import { AlarmClock, CalendarClock, ChevronLeft, ChevronRight, Flame, PartyPopper, Play, Plus, Sparkles, X } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { CheckInCard } from '../components/CheckIn';
import { ItemRow, fmtDuration } from '../components/ItemRow';
import { DayRing } from '../components/ui';
import { getMeta, logId, setMeta, today } from '../lib/db';
import { confetti, swipeHandlers, useItemActions } from '../lib/feedback';
import { IconTile } from '../lib/icons';
import { dayProgress, fmtTime, isComplete, itemsOn, streak } from '../lib/progress';
import { addDays, daysBetween, parseDate, timeToMin, weekday } from '../lib/schedule';
import { useData, useUI } from '../lib/store';
import { SLOTS, type Item } from '../lib/types';
import { Welcome } from './Welcome';

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const nowMin = () => new Date().getHours() * 60 + new Date().getMinutes();

export function dayTitle(date: string) {
  const diff = daysBetween(today(), date);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return parseDate(date).toLocaleDateString(undefined, { weekday: 'long' });
}

export function nextPending(items: Item[], date: string, logs: ReturnType<typeof useData>['logs']) {
  const pending = itemsOn(items, date).filter((i) => !logs.get(logId(i.id, date)));
  if (date !== today()) return pending[0];
  const now = nowMin();
  // Prefer the next timed item that's due soon or just passed, else first pending.
  const timed = pending.filter((i) => i.time).sort((a, b) => timeToMin(a.time!) - timeToMin(b.time!));
  return timed.find((i) => timeToMin(i.time!) >= now - 90) ?? timed[0] ?? pending[0];
}

const STREAK_MARKS = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

export function Today() {
  const { plans, items, logs, milestones, ready } = useData();
  const ui = useUI();
  const { date, setDate, filter, setFilter } = ui;
  const t = today();
  const [hint, setHint] = useState(false);
  useEffect(() => {
    getMeta<boolean>('hint-swipe').then((seen) => setHint(!seen));
  }, []);

  const shown = useMemo(() => (filter === 'all' ? items : items.filter((i) => i.planId === filter)), [items, filter]);
  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);
  const due = itemsOn(shown, date);
  const prog = dayProgress(shown, date, logs);
  const next = nextPending(shown, date, logs);
  const weekStart = addDays(date, -weekday(date));
  const upcoming = milestones.filter((m) => !m.done && m.date >= t && daysBetween(t, m.date) <= 14 && planMap.has(m.planId));
  const curStreak = useMemo(() => streak(items, logs, t, addDays), [items, logs, t]);

  // Celebrate the moment the day becomes complete (not on load).
  const prevRatio = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const was = prevRatio.current;
    prevRatio.current = prog.ratio;
    if (was !== null && was < 1 && prog.ratio >= 1 && prog.due > 0 && date === t) confetti();
  }, [prog.ratio, prog.due, ready, date, t]);

  const weekSwipe = swipeHandlers(
    () => setDate(addDays(date, 7)),
    () => setDate(addDays(date, -7)),
  );

  if (!ready) return <div className="screen" />;
  if (plans.length === 0) return <Welcome />;

  const activePlans = plans.filter((p) => !p.archived);
  const heroItem = next && !logs.get(logId(next.id, date)) ? next : undefined;
  const isPending = (i: Item) => !logs.get(logId(i.id, date));
  const overdue =
    date === t ? due.filter((i) => i.id !== heroItem?.id && isPending(i) && i.time && timeToMin(i.time) < nowMin()) : [];
  const overdueIds = new Set(overdue.map((i) => i.id));
  const row = (it: Item, isOverdue = false) => (
    <ItemRow
      item={it}
      plan={planMap.get(it.planId)}
      date={date}
      log={logs.get(logId(it.id, date))}
      showPlan={filter === 'all' && activePlans.length > 1}
      overdue={isOverdue}
      onOpen={() => ui.open({ kind: 'item-detail', itemId: it.id, date })}
    />
  );

  return (
    <div className="screen">
      <div className="topbar">
        <button
          className="pill-btn icon glass"
          aria-label="Add item"
          onClick={() => ui.open({ kind: 'item-edit', planId: filter !== 'all' ? filter : activePlans[0]?.id })}
        >
          <Plus size={22} />
        </button>
      </div>
      <div className="large-title">{dayTitle(date)}</div>
      <div className="subtitle">
        {parseDate(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} · {prog.done} of {prog.total} done
        {curStreak > 1 && date === t && (
          <span className="streak-pill">
            <Flame size={13} /> {curStreak}
          </span>
        )}
        {date !== t && (
          <>
            {' · '}
            <button style={{ color: 'var(--accent)', fontWeight: 600 }} onClick={() => setDate(t)}>
              Back to today
            </button>
          </>
        )}
      </div>

      {activePlans.length > 1 && (
        <div className="chips" style={{ marginBottom: 12 }}>
          <button className={`chip ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>
            All
          </button>
          {activePlans.map((p) => (
            <button key={p.id} className={`chip ${filter === p.id ? 'on' : ''}`} style={{ ['--c' as string]: p.color }} onClick={() => setFilter(p.id)}>
              <span className="dot" />
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="card" style={{ padding: '4px 4px', touchAction: 'pan-y' }} {...weekSwipe}>
        <div className="row" style={{ gap: 0 }}>
          <button className="nav-btn" aria-label="Previous week" onClick={() => setDate(addDays(date, -7))}>
            <ChevronLeft size={18} />
          </button>
          <div className="week grow" style={{ padding: '10px 0' }}>
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(weekStart, i);
              const p = dayProgress(shown, d, logs);
              return (
                <div className="d" key={d}>
                  {WD[i]}
                  <DayRing day={parseDate(d).getDate()} ratio={p.ratio} due={p.due > 0} selected={d === date} future={d > t} onClick={() => setDate(d)} size={38} />
                </div>
              );
            })}
          </div>
          <button className="nav-btn" aria-label="Next week" onClick={() => setDate(addDays(date, 7))}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {due.length === 0 ? (
        <div className="empty">
          <Sparkles size={34} />
          <h3>Nothing scheduled</h3>
          <p>A free day. Enjoy it.</p>
        </div>
      ) : heroItem ? (
        <>
          <div className="section-label">{date === t ? 'Next' : 'Up first'}</div>
          <HeroCard item={heroItem} planName={planMap.get(heroItem.planId)?.name} date={date} />
        </>
      ) : prog.ratio >= 1 ? (
        <>
          <div className="section-label">&nbsp;</div>
          <div className="hero done-hero" style={{ ['--c' as string]: 'var(--green)' }}>
            <PartyPopper size={40} color="var(--green)" />
            <h3>All done{date === t ? ' for today' : ''}!</h3>
            <p>
              {prog.done} of {prog.total} complete.{' '}
              {date === t && curStreak > 1
                ? STREAK_MARKS.includes(curStreak)
                  ? `🔥 ${curStreak}-day streak — a new milestone!`
                  : `🔥 ${curStreak} days in a row.`
                : 'Consistency is the whole game.'}
            </p>
          </div>
        </>
      ) : null}

      {hint && due.length > 1 && (
        <div className="hint">
          <span className="grow">
            Tip: <b>swipe right</b> on an item to complete it, <b>left</b> to skip. Tap <Play size={11} style={{ verticalAlign: -1 }} /> Start for a guided routine.
          </span>
          <button aria-label="Dismiss tip" onClick={() => { setHint(false); setMeta('hint-swipe', true); }}>
            <X size={16} />
          </button>
        </div>
      )}

      {overdue.length > 0 && (
        <>
          <div className="section-label" style={{ color: 'var(--red)' }}>
            <span>Overdue</span>
            <small className="num">{overdue.length}</small>
          </div>
          <div className="card flush overdue-card">
            {overdue.map((it, idx) => (
              <Fragment key={it.id}>
                {idx > 0 && <div className="divider" />}
                {row(it, true)}
              </Fragment>
            ))}
          </div>
        </>
      )}

      {SLOTS.map((slot) => {
        const all = due.filter((i) => i.slot === slot.id);
        const list = all.filter((i) => i.id !== heroItem?.id && !overdueIds.has(i.id));
        if (!list.length) return null;
        const doneN = all.filter((i) => isComplete(i, logs.get(logId(i.id, date)))).length;
        const pendingN = all.filter(isPending).length;
        return (
          <Fragment key={slot.id}>
            <div className="section-label">
              <span>{slot.label}</span>
              <span className="row" style={{ gap: 10 }}>
                <small className="num">
                  {doneN}/{all.length}
                </small>
                {pendingN > 1 && (
                  <button className="start-btn" onClick={() => ui.open({ kind: 'routine', slot: slot.id, date })}>
                    <Play size={12} fill="currentColor" /> Start
                  </button>
                )}
              </span>
            </div>
            <div className="card flush">
              {list.map((it, idx) => (
                <Fragment key={it.id}>
                  {idx > 0 && <div className="divider" />}
                  {row(it)}
                </Fragment>
              ))}
            </div>
          </Fragment>
        );
      })}

      {date <= t && <CheckInCard date={date} plans={activePlans.filter((p) => filter === 'all' || p.id === filter)} />}

      {upcoming.length > 0 && (
        <>
          <div className="section-label">Coming up</div>
          <div className="card flush">
            {upcoming.map((m, idx) => {
              const p = planMap.get(m.planId)!;
              const n = daysBetween(t, m.date);
              return (
                <Fragment key={m.id}>
                  {idx > 0 && <div className="divider" />}
                  <button
                    className="item"
                    style={{ width: '100%', textAlign: 'left' }}
                    onClick={() => {
                      ui.setPlanId(p.id);
                      ui.setTab('plans');
                    }}
                  >
                    <IconTile name={m.icon} color={p.color} size={42} />
                    <div className="grow">
                      <div className="t">{m.title}</div>
                      <div className="s">{p.name}</div>
                    </div>
                    <span className="muted small">{n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`}</span>
                  </button>
                </Fragment>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function HeroCard({ item, planName, date }: { item: Item; planName?: string; date: string }) {
  const act = useItemActions();
  const ui = useUI();
  const isToday = date === today();
  const overdue = isToday && item.time && timeToMin(item.time) < nowMin();
  return (
    <div className="hero" style={{ ['--c' as string]: item.color }}>
      <button className="row" style={{ alignItems: 'flex-start', textAlign: 'left', width: '100%' }} onClick={() => ui.open({ kind: 'item-detail', itemId: item.id, date })}>
        <IconTile name={item.icon} color={item.color} size={48} />
        <div className="grow">
          <div className="meta">
            {item.time ? (
              <span style={{ color: overdue ? 'var(--red)' : undefined }}>
                {overdue ? <AlarmClock size={13} style={{ verticalAlign: -2 }} /> : <CalendarClock size={13} style={{ verticalAlign: -2 }} />} {fmtTime(item.time)}
              </span>
            ) : (
              'Any time'
            )}
            {planName && ` · ${planName}`}
            {item.target > 1 && ` · ${item.target} ${item.unit ?? 'times'}`}
            {item.timer ? ` · ${fmtDuration(item.timer)}` : ''}
          </div>
          <h3>{item.name}</h3>
          {item.notes && <p>{item.notes}</p>}
        </div>
      </button>
      <div className="actions">
        <button className="btn primary" onClick={() => act.done(item, date)}>
          Done
        </button>
        {item.timer ? (
          <button className="btn secondary" onClick={() => ui.open({ kind: 'routine', slot: item.slot, date })} aria-label="Start with timer">
            <Play size={18} fill="currentColor" />
          </button>
        ) : null}
        <button className="btn secondary" onClick={() => act.skip(item, date)}>
          Skip
        </button>
      </div>
    </div>
  );
}
