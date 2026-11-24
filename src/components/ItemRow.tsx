import { Check, Minus, Plus, SkipForward, Timer } from 'lucide-react';
import { useRef, useState, type PointerEvent } from 'react';
import { clearLog, decrement, markDone, vibrate } from '../lib/actions';
import { useItemActions } from '../lib/feedback';
import { IconTile } from '../lib/icons';
import { fmtTime, isComplete, scheduleLabel } from '../lib/progress';
import type { Item, Log, Plan } from '../lib/types';

const TRIGGER = 84;

export function fmtDuration(sec: number) {
  if (sec < 60) return `${sec}s`;
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`;
}

export function ItemRow({
  item,
  plan,
  date,
  log,
  onOpen,
  showPlan = true,
  overdue = false,
}: {
  item: Item;
  plan?: Plan;
  date: string;
  log?: Log;
  onOpen: () => void;
  showPlan?: boolean;
  overdue?: boolean;
}) {
  const act = useItemActions();
  const done = isComplete(item, log);
  const skipped = log?.status === 'skipped';
  const count = log?.status === 'done' ? log.count : 0;
  const multi = item.target > 1;

  // ---- swipe: right = done, left = skip ----
  const [dx, setDx] = useState(0);
  const st = useRef<{ x: number; y: number; lock?: 'h' | 'v'; swiped?: boolean }>();
  const armed = Math.abs(dx) >= TRIGGER;
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    st.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: PointerEvent) => {
    const s = st.current;
    if (!s) return;
    const ddx = e.clientX - s.x;
    const ddy = e.clientY - s.y;
    if (!s.lock) {
      if (Math.abs(ddx) > 10 && Math.abs(ddx) > Math.abs(ddy)) {
        s.lock = 'h';
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } else if (Math.abs(ddy) > 10) s.lock = 'v';
    }
    if (s.lock === 'h') {
      const next = Math.max(-150, Math.min(150, ddx));
      if (Math.abs(next) >= TRIGGER !== Math.abs(dx) >= TRIGGER) vibrate(8);
      setDx(next);
    }
  };
  const onUp = () => {
    const s = st.current;
    st.current = undefined;
    if (s?.lock === 'h') {
      s.swiped = true;
      swipedRef.current = true;
      setTimeout(() => (swipedRef.current = false), 50);
      if (dx >= TRIGGER) (done ? clearLog(item.id, date) : act.done(item, date));
      else if (dx <= -TRIGGER) (skipped ? clearLog(item.id, date) : act.skip(item, date));
    }
    setDx(0);
  };
  const swipedRef = useRef(false);

  const timeText = item.time ? fmtTime(item.time) : scheduleLabel(item);
  return (
    <div className="swipe" style={{ ['--c' as string]: item.color }}>
      <div aria-hidden="true" className={`swipe-bg left ${dx > 0 ? 'show' : ''} ${armed ? 'armed' : ''}`}>
        <Check size={22} strokeWidth={3} /> {done ? 'Undo' : 'Done'}
      </div>
      <div aria-hidden="true" className={`swipe-bg right ${dx < 0 ? 'show' : ''} ${armed ? 'armed' : ''}`}>
        {skipped ? 'Undo' : 'Skip'} <SkipForward size={20} />
      </div>
      <div
        className={`item ${done ? 'is-done' : ''} ${skipped ? 'is-skipped' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : undefined }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => {
          st.current = undefined;
          setDx(0);
        }}
      >
        <button onClick={() => !swipedRef.current && onOpen()} className="row grow" style={{ textAlign: 'left', gap: 14 }}>
          <IconTile name={item.icon} color={item.color} size={42} dim={skipped} />
          <div className="grow">
            <div className="t ellipsis">{item.name}</div>
            <div className="s ellipsis">
              {skipped ? (
                'Skipped'
              ) : (
                <>
                  <span style={overdue && !done ? { color: 'var(--red)', fontWeight: 600 } : undefined}>{timeText}</span>
                  {item.timer ? (
                    <>
                      {' · '}
                      <Timer size={12} style={{ verticalAlign: -1 }} /> {fmtDuration(item.timer)}
                    </>
                  ) : null}
                  {showPlan && plan ? ` · ${plan.name}` : ''}
                </>
              )}
            </div>
            {multi ? (
              <div className="dots-mini">
                {Array.from({ length: Math.min(item.target, 12) }, (_, i) => (
                  <i key={i} className={i < count ? 'on' : ''} />
                ))}
              </div>
            ) : (
              item.notes && !done && !skipped && <div className="n ellipsis">{item.notes}</div>
            )}
          </div>
        </button>
        {multi && !skipped ? (
          <div className="counter">
            {count > 0 && (
              <button onClick={() => decrement(item, date)} aria-label="minus one">
                <Minus size={16} />
              </button>
            )}
            <span className="v num">
              {count}/{item.target}
            </span>
            <button className="plus" onClick={() => (done ? clearLog(item.id, date) : markDone(item, date))} aria-label={done ? 'reset' : 'plus one'}>
              {done ? <Check size={16} strokeWidth={3} /> : <Plus size={16} strokeWidth={3} />}
            </button>
          </div>
        ) : (
          <button
            className={`check ${done ? 'on' : ''} ${skipped ? 'skip' : ''}`}
            aria-label={done ? 'Mark not done' : 'Mark done'}
            onClick={() => (done || skipped ? clearLog(item.id, date) : markDone(item, date, true))}
          >
            {done ? <Check size={18} strokeWidth={3.2} /> : skipped ? <SkipForward size={14} /> : null}
          </button>
        )}
      </div>
    </div>
  );
}
