import { CalendarDays, CheckCircle2, ChartNoAxesCombined, ClipboardList, Search, Settings2 } from 'lucide-react';
import { useEffect } from 'react';
import { SheetHost } from './components/Sheets';
import { markDone } from './lib/actions';
import { logId, today } from './lib/db';
import { IconTile } from './lib/icons';
import { dayProgress, fmtTime } from './lib/progress';
import { UIProvider, useData, useUI, type Tab } from './lib/store';
import { Calendar } from './screens/Calendar';
import { Insights } from './screens/Insights';
import { Plans } from './screens/Plans';
import { Settings } from './screens/Settings';
import { Today, nextPending } from './screens/Today';

const TABS: { id: Tab; label: string; icon: typeof CheckCircle2 }[] = [
  { id: 'today', label: 'Today', icon: CheckCircle2 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'plans', label: 'Plans', icon: ClipboardList },
  { id: 'insights', label: 'Insights', icon: ChartNoAxesCombined },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

function Shell() {
  const ui = useUI();
  const { tab } = ui;

  // keep "today" fresh across midnight
  useEffect(() => {
    let last = today();
    const id = window.setInterval(() => {
      const t = today();
      if (t !== last) {
        if (ui.date === last) ui.setDate(t);
        last = t;
      }
    }, 60_000);
    return () => clearInterval(id);
  }, [ui]);

  return (
    <div className="app">
      {tab === 'today' && <Today />}
      {tab === 'calendar' && <Calendar />}
      {tab === 'plans' && <Plans />}
      {tab === 'insights' && <Insights />}
      {tab === 'settings' && <Settings />}

      <div className="dock">
        {tab !== 'today' && <MiniNext />}
        <div className="tabbar-row">
          <nav className="tabbar glass" aria-label="Main">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => ui.setTab(t.id)} aria-label={t.label} aria-current={tab === t.id}>
                <t.icon size={24} strokeWidth={tab === t.id ? 2.4 : 1.9} />
              </button>
            ))}
          </nav>
          <button className="fab glass" aria-label="Search" onClick={() => ui.open({ kind: 'search' })}>
            <Search size={24} />
          </button>
        </div>
      </div>
      <SheetHost />
      {ui.toastMsg && (
        <div className="toast glass" role="status">
          <span>{ui.toastMsg.msg}</span>
          {ui.toastMsg.action && (
            <button
              className="toast-action"
              onClick={() => {
                ui.toastMsg!.action!.run();
                ui.dismissToast();
              }}
            >
              {ui.toastMsg.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MiniNext() {
  const { items, logs, plans } = useData();
  const ui = useUI();
  const t = today();
  const next = nextPending(items, t, logs);
  if (!next) return null;
  const p = dayProgress(items, t, logs);
  const plan = plans.find((x) => x.id === next.planId);
  return (
    <div className="mini glass" style={{ ['--c' as string]: next.color }}>
      <button className="row grow" style={{ textAlign: 'left' }} onClick={() => ui.open({ kind: 'item-detail', itemId: next.id, date: t })}>
        <IconTile name={next.icon} color={next.color} size={42} />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="t ellipsis">{next.name}</div>
          <div className="s ellipsis">
            Next{next.time ? ` · ${fmtTime(next.time)}` : ''} · {p.done} of {p.total} done{plan && plans.length > 1 ? ` · ${plan.name}` : ''}
          </div>
        </div>
      </button>
      <button className="check" aria-label={`Mark ${next.name} done`} onClick={() => !logs.get(logId(next.id, t)) && markDone(next, t, true)} />
    </div>
  );
}

export default function App() {
  return (
    <UIProvider>
      <Shell />
    </UIProvider>
  );
}
