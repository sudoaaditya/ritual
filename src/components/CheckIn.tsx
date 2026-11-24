import { useLiveQuery } from 'dexie-react-hooks';
import { Camera, ChevronRight, Columns2, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addPhoto, checkinId, deletePhoto, saveCheckIn } from '../lib/actions';
import { db, today } from '../lib/db';
import { IconTile } from '../lib/icons';
import { daysBetween, parseDate } from '../lib/schedule';
import { useData, useUI } from '../lib/store';
import { CHECKIN, MOODS, type Photo, type Plan } from '../lib/types';
import { Sheet } from './ui';

export function usePhotoUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

const fmtDay = (d: string) => parseDate(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/* ---------------- Today card ---------------- */

export function CheckInCard({ date, plans }: { date: string; plans: Plan[] }) {
  const { checkins } = useData();
  const ui = useUI();
  if (!plans.length) return null;
  const allDone = plans.every((p) => checkins.get(checkinId(p.id, date))?.rating);
  return (
    <>
      <div className="section-label">
        <span>Check-in</span>
        <small>{allDone ? 'logged ✓' : 'how is it going?'}</small>
      </div>
      <div className="card flush">
        {plans.map((p, idx) => {
          const c = checkins.get(checkinId(p.id, date));
          const meta = CHECKIN[p.category];
          return (
            <div key={p.id}>
              {idx > 0 && <div className="divider" style={{ marginLeft: 16 }} />}
              <div className="checkin-row">
                <button className="row" style={{ gap: 10, textAlign: 'left', width: '100%' }} onClick={() => ui.open({ kind: 'checkin', planId: p.id, date })}>
                  <IconTile name={p.icon} color={p.color} size={28} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small" style={{ fontWeight: 600 }}>{meta.question}</div>
                    {(c?.flags.length || c?.note) && (
                      <div className="faint small ellipsis">{[...(c?.flags ?? []), c?.note].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                  <span className="faint small row" style={{ gap: 2 }}>
                    Details <ChevronRight size={14} />
                  </span>
                </button>
                <div className="moods">
                  {MOODS.map((m, i) => (
                    <button
                      key={m}
                      className={c?.rating === i + 1 ? 'on' : ''}
                      style={{ ['--c' as string]: p.color }}
                      onClick={() => saveCheckIn(p.id, date, { rating: c?.rating === i + 1 ? undefined : i + 1 })}
                      aria-label={`Rate ${i + 1} of 5`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------------- Check-in details sheet ---------------- */

export function CheckInSheet({ planId, date, onClose }: { planId: string; date: string; onClose: () => void }) {
  const { plans, checkins } = useData();
  const ui = useUI();
  const plan = plans.find((p) => p.id === planId);
  const cur = checkins.get(checkinId(planId, date));
  const [note, setNote] = useState(cur?.note ?? '');
  const file = useRef<HTMLInputElement>(null);
  const photos = useLiveQuery(() => db.photos.where('planId').equals(planId).filter((p) => p.date === date).toArray(), [planId, date]) ?? [];
  if (!plan) return null;
  const meta = CHECKIN[plan.category];
  const flags = cur?.flags ?? [];

  return (
    <Sheet
      title={date === today() ? 'Today’s check-in' : fmtDay(date)}
      onClose={() => {
        if (note !== (cur?.note ?? '')) saveCheckIn(planId, date, { note: note.trim() || undefined });
        onClose();
      }}
      left={<span />}
      right={
        <button
          className="pill-btn"
          style={{ fontWeight: 700 }}
          onClick={async () => {
            await saveCheckIn(planId, date, { note: note.trim() || undefined });
            onClose();
          }}
        >
          Done
        </button>
      }
    >
      <div className="row" style={{ marginBottom: 14 }}>
        <IconTile name={plan.icon} color={plan.color} size={40} />
        <div>
          <div style={{ fontWeight: 700 }}>{plan.name}</div>
          <div className="muted small">{meta.question}</div>
        </div>
      </div>
      <div className="moods big" style={{ marginBottom: 20 }}>
        {MOODS.map((m, i) => (
          <button key={m} className={cur?.rating === i + 1 ? 'on' : ''} style={{ ['--c' as string]: plan.color }} onClick={() => saveCheckIn(planId, date, { rating: i + 1 })}>
            {m}
          </button>
        ))}
      </div>

      <div className="form-label">Anything to note?</div>
      <div className="flag-wrap">
        {meta.flags.map((f) => {
          const on = flags.includes(f);
          return (
            <button
              key={f}
              className={`chip ${on ? 'on' : ''}`}
              style={{ ['--c' as string]: plan.color }}
              onClick={() => saveCheckIn(planId, date, { flags: on ? flags.filter((x) => x !== f) : [...flags, f] })}
            >
              {f}
            </button>
          );
        })}
      </div>
      <div className="form-group" style={{ marginTop: 14 }}>
        <div className="field">
          <textarea placeholder="Notes — new product, reaction, what you ate…" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>

      <div className="form-label">Progress photo</div>
      <div className="photo-strip">
        {photos.map((p) => (
          <Thumb key={p.id} photo={p} onClick={() => ui.open({ kind: 'photo', photoId: p.id })} />
        ))}
        <button className="thumb add" onClick={() => file.current?.click()}>
          <Camera size={22} />
          <span>Add</span>
        </button>
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) {
            await addPhoto(planId, date, f);
            ui.toast('Photo saved on this device');
          }
        }}
      />
      <div className="form-hint" style={{ marginTop: 10 }}>Same light, same angle each time makes before/after comparisons honest.</div>
    </Sheet>
  );
}

/* ---------------- Photos ---------------- */

export function Thumb({ photo, onClick, size = 76 }: { photo: Photo; onClick?: () => void; size?: number }) {
  const url = usePhotoUrl(photo.blob);
  return (
    <button className="thumb" style={{ width: size, height: size * 1.25 }} onClick={onClick}>
      {url && <img src={url} alt={`Progress photo ${photo.date}`} />}
      <span className="thumb-date">{fmtDay(photo.date)}</span>
    </button>
  );
}

/** Section used on the plan page. */
export function PlanPhotos({ plan }: { plan: Plan }) {
  const ui = useUI();
  const file = useRef<HTMLInputElement>(null);
  const photos = useLiveQuery(() => db.photos.where('planId').equals(plan.id).sortBy('date'), [plan.id]) ?? [];
  return (
    <>
      <div className="section-label">
        <span>Progress photos</span>
        {photos.length >= 2 && (
          <button className="pill-btn" style={{ height: 28, fontSize: 15, padding: 0 }} onClick={() => ui.open({ kind: 'compare', planId: plan.id })}>
            <Columns2 size={16} /> Compare
          </button>
        )}
      </div>
      <div className="card" style={{ padding: 12 }}>
        <div className="photo-strip">
          <button className="thumb add" onClick={() => file.current?.click()}>
            <Camera size={22} />
            <span>Add</span>
          </button>
          {[...photos].reverse().map((p) => (
            <Thumb key={p.id} photo={p} onClick={() => ui.open({ kind: 'photo', photoId: p.id })} />
          ))}
        </div>
        {photos.length === 0 && <div className="muted small" style={{ padding: '8px 4px 2px' }}>Add a photo every week or two to see real change over time. Photos never leave this device.</div>}
      </div>
      <input
        ref={file}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) {
            await addPhoto(plan.id, today(), f);
            ui.toast('Photo saved');
          }
        }}
      />
    </>
  );
}

export function PhotoSheet({ photoId, onClose }: { photoId: string; onClose: () => void }) {
  const photo = useLiveQuery(() => db.photos.get(photoId), [photoId]);
  const url = usePhotoUrl(photo?.blob);
  return (
    <Sheet
      title={photo ? parseDate(photo.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : ''}
      onClose={onClose}
      right={
        <button
          className="pill-btn"
          style={{ color: 'var(--red)' }}
          aria-label="Delete photo"
          onClick={async () => {
            if (confirm('Delete this photo?')) {
              await deletePhoto(photoId);
              onClose();
            }
          }}
        >
          <Trash2 size={18} />
        </button>
      }
    >
      {url && <img src={url} alt="" style={{ width: '100%', borderRadius: 18, display: 'block' }} />}
    </Sheet>
  );
}

export function CompareSheet({ planId, onClose }: { planId: string; onClose: () => void }) {
  const photos = useLiveQuery(() => db.photos.where('planId').equals(planId).sortBy('date'), [planId]) ?? [];
  const [aId, setA] = useState<string>();
  const [bId, setB] = useState<string>();
  const [pos, setPos] = useState(50);
  const [picking, setPicking] = useState<'a' | 'b'>('a');
  const a = photos.find((p) => p.id === aId) ?? photos[0];
  const b = photos.find((p) => p.id === bId) ?? photos[photos.length - 1];
  const ua = usePhotoUrl(a?.blob);
  const ub = usePhotoUrl(b?.blob);
  const box = useRef<HTMLDivElement>(null);
  const drag = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const gap = a && b ? daysBetween(a.date, b.date) : 0;

  return (
    <Sheet title="Before / after" onClose={onClose}>
      {a && b && (
        <>
          <div
            ref={box}
            className="compare"
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              drag(e.clientX);
            }}
            onPointerMove={(e) => e.buttons && drag(e.clientX)}
          >
            {ub && <img src={ub} alt="after" />}
            {ua && <img src={ua} alt="before" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} />}
            <div className="compare-line" style={{ left: `${pos}%` }}>
              <span>⟷</span>
            </div>
            <span className="compare-tag" style={{ left: 10 }}>{fmtDay(a.date)}</span>
            <span className="compare-tag" style={{ right: 10 }}>{fmtDay(b.date)}</span>
          </div>
          <div className="muted small" style={{ textAlign: 'center', margin: '10px 0 16px' }}>
            Drag to compare · {gap} day{gap === 1 ? '' : 's'} apart
          </div>
          <div className="seg" style={{ display: 'flex', marginBottom: 10 }}>
            <button style={{ flex: 1 }} className={picking === 'a' ? 'on' : ''} onClick={() => setPicking('a')}>Choose “before”</button>
            <button style={{ flex: 1 }} className={picking === 'b' ? 'on' : ''} onClick={() => setPicking('b')}>Choose “after”</button>
          </div>
          <div className="photo-strip">
            {photos.map((p) => (
              <div key={p.id} className={`pick ${p.id === (picking === 'a' ? a.id : b.id) ? 'on' : ''}`}>
                <Thumb photo={p} size={64} onClick={() => (picking === 'a' ? setA(p.id) : setB(p.id))} />
              </div>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
