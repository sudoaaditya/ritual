import { Flame, Target, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addDays, parseDate } from '../lib/schedule';
import { Ring } from '../components/ui';
import { logId, today } from '../lib/db';
import { IconTile } from '../lib/icons';
import { dayProgress, isComplete, itemsOn, streak } from '../lib/progress';
import { useData } from '../lib/store';
import { Wellbeing } from '../components/Wellbeing';

export function Insights() {
  const { plans, items, logs, checkins } = useData();
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const t = today();

  const stats = useMemo(() => {
    const days = Array.from({ length: range }, (_, i) => addDays(t, -(range - 1 - i)));
    const perDay = days.map((d) => ({ d, ...dayProgress(items, d, logs) }));
    const done = perDay.reduce((s, p) => s + p.done, 0);
    const total = perDay.reduce((s, p) => s + p.total, 0);
    const perfect = perDay.filter((p) => p.due > 0 && p.ratio >= 1).length;
    // best streak in range
    let best = 0;
    let run = 0;
    for (const p of perDay) {
      if (p.due === 0) continue;
      run = p.ratio >= 1 ? run + 1 : 0;
      best = Math.max(best, run);
    }
    const perItem = items
      .map((it) => {
        let due = 0;
        let ok = 0;
        for (const d of days) {
          if (!itemsOn([it], d).length) continue;
          const l = logs.get(logId(it.id, d));
          if (l?.status === 'skipped') continue;
          due++;
          if (isComplete(it, l)) ok++;
        }
        return { it, due, ok, r: due ? ok / due : 0 };
      })
      .filter((x) => x.due > 0)
      .sort((a, b) => a.r - b.r);
    const perPlan = plans
      .filter((p) => !p.archived)
      .map((p) => {
        const its = items.filter((i) => i.planId === p.id);
        let dn = 0;
        let tt = 0;
        for (const d of days) {
          const q = dayProgress(its, d, logs);
          dn += q.done;
          tt += q.total;
        }
        return { p, r: tt ? dn / tt : 0, tt };
      });
    return { days, perDay, rate: total ? done / total : 0, done, perfect, best, perItem, perPlan };
  }, [items, logs, plans, range, t]);

  const current = streak(items, logs, t, addDays);
  const bars = stats.perDay.slice(-Math.min(range, 30));

  return (
    <div className="screen">
      <div className="topbar">
        <div className="seg glass">
          {[7, 30, 90].map((r) => (
            <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r as 7 | 30 | 90)}>
              {r}d
            </button>
          ))}
        </div>
      </div>
      <div className="large-title">Insights</div>
      <div className="subtitle">How consistent you've been over the last {range} days.</div>

      <div className="stats">
        <div className="stat">
          <Flame size={18} color="#ff9f0a" />
          <div className="v num">{current}</div>
          <div className="l">day streak</div>
        </div>
        <div className="stat">
          <Trophy size={18} color="#ffd60a" />
          <div className="v num">{stats.best}</div>
          <div className="l">best streak</div>
        </div>
        <div className="stat">
          <Target size={18} color="var(--green)" />
          <div className="v num">{stats.perfect}</div>
          <div className="l">perfect days</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12, padding: 18 }}>
        <div className="row">
          <Ring value={stats.rate} size={86} stroke={10} />
          <div className="grow">
            <div style={{ fontSize: 34, fontWeight: 800 }} className="num">{Math.round(stats.rate * 100)}%</div>
            <div className="muted small">completion · {stats.done} check-ins</div>
          </div>
        </div>
        <div className="spark" style={{ marginTop: 18 }}>
          {bars.map((b) => (
            <i
              key={b.d}
              className={b.due === 0 ? 'zero' : ''}
              title={`${b.d}: ${Math.round(b.ratio * 100)}%`}
              style={{ height: `${b.due ? Math.max(4, b.ratio * 100) : 4}%`, background: b.due && b.ratio >= 1 ? 'var(--green)' : undefined }}
            />
          ))}
        </div>
        <div className="row faint small" style={{ marginTop: 6 }}>
          <span className="grow">{parseDate(bars[0].d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
          <span>Today</span>
        </div>
      </div>

      {stats.perPlan.length > 0 && (
        <>
          <div className="section-label">By plan</div>
          <div className="stats" style={{ gridTemplateColumns: `repeat(${Math.min(3, stats.perPlan.length)}, 1fr)` }}>
            {stats.perPlan.map(({ p, r, tt }) => (
              <div className="stat" key={p.id} style={{ textAlign: 'center' }}>
                <div style={{ display: 'grid', placeItems: 'center', position: 'relative' }}>
                  <Ring value={r} size={64} stroke={7} color={p.color} track={`color-mix(in srgb, ${p.color} 20%, transparent)`} />
                  <span className="num" style={{ position: 'absolute', fontWeight: 700 }}>{tt ? Math.round(r * 100) : '–'}</span>
                </div>
                <div className="l ellipsis" style={{ marginTop: 8 }}>{p.name}</div>
              </div>
            ))}
          </div>
        </>
      )}

      <Wellbeing plans={plans.filter((p) => !p.archived)} items={items} logs={logs} checkins={checkins} days={stats.days} />

      {stats.perItem.length > 0 && (
        <>
          <div className="section-label">
            <span>By item</span>
            <small>needs attention first</small>
          </div>
          <div className="card">
            {stats.perItem.map(({ it, r, ok, due }) => (
              <div className="bar-row" key={it.id} style={{ ['--c' as string]: it.color }}>
                <IconTile name={it.icon} color={it.color} size={30} />
                <div className="grow">
                  <div className="row small" style={{ marginBottom: 6 }}>
                    <span className="grow ellipsis">{it.name}</span>
                    <span className="muted num">{ok}/{due}</span>
                  </div>
                  <div className="track"><i style={{ width: `${r * 100}%` }} /></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
