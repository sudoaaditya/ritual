import type { TouchEvent } from 'react';
import { markDone, markSkipped, snapshotLog } from './actions';
import { useUI } from './store';
import type { Item } from './types';

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Done / Skip with an Undo toast. */
export function useItemActions() {
  const ui = useUI();
  return {
    done: async (item: Item, date: string) => {
      const undo = await snapshotLog(item.id, date);
      await markDone(item, date, true);
      ui.toast(`${item.name} — done`, { label: 'Undo', run: undo });
    },
    skip: async (item: Item, date: string) => {
      const undo = await snapshotLog(item.id, date);
      await markSkipped(item, date);
      ui.toast(`${item.name} — skipped`, { label: 'Undo', run: undo });
    },
  };
}

/** Tiny canvas confetti burst. No dependency, respects reduced motion. */
export function confetti(colors = ['#ff7a8a', '#ffb340', '#ffd60a', '#34c759', '#64d2ff', '#bf5af2']) {
  if (reducedMotion()) return;
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  Object.assign(c.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '90' });
  document.body.appendChild(c);
  const ctx = c.getContext('2d')!;
  ctx.scale(dpr, dpr);
  const parts = Array.from({ length: 140 }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80,
    y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 13 - 4,
    r: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.4,
    w: 6 + Math.random() * 6,
    h: 8 + Math.random() * 8,
    color: colors[(Math.random() * colors.length) | 0],
  }));
  const start = performance.now();
  const frame = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.38;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - t / 1800);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
      ctx.restore();
    }
    if (t < 1800) requestAnimationFrame(frame);
    else c.remove();
  };
  requestAnimationFrame(frame);
}

/** Horizontal swipe detection that leaves vertical scrolling alone. */
export function swipeHandlers(onLeft: () => void, onRight: () => void, threshold = 50) {
  let x0 = 0;
  let y0 = 0;
  let active = false;
  return {
    onTouchStart: (e: TouchEvent) => {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      active = true;
    },
    onTouchEnd: (e: TouchEvent) => {
      if (!active) return;
      active = false;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onLeft : onRight)();
    },
  };
}
