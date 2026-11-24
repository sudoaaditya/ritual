import { Check } from 'lucide-react';
import { useRef, useState } from 'react';
import { importAnyFile } from './Settings';
import { Ring } from '../components/ui';
import { createFromTemplate } from '../lib/actions';
import { today, uid } from '../lib/db';
import { IconTile } from '../lib/icons';
import { useUI } from '../lib/store';
import { TEMPLATES } from '../lib/templates';
import { CATEGORIES } from '../lib/types';

const STARTERS = TEMPLATES.filter((t) => t.id !== 'blank');

/** First-run screen: pick one or more focus areas and get ready-made plans in one tap. */
export function Welcome() {
  const ui = useUI();
  const [picked, setPicked] = useState<Set<string>>(new Set(['skin-basic']));
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const toggle = (id: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const create = async () => {
    setBusy(true);
    for (const t of STARTERS.filter((x) => picked.has(x.id))) {
      const cat = CATEGORIES.find((c) => c.id === t.category)!;
      await createFromTemplate(t, {
        id: uid(),
        name: cat.label,
        category: t.category,
        color: cat.color,
        icon: cat.icon,
        startDate: today(),
        durationDays: t.durationDays,
        createdAt: Date.now(),
      });
    }
    ui.toast('You’re all set — tweak anything in Plans');
  };

  return (
    <div className="screen">
      <div style={{ display: 'grid', placeItems: 'center', margin: '28px 0 8px' }}>
        <Ring value={0.72} size={84} stroke={10} color="url(#wg)" track="var(--card-2)">
          <defs>
            <linearGradient id="wg" x1="0" x2="1">
              <stop offset="0" stopColor="#ff7a8a" />
              <stop offset="1" stopColor="#34c759" />
            </linearGradient>
          </defs>
        </Ring>
      </div>
      <div className="large-title" style={{ textAlign: 'center' }}>Welcome to Rituals</div>
      <div className="subtitle" style={{ textAlign: 'center' }}>What would you like to keep track of? Pick any — you can change everything later.</div>

      <div className="stack">
        {STARTERS.map((t) => {
          const cat = CATEGORIES.find((c) => c.id === t.category)!;
          const on = picked.has(t.id);
          return (
            <button key={t.id} className={`tpl press ${on ? 'on' : ''}`} style={{ ['--c' as string]: cat.color }} onClick={() => toggle(t.id)} aria-pressed={on}>
              <IconTile name={cat.icon} color={cat.color} size={44} />
              <div className="grow">
                <div style={{ fontWeight: 700 }}>{cat.label}</div>
                <div className="muted small">{t.blurb}</div>
                <div className="faint small" style={{ marginTop: 4 }}>
                  {t.items
                    .slice(0, 4)
                    .map((i) => i.name)
                    .join(' · ')}
                  {t.items.length > 4 ? ` +${t.items.length - 4}` : ''}
                </div>
              </div>
              <span className={`check ${on ? 'on' : ''}`} style={{ ['--c' as string]: cat.color }}>
                {on && <Check size={18} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <button className="btn primary block" style={{ marginTop: 20 }} disabled={!picked.size || busy} onClick={create}>
        {picked.size ? `Create ${picked.size} plan${picked.size > 1 ? 's' : ''}` : 'Pick at least one'}
      </button>
      <button className="btn block" style={{ marginTop: 6, color: 'var(--accent)' }} onClick={() => ui.open({ kind: 'plan-edit' })}>
        Customise or start from scratch
      </button>
      <button className="btn block" style={{ color: 'var(--accent)' }} onClick={() => file.current?.click()}>
        Import a plan file
      </button>
      <input
        ref={file}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try {
            const m = await importAnyFile(f);
            if (m) ui.toast(m);
          } catch (err) {
            ui.toast((err as Error).message);
          }
        }}
      />
    </div>
  );
}
