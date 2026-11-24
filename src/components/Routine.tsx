import { ChevronLeft, Pause, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { markDone, markSkipped } from '../lib/actions';
import { logId } from '../lib/db';
import { confetti } from '../lib/feedback';
import { IconTile } from '../lib/icons';
import { isComplete, itemsOn } from '../lib/progress';
import { useData } from '../lib/store';
import { SLOTS, type Slot } from '../lib/types';
import { fmtDuration } from './ItemRow';
import { Ring } from './ui';

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    /* audio unavailable */
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    /* noop */
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.ceil(s % 60)) % 60).padStart(2, '0')}`;

/** Full-screen, one-step-at-a-time routine with optional per-step timers. */
export function RoutinePlayer({ slot, date, onClose }: { slot: Slot; date: string; onClose: () => void }) {
  const { items, logs, plans, ready } = useData();
  // Freeze the queue once data has loaded, so steps don't shift as they're completed.
  const [queue, setQueue] = useState<string[] | null>(null);
  useEffect(() => {
    if (ready && queue === null)
      setQueue(
        itemsOn(items, date)
          .filter((i) => i.slot === slot && !logs.get(logId(i.id, date)))
          .map((i) => i.id),
      );
  }, [ready, queue, items, logs, date, slot]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const steps = (queue ?? []).map((id) => byId.get(id)).filter(Boolean) as NonNullable<ReturnType<typeof byId.get>>[];
  const [idx, setIdx] = useState(0);
  const step = steps[idx];
  const finished = idx >= steps.length;

  // ---- timer (end-timestamp based so it stays right if the screen sleeps) ----
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState(step?.timer ?? 0);
  const [paused, setPaused] = useState<number | null>(null);
  const firedRef = useRef(false);
  useEffect(() => {
    setEndAt(null);
    setPaused(null);
    setLeft(step?.timer ?? 0);
    firedRef.current = false;
  }, [step?.id, step?.timer]);
  useEffect(() => {
    if (!endAt) return;
    const id = window.setInterval(() => {
      const l = (endAt - Date.now()) / 1000;
      setLeft(Math.max(0, l));
      if (l <= 0 && !firedRef.current) {
        firedRef.current = true;
        setEndAt(null);
        beep();
      }
    }, 200);
    return () => clearInterval(id);
  }, [endAt]);

  // keep the screen awake during a routine
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } }).wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => undefined);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      lock?.release().catch(() => undefined);
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    if (queue && finished && steps.length) confetti();
  }, [queue, finished, steps.length]);

  const go = async (kind: 'done' | 'skip') => {
    if (!step) return;
    if (kind === 'done') await markDone(step, date, true);
    else await markSkipped(step, date);
    setIdx((i) => i + 1);
  };

  const slotLabel = SLOTS.find((s) => s.id === slot)?.label ?? '';
  const color = step?.color ?? '#30d158';
  const running = endAt !== null;
  const total = step?.timer ?? 0;
  const timerDone = total > 0 && left <= 0;

  const doneCount = steps.filter((s) => isComplete(s, logs.get(logId(s.id, date)))).length;
  const skipCount = steps.filter((s) => logs.get(logId(s.id, date))?.status === 'skipped').length;

  return (
    <div className="routine" style={{ ['--c' as string]: color }}>
      <div className="routine-top">
        <button className="pill-btn icon glass" onClick={onClose} aria-label="Close routine">
          <X size={22} />
        </button>
        <div className="grow" style={{ textAlign: 'center', fontWeight: 700 }}>
          {slotLabel} routine
          {!finished && steps.length > 0 && (
            <div className="muted small num">
              Step {idx + 1} of {steps.length}
            </div>
          )}
        </div>
        <button className="pill-btn icon glass" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0 || finished} aria-label="Previous step" style={{ opacity: idx === 0 || finished ? 0.3 : 1 }}>
          <ChevronLeft size={22} />
        </button>
      </div>
      <div className="routine-bar">
        {steps.map((s, i) => (
          <i key={s.id} className={i < idx ? 'past' : i === idx ? 'cur' : ''} style={{ ['--c' as string]: s.color }} />
        ))}
      </div>

      {queue === null ? (
        <div className="routine-body" />
      ) : steps.length === 0 ? (
        <div className="routine-body">
          <h2>Nothing left here</h2>
          <p className="muted">Everything in this part of the day is already done or skipped.</p>
          <button className="btn primary" onClick={onClose}>Close</button>
        </div>
      ) : finished ? (
        <div className="routine-body">
          <div style={{ fontSize: 64 }}>✨</div>
          <h2>{slotLabel} routine complete</h2>
          <p className="muted">
            {doneCount} done{skipCount ? ` · ${skipCount} skipped` : ''}
          </p>
          <button className="btn primary" style={{ background: 'var(--green)', minWidth: 200 }} onClick={onClose}>
            Finish
          </button>
        </div>
      ) : (
        <div className="routine-body" key={step.id}>
          {total > 0 ? (
            <button
              className="timer-ring"
              onClick={() => {
                if (timerDone) return;
                if (running) {
                  setPaused(left);
                  setEndAt(null);
                } else setEndAt(Date.now() + (paused ?? left) * 1000);
              }}
              aria-label={running ? 'Pause timer' : 'Start timer'}
            >
              <Ring value={total ? 1 - left / total : 0} size={220} stroke={12} color={color} track={`color-mix(in srgb, ${color} 18%, transparent)`} />
              <div className="timer-inner">
                <IconTile name={step.icon} color={step.color} size={52} />
                <div className="num timer-text">{timerDone ? 'Done!' : mmss(left)}</div>
                <div className="muted small">{timerDone ? 'Time’s up' : running ? 'Tap to pause' : paused !== null ? 'Paused' : 'Tap to start'}</div>
              </div>
            </button>
          ) : (
            <div className="step-icon">
              <IconTile name={step.icon} color={step.color} size={120} />
            </div>
          )}
          <div className="muted small" style={{ marginTop: 18 }}>
            {plans.find((p) => p.id === step.planId)?.name}
            {total ? ` · ${fmtDuration(total)}` : ''}
          </div>
          <h2>{step.name}</h2>
          {step.notes && <p className="muted step-notes">{step.notes}</p>}
          {total > 0 && !running && (paused !== null || timerDone) && (
            <button
              className="pill-btn"
              style={{ fontSize: 15 }}
              onClick={() => {
                setEndAt(null);
                setPaused(null);
                setLeft(total);
                firedRef.current = false;
              }}
            >
              <RotateCcw size={15} /> Reset timer
            </button>
          )}
          {total > 0 && !running && paused === null && !timerDone && (
            <button className="pill-btn" style={{ fontSize: 15 }} onClick={() => setEndAt(Date.now() + left * 1000)}>
              <Play size={15} fill="currentColor" /> Start timer
            </button>
          )}
          {running && (
            <button className="pill-btn" style={{ fontSize: 15 }} onClick={() => { setPaused(left); setEndAt(null); }}>
              <Pause size={15} /> Pause
            </button>
          )}
        </div>
      )}

      {queue && !finished && steps.length > 0 && (
        <div className="routine-actions">
          <button className="btn secondary" onClick={() => go('skip')}>
            Skip
          </button>
          <button className="btn primary" style={{ background: color }} onClick={() => go('done')}>
            {idx === steps.length - 1 ? 'Done · finish' : 'Done · next'}
          </button>
        </div>
      )}
    </div>
  );
}
