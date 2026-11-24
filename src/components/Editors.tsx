import { Check, ChevronDown, Share2, Trash2 } from 'lucide-react';
import { exportPlanFile, shareJson } from '../lib/planfile';
import { useState } from 'react';
import { createFromTemplate, deleteItem, deletePlan, newItem, saveItem, savePlan } from '../lib/actions';
import { today, uid } from '../lib/db';
import { ICON_NAMES, Icon, IconTile } from '../lib/icons';
import { fmtTime, scheduleLabel, slotForTime } from '../lib/progress';
import { useData, useUI } from '../lib/store';
import { TEMPLATES, type Template } from '../lib/templates';
import { CATEGORIES, PALETTE, SLOTS, type Item, type Plan, type Schedule } from '../lib/types';
import { fmtDuration } from './ItemRow';
import { Sheet, Stepper, Toggle } from './ui';

export function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="swatches">
      {PALETTE.map((c) => (
        <button key={c} type="button" className={value === c ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
      ))}
    </div>
  );
}

export function IconPicker({ value, color, onChange }: { value: string; color: string; onChange: (n: string) => void }) {
  return (
    <div className="icon-grid" style={{ ['--c' as string]: color }}>
      {ICON_NAMES.map((n) => (
        <button key={n} type="button" className={value === n ? 'on' : ''} onClick={() => onChange(n)} aria-label={n}>
          <Icon name={n} size={20} />
        </button>
      ))}
    </div>
  );
}

const TIMERS = [0, 30, 60, 120, 180, 300, 600, 900, 1200, 1800, 2700, 3600];

/* ------------------------------------------------------------------ */

export function ItemEditor({ item, planId, onClose }: { item?: Item; planId?: string; onClose: () => void }) {
  const { plans } = useData();
  const ui = useUI();
  const live = plans.filter((p) => !p.archived);
  const [it, setIt] = useState<Item>(
    () => item ?? newItem(planId ?? live[0]?.id ?? '', { color: plans.find((p) => p.id === planId)?.color ?? '#0a84ff' }),
  );
  const [pickIcon, setPickIcon] = useState(false);
  // Progressive disclosure: show advanced fields only when asked, or when the item already uses them.
  const [more, setMore] = useState(
    () => !!item && (item.target > 1 || !!item.timer || !!item.startDate || !!item.endDate || item.slot !== slotForTime(item.time)),
  );
  const set = (p: Partial<Item>) => setIt((x) => ({ ...x, ...p }));
  const s = it.schedule;
  const setSchedule = (sc: Schedule) => set({ schedule: sc });

  if (!plans.length) {
    return (
      <Sheet title="New item" onClose={onClose}>
        <div className="empty">
          <p>Create a plan first — items live inside plans.</p>
          <button className="btn primary" onClick={() => ui.open({ kind: 'plan-edit' })}>Create a plan</button>
        </div>
      </Sheet>
    );
  }

  const save = async () => {
    if (!it.name.trim() || !it.planId) return;
    await saveItem({ ...it, name: it.name.trim(), notes: it.notes?.trim() || undefined });
    ui.toast(item ? 'Saved' : `Added ${it.name.trim()}`);
    onClose();
  };

  return (
    <Sheet
      title={item ? 'Edit item' : 'New item'}
      onClose={onClose}
      left={<button className="pill-btn" onClick={onClose}>Cancel</button>}
      right={<button className="pill-btn" style={{ fontWeight: 700 }} disabled={!it.name.trim()} onClick={save}>{item ? 'Save' : 'Add'}</button>}
    >
      <div className="form-group">
        <div className="field">
          <button onClick={() => setPickIcon((v) => !v)} aria-label="Change icon and colour" style={{ position: 'relative' }}>
            <IconTile name={it.icon} color={it.color} size={44} />
            <span className="edit-dot"><ChevronDown size={10} strokeWidth={3} /></span>
          </button>
          <input className="big" type="text" placeholder="e.g. Sunscreen, Water, Minoxidil" value={it.name} onChange={(e) => set({ name: e.target.value })} autoFocus={!item} />
        </div>
        {pickIcon && (
          <div style={{ borderBottom: '1px solid var(--line)' }}>
            <IconPicker value={it.icon} color={it.color} onChange={(icon) => set({ icon })} />
            <ColorPicker value={it.color} onChange={(color) => set({ color })} />
          </div>
        )}
        <div className="field">
          <textarea placeholder="How to use it (optional)" value={it.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} rows={2} />
        </div>
      </div>

      <div className="form-group">
        <div className="field">
          <span className="grow">At a set time</span>
          <Toggle checked={!!it.time} onChange={(v) => set(v ? { time: '08:00', slot: 'morning' } : { time: undefined, slot: 'any' })} />
        </div>
        {it.time ? (
          <div className="field">
            <span className="grow">Time</span>
            <input type="time" value={it.time} onChange={(e) => e.target.value && set({ time: e.target.value, slot: slotForTime(e.target.value) })} />
          </div>
        ) : (
          <div className="field">
            <span className="grow">Part of day</span>
            <select value={it.slot} onChange={(e) => set({ slot: e.target.value as Item['slot'] })}>
              {SLOTS.map((sl) => <option key={sl.id} value={sl.id}>{sl.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="form-label">Repeat</div>
      <div className="form-group">
        <div className="field">
          <div className="seg" style={{ width: '100%', display: 'flex' }}>
            {(
              [
                ['daily', 'Every day'],
                ['weekdays', 'Some days'],
                ['interval', 'Every N days'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                style={{ flex: 1 }}
                className={s.kind === k ? 'on' : ''}
                onClick={() =>
                  setSchedule(
                    k === 'daily'
                      ? { kind: 'daily' }
                      : k === 'weekdays'
                        ? { kind: 'weekdays', days: s.kind === 'weekdays' ? s.days : [1, 3, 5] }
                        : { kind: 'interval', every: s.kind === 'interval' ? s.every : 2, anchor: s.kind === 'interval' ? s.anchor : today() },
                  )
                }
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {s.kind === 'weekdays' && (
          <div className="daypick">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <button
                key={i}
                className={s.days.includes(i) ? 'on' : ''}
                onClick={() => setSchedule({ kind: 'weekdays', days: s.days.includes(i) ? s.days.filter((x) => x !== i) : [...s.days, i].sort() })}
                aria-pressed={s.days.includes(i)}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        {s.kind === 'interval' && (
          <>
            <div className="field">
              <span className="grow">Every</span>
              <Stepper value={s.every} min={1} max={60} onChange={(every) => setSchedule({ ...s, every })} />
              <span className="muted">days</span>
            </div>
            <div className="field">
              <span className="grow">Starting</span>
              <input type="date" value={s.anchor} onChange={(e) => e.target.value && setSchedule({ ...s, anchor: e.target.value })} />
            </div>
          </>
        )}
      </div>

      {!more ? (
        <button className="more-btn" onClick={() => setMore(true)}>
          More options <span className="faint">· amount, timer, plan, dates</span>
          <ChevronDown size={16} />
        </button>
      ) : (
        <>
          <div className="form-group">
            {it.time && (
              <div className="field">
                <span className="grow">Part of day</span>
                <select value={it.slot} onChange={(e) => set({ slot: e.target.value as Item['slot'] })}>
                  {SLOTS.map((sl) => <option key={sl.id} value={sl.id}>{sl.label}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <span className="grow">Times per day</span>
              <Stepper value={it.target} min={1} max={30} onChange={(target) => set({ target })} />
            </div>
            {it.target > 1 && (
              <div className="field">
                <span className="grow">Unit</span>
                <input type="text" placeholder="glass, serving, set…" value={it.unit ?? ''} onChange={(e) => set({ unit: e.target.value })} />
              </div>
            )}
            <div className="field">
              <span className="grow">Step timer</span>
              <select value={it.timer ?? 0} onChange={(e) => set({ timer: Number(e.target.value) || undefined })}>
                {TIMERS.map((t) => <option key={t} value={t}>{t ? fmtDuration(t) : 'None'}</option>)}
              </select>
            </div>
            {live.length > 1 && (
              <div className="field">
                <span className="grow">Plan</span>
                <select value={it.planId} onChange={(e) => set({ planId: e.target.value })}>
                  {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div className="field">
              <span className="grow">Start date</span>
              <input type="date" value={it.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || undefined })} />
            </div>
            <div className="field">
              <span className="grow">End date</span>
              <input type="date" value={it.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || undefined })} />
            </div>
          </div>
          <div className="form-hint">Use “times per day” for water glasses or meals. The timer runs in guided routine mode.</div>
        </>
      )}

      {item && (
        <button
          className="btn danger block"
          style={{ marginTop: 8 }}
          onClick={async () => {
            if (confirm(`Delete “${item.name}” and its history?`)) {
              await deleteItem(item.id);
              onClose();
            }
          }}
        >
          <Trash2 size={18} /> Delete item
        </button>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */

export function PlanEditor({ plan, onClose }: { plan?: Plan; onClose: () => void }) {
  const ui = useUI();
  const [tpl, setTpl] = useState<Template | undefined>(plan ? undefined : TEMPLATES[0]);
  const [keep, setKeep] = useState<Set<number>>(() => new Set(TEMPLATES[0].items.map((_, i) => i)));
  const [p, setP] = useState<Plan>(
    () =>
      plan ?? {
        id: uid(),
        name: CATEGORIES[0].label,
        category: 'skin',
        color: CATEGORIES[0].color,
        icon: CATEGORIES[0].icon,
        startDate: today(),
        durationDays: TEMPLATES[0].durationDays,
        createdAt: Date.now(),
      },
  );
  const set = (x: Partial<Plan>) => setP((o) => ({ ...o, ...x }));

  const chooseTpl = (t: Template) => {
    setTpl(t);
    setKeep(new Set(t.items.map((_, i) => i)));
    const cat = CATEGORIES.find((c) => c.id === t.category)!;
    set({ name: t.id === 'blank' ? '' : cat.label, category: t.category, color: cat.color, icon: cat.icon, durationDays: t.durationDays });
  };

  const save = async () => {
    if (!p.name.trim()) return;
    const final = { ...p, name: p.name.trim() };
    if (!plan && tpl) await createFromTemplate(tpl, final, keep);
    else await savePlan(final);
    ui.setPlanId(p.id);
    if (!plan) ui.setTab('plans');
    ui.toast(plan ? 'Plan saved' : `${final.name} created`);
    onClose();
  };

  const weeks = p.durationDays ? Math.round(p.durationDays / 7) : 0;

  return (
    <Sheet
      title={plan ? 'Edit plan' : 'New plan'}
      onClose={onClose}
      left={<button className="pill-btn" onClick={onClose}>Cancel</button>}
      right={<button className="pill-btn" style={{ fontWeight: 700 }} disabled={!p.name.trim()} onClick={save}>{plan ? 'Save' : 'Create'}</button>}
    >
      {!plan && (
        <>
          <div className="form-label">Start from</div>
          <div className="stack" style={{ marginBottom: 20 }}>
            {TEMPLATES.map((t) => {
              const cat = CATEGORIES.find((c) => c.id === t.category)!;
              const on = tpl?.id === t.id;
              return (
                <div key={t.id} className={`tpl ${on ? 'on' : ''}`} style={{ ['--c' as string]: cat.color, flexDirection: 'column', alignItems: 'stretch' }}>
                  <button className="row" style={{ alignItems: 'flex-start', textAlign: 'left', gap: 12 }} onClick={() => chooseTpl(t)}>
                    <IconTile name={cat.icon} color={cat.color} size={40} />
                    <div className="grow">
                      <div style={{ fontWeight: 600 }}>{t.name}</div>
                      <div className="muted small">{t.blurb}</div>
                      {!on && t.items.length > 0 && <div className="faint small" style={{ marginTop: 4 }}>{t.items.length} items{t.milestones ? ` · ${t.milestones.length} milestones` : ''}</div>}
                    </div>
                  </button>
                  {on && t.items.length > 0 && (
                    <div className="tpl-items">
                      <div className="faint small" style={{ margin: '4px 0 6px' }}>Untick anything you don’t use:</div>
                      {t.items.map((ti, i) => {
                        const k = keep.has(i);
                        return (
                          <button
                            key={i}
                            className="tpl-item"
                            onClick={() =>
                              setKeep((s) => {
                                const n = new Set(s);
                                if (n.has(i)) n.delete(i);
                                else n.add(i);
                                return n;
                              })
                            }
                            aria-pressed={k}
                          >
                            <span className={`mini-check ${k ? 'on' : ''}`}>{k && <Check size={13} strokeWidth={3.5} />}</span>
                            <IconTile name={ti.icon} color={ti.color} size={26} dim={!k} />
                            <span className="grow ellipsis" style={{ opacity: k ? 1 : 0.45 }}>{ti.name}</span>
                            <span className="faint small">{ti.time ? fmtTime(ti.time) : scheduleLabel({ ...ti, id: '', planId: '', order: 0 })}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="form-label">Details</div>
      <div className="form-group">
        <div className="field">
          <IconTile name={p.icon} color={p.color} size={32} />
          <input className="big" type="text" placeholder="Plan name" value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="field">
          <span className="grow">Category</span>
          <select
            value={p.category}
            onChange={(e) => {
              const c = CATEGORIES.find((x) => x.id === e.target.value)!;
              set({ category: c.id, color: c.color, icon: c.icon });
            }}
          >
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <ColorPicker value={p.color} onChange={(color) => set({ color })} />
      </div>

      <div className="form-label">Timeline</div>
      <div className="form-group">
        <div className="field">
          <span className="grow">Start date</span>
          <input type="date" value={p.startDate} onChange={(e) => e.target.value && set({ startDate: e.target.value })} />
        </div>
        <div className="field">
          <span className="grow">Fixed length</span>
          <Toggle checked={!!p.durationDays} onChange={(v) => set({ durationDays: v ? 84 : undefined })} />
        </div>
        {!!p.durationDays && (
          <div className="field">
            <span className="grow">Weeks</span>
            <Stepper value={weeks} min={1} max={104} onChange={(w) => set({ durationDays: w * 7 })} />
          </div>
        )}
      </div>

      <div className="form-group">
        <div className="field">
          <textarea placeholder="Notes — doctor's advice, products, goals…" value={p.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} rows={3} />
        </div>
      </div>

      {plan && (
        <>
          <div className="form-group">
            <button
              className="field"
              style={{ width: '100%', color: 'var(--accent)' }}
              onClick={async () => {
                const slug = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plan';
                await shareJson(await exportPlanFile(plan.id), `rituals-${slug}.json`);
              }}
            >
              <Share2 size={18} /> <span className="grow" style={{ textAlign: 'left' }}>Share plan as a file</span>
            </button>
          </div>
          <div className="form-hint">Items, times and milestones only — no history or photos. Import it via Settings.</div>
          <div className="form-group">
            <div className="field">
              <span className="grow">Archive (hide from Today)</span>
              <Toggle checked={!!p.archived} onChange={(archived) => set({ archived })} />
            </div>
          </div>
          <button
            className="btn danger block"
            onClick={async () => {
              if (confirm(`Delete “${plan.name}” with all its items, history, check-ins and photos? This cannot be undone.`)) {
                await deletePlan(plan.id);
                ui.setPlanId(undefined);
                ui.setFilter('all');
                onClose();
              }
            }}
          >
            <Trash2 size={18} /> Delete plan
          </button>
        </>
      )}
    </Sheet>
  );
}
