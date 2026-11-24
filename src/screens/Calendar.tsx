import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { addDays, fmtDate, parseDate } from '../lib/schedule';
import { ItemRow } from '../components/ItemRow';
import { DayRing, Ring } from '../components/ui';
import { logId, today } from '../lib/db';
import { dayProgress, fmtTime, itemsOn } from '../lib/progress';
import { useData, useUI } from '../lib/store';
import { nextPending } from './Today';

export function Calendar() {
  const { plans, items, logs } = useData();
  const ui = useUI();
  const t = today();
  const [sel, setSel] = useState(ui.date);
  const [month, setMonth] = useState(() => sel.slice(0, 7));
  const planMap = useMemo(() => new Map(plans.map((p) => [p.id, p])), [plans]);

  const first = parseDate(`${month}-01`);
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = first.getDay();
  const shift = (n: number) => setMonth(fmtDate(new Date(first.getFullYear(), first.getMonth() + n, 1)).slice(0, 7));

  // month % = done / total over days up to today
  let done = 0;
  let total = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${month}-${String(d).padStart(2, '0')}`;
    if (ds > t) break;
    const p = dayProgress(items, ds, logs);
    done += p.done;
    total += p.total;
  }
  const pct = total ? Math.round((done / total) * 100) : null;

  const selItems = itemsOn(items, sel);
  const selProg = dayProgress(items, sel, logs);
  const nxt = nextPending(items, sel, logs);

  return (
    <div className="screen">
      <div className="topbar">
        <button
          className="pill-btn glass"
          onClick={() => {
            setSel(t);
            setMonth(t.slice(0, 7));
          }}
        >
          Today
        </button>
      </div>
      <div className="large-title">Calendar</div>
      <div className="subtitle">Tap a day to review or back-fill it.</div>

      <div className="card" style={{ padding: 16 }}>
        <div className="cal-head">
          <h3>{first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
          {pct !== null && <span className="muted small num">{pct}% done</span>}
          <span className="grow" />
          <button className="nav-btn" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeft size={22} />
          </button>
          <button className="nav-btn" onClick={() => shift(1)} aria-label="Next month">
            <ChevronRight size={22} />
          </button>
        </div>
        <div className="cal-grid">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => (
            <div className="wd" key={i}>{w}</div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`l${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const ds = `${month}-${String(i + 1).padStart(2, '0')}`;
            const p = dayProgress(items, ds, logs);
            return (
              <DayRing key={ds} day={i + 1} ratio={ds > t ? 0 : p.ratio} due={p.due > 0} selected={ds === sel} future={ds > t} onClick={() => setSel(ds)} size={44} />
            );
          })}
        </div>
      </div>

      <div className="card flush" style={{ marginTop: 16 }}>
        <div className="row" style={{ padding: 16 }}>
          <Ring value={selProg.ratio} size={58} stroke={7} />
          <div className="grow">
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {parseDate(sel).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="muted small">
              {selProg.done} of {selProg.total} done
              {nxt && sel === t && nxt.time ? ` · ${nxt.name} at ${fmtTime(nxt.time)}` : ''}
              {selProg.skipped ? ` · ${selProg.skipped} skipped` : ''}
            </div>
          </div>
          <button
            className="pill-btn"
            style={{ fontSize: 15 }}
            onClick={() => {
              ui.setDate(sel);
              ui.setTab('today');
            }}
          >
            Open
          </button>
        </div>
        {selItems.length === 0 && <div className="empty" style={{ paddingTop: 0 }}>Nothing scheduled.</div>}
        {selItems.map((it) => (
          <Fragment key={it.id}>
            <div className="divider" />
            <ItemRow
              item={it}
              plan={planMap.get(it.planId)}
              date={sel}
              log={logs.get(logId(it.id, sel))}
              onOpen={() => ui.open({ kind: 'item-detail', itemId: it.id, date: sel })}
            />
          </Fragment>
        ))}
      </div>
      {sel > addDays(t, 0) && <p className="faint small" style={{ textAlign: 'center', marginTop: 12 }}>Future day — you can still tick items early.</p>}
    </div>
  );
}
