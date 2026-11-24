import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

export function Ring({
  value,
  size = 42,
  stroke = 4,
  color = 'var(--green)',
  track = 'color-mix(in srgb, var(--green) 22%, transparent)',
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      {v > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      )}
      {children}
    </svg>
  );
}

export function Sheet({
  title,
  onClose,
  left,
  right,
  children,
}: {
  title?: string;
  onClose: () => void;
  left?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  // Drag the handle/header down to dismiss.
  const [dy, setDy] = useState(0);
  const start = useRef<number | null>(null);
  const handle = {
    onPointerDown: (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      start.current = e.clientY;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent) => {
      if (start.current !== null) setDy(Math.max(0, e.clientY - start.current));
    },
    onPointerUp: () => {
      if (start.current === null) return;
      start.current = null;
      if (dy > 110) onClose();
      else setDy(0);
    },
  };
  return (
    <>
      <div className="backdrop" onClick={onClose} style={{ opacity: dy ? Math.max(0.2, 1 - dy / 400) : undefined }} />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: start.current !== null ? 'none' : 'transform 0.25s ease' }}
      >
        <div className="sheet-handle" {...handle}>
        <div className="grab" />
        <div className="sh-head">
          <div style={{ minWidth: 80 }}>{left ?? <button className="pill-btn" onClick={onClose}>Close</button>}</div>
          <h2>{title}</h2>
          <div style={{ minWidth: 80, textAlign: 'right' }}>{right}</div>
        </div>
        </div>
        <div className="sh-body">{children}</div>
      </div>
    </>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="toggle" aria-label={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <span className="stepper">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} aria-label="decrease">−</button>
      <span className="num">{value}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} aria-label="increase">+</button>
    </span>
  );
}

export function DayRing({
  day,
  ratio,
  due,
  selected,
  future,
  onClick,
  size = 42,
}: {
  day: number | string;
  ratio: number;
  due: boolean;
  selected?: boolean;
  future?: boolean;
  onClick?: () => void;
  size?: number;
}) {
  return (
    <button className={`ring-day ${selected ? 'sel' : ''} ${future ? 'future' : ''}`} style={{ width: size, height: size }} onClick={onClick}>
      <Ring
        value={due ? ratio : 0}
        size={size}
        stroke={3.5}
        track={due ? 'color-mix(in srgb, var(--green) 24%, transparent)' : 'transparent'}
      />
      <span className="num">{day}</span>
    </button>
  );
}
