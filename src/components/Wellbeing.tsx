import { Lightbulb } from 'lucide-react';
import { checkinId } from '../lib/actions';
import { logId } from '../lib/db';
import { IconTile } from '../lib/icons';
import { isComplete, type LogMap } from '../lib/progress';
import { addDays } from '../lib/schedule';
import { CHECKIN, MOODS, type CheckIn, type Item, type Plan } from '../lib/types';

interface Link {
  text: string;
  effect: number;
  color: string;
}

/** Look for simple patterns: "flag X shows up more often the day after item Y" and rating shifts. */
function findLinks(plan: Plan, items: Item[], logs: LogMap, checkins: Map<string, CheckIn>, days: string[]): Link[] {
  const meta = CHECKIN[plan.category];
  const ci = days.map((d) => ({ d, c: checkins.get(checkinId(plan.id, d)) })).filter((x) => x.c);
  if (ci.length < 6) return [];
  const out: Link[] = [];
  for (const it of items.filter((i) => i.planId === plan.id)) {
    const doneBefore = (d: string) => isComplete(it, logs.get(logId(it.id, addDays(d, -1))));
    const A = ci.filter((x) => doneBefore(x.d));
    const B = ci.filter((x) => !doneBefore(x.d));
    if (A.length < 3 || B.length < 3) continue;
    for (const f of meta.flags) {
      const ra = A.filter((x) => x.c!.flags.includes(f)).length / A.length;
      const rb = B.filter((x) => x.c!.flags.includes(f)).length / B.length;
      if (Math.abs(ra - rb) >= 0.3 && Math.max(ra, rb) >= 0.4) {
        out.push({
          text: `“${f}” was logged on ${Math.round(ra * 100)}% of days after ${it.name}, vs ${Math.round(rb * 100)}% otherwise.`,
          effect: Math.abs(ra - rb),
          color: it.color,
        });
      }
    }
    const avg = (xs: typeof ci) => {
      const r = xs.filter((x) => x.c!.rating);
      return r.length >= 3 ? r.reduce((s, x) => s + x.c!.rating!, 0) / r.length : null;
    };
    const aa = avg(A);
    const bb = avg(B);
    if (aa !== null && bb !== null && Math.abs(aa - bb) >= 0.8) {
      out.push({
        text: `${meta.label} rating averages ${aa.toFixed(1)} the day after ${it.name}, vs ${bb.toFixed(1)} otherwise.`,
        effect: Math.abs(aa - bb) / 4,
        color: it.color,
      });
    }
  }
  return out.sort((a, b) => b.effect - a.effect).slice(0, 3);
}

const RATING_COLORS = ['#ff453a', '#ff9f0a', '#ffd60a', '#9bd65a', '#30d158'];

export function Wellbeing({ plans, items, logs, checkins, days }: { plans: Plan[]; items: Item[]; logs: LogMap; checkins: Map<string, CheckIn>; days: string[] }) {
  const rows = plans
    .map((p) => {
      const cs = days.map((d) => checkins.get(checkinId(p.id, d)));
      const rated = cs.filter((c) => c?.rating) as CheckIn[];
      const flagCount = new Map<string, number>();
      cs.forEach((c) => c?.flags.forEach((f) => flagCount.set(f, (flagCount.get(f) ?? 0) + 1)));
      return {
        p,
        cs,
        avg: rated.length ? rated.reduce((s, c) => s + c.rating!, 0) / rated.length : null,
        flags: [...flagCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
        links: findLinks(p, items, logs, checkins, days),
        count: cs.filter(Boolean).length,
      };
    })
    .filter((r) => r.count > 0);

  return (
    <>
      <div className="section-label">
        <span>How you’ve felt</span>
        <small>from daily check-ins</small>
      </div>
      {rows.length === 0 ? (
        <div className="card muted small">Rate your day on the Today screen (😣 → 😄) and tag things like “Irritation” or “Shedding”. After a week or two, patterns show up here.</div>
      ) : (
        <div className="stack">
          {rows.map(({ p, cs, avg, flags, links, count }) => (
            <div className="card" key={p.id}>
              <div className="row" style={{ marginBottom: 10 }}>
                <IconTile name={p.icon} color={p.color} size={32} />
                <div className="grow">
                  <div style={{ fontWeight: 700 }}>{p.name}</div>
                  <div className="muted small">
                    {count} check-in{count === 1 ? '' : 's'}
                    {avg !== null && ` · avg ${MOODS[Math.round(avg) - 1]} ${avg.toFixed(1)}`}
                  </div>
                </div>
              </div>
              <div className="mood-strip" aria-label="Daily ratings">
                {cs.slice(-30).map((c, i) => (
                  <i key={i} style={{ background: c?.rating ? RATING_COLORS[c.rating - 1] : undefined, height: c?.rating ? `${30 + c.rating * 14}%` : undefined }} />
                ))}
              </div>
              {flags.length > 0 && (
                <div className="row small" style={{ flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                  {flags.map(([f, n]) => (
                    <span key={f} className="flag-count">
                      {f} <b className="num">{n}</b>
                    </span>
                  ))}
                </div>
              )}
              {links.map((l, i) => (
                <div key={i} className="insight-line" style={{ ['--c' as string]: l.color }}>
                  <Lightbulb size={16} />
                  <span>{l.text}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="faint small" style={{ padding: '0 6px' }}>Patterns are hints, not medical advice — share them with your doctor or dermatologist.</div>
        </div>
      )}
    </>
  );
}
