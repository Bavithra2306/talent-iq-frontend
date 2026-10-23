import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/** Counts up to `value` when it appears or changes (respects reduced-motion). */
export function AnimatedNumber({ value, duration = 800, decimals = 0, suffix = "" }: {
  value: number | null | undefined; duration?: number; decimals?: number; suffix?: string;
}) {
  const target = value ?? 0;
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShown(target); return; }
    const start = performance.now();
    const begin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = begin + (target - begin) * eased;
      setShown(current);
      from.current = current;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  if (value === null || value === undefined) return <>—</>;
  return <>{shown.toFixed(decimals)}{suffix}</>;
}

/** Grey shimmering placeholder shown while data loads. */
export function Skeleton({ w = "100%", h = 14, r = 8, style }: { w?: number | string; h?: number | string; r?: number; style?: CSSProperties }) {
  return <span className="skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />;
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-rows" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row">
          <Skeleton w={36} h={36} r={18} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}><Skeleton w={`${55 + ((i * 13) % 30)}%`} /><Skeleton w="35%" h={10} /></div>
          <Skeleton w={70} h={26} r={13} />
        </div>
      ))}
    </div>
  );
}

/** True one frame after mount: lets bars and rings animate from zero. */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setM(true)); return () => cancelAnimationFrame(id); }, []);
  return m;
}

export interface Slice { label: string; value: number; color?: string }
export const PALETTE = ["#047857", "#D4A017", "#10B981", "#064E3B", "#F4C542", "#6EE7B7", "#64748B", "#B45309"];

/** Donut with a hover read-out in the middle. */
export function DonutChart({ data, size = 190, centerLabel = "total" }: { data: Slice[]; size?: number; centerLabel?: string }) {
  const mounted = useMounted();
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = size / 2 - 16;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const active = hover !== null ? data[hover] : null;
  return (
    <div className="donut" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Share by category">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ink-100)" strokeWidth={22} />
        {total > 0 && data.map((d, i) => {
          const len = (d.value / total) * c;
          const node = (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color ?? PALETTE[i % PALETTE.length]}
                    strokeWidth={hover === i ? 28 : 22} strokeDasharray={`${mounted ? len : 0} ${c}`} strokeDashoffset={-offset}
                    transform={`rotate(-90 ${size / 2} ${size / 2})`} className="donut-slice"
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <title>{d.label}: {d.value}</title>
            </circle>
          );
          offset += len;
          return node;
        })}
      </svg>
      <div className="donut-center">
        <strong><AnimatedNumber value={active ? active.value : total} /></strong>
        <span>{active ? active.label : centerLabel}</span>
      </div>
    </div>
  );
}

/** Horizontal bars that grow in; hovering dims the others. */
export function BarList({ data, onSelect }: { data: Slice[]; onSelect?: (label: string) => void }) {
  const mounted = useMounted();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="barlist">
      {data.map((d, i) => (
        <button key={d.label} type="button" className="barlist-row" onClick={() => onSelect?.(d.label)} disabled={!onSelect}>
          <span className="barlist-label"><i className="barlist-dot" style={{ background: d.color ?? PALETTE[i % PALETTE.length] }} />{d.label}</span>
          <span className="barlist-track">
            <span className="barlist-fill" style={{ width: mounted ? `${(d.value / max) * 100}%` : 0, background: d.color ?? PALETTE[i % PALETTE.length], transitionDelay: `${i * 60}ms` }} />
          </span>
          <span className="barlist-value"><AnimatedNumber value={d.value} /></span>
        </button>
      ))}
    </div>
  );
}

/** Stages of a funnel, each as wide as its share of the first stage, with the step-to-step conversion. */
export function Funnel({ steps }: { steps: Slice[] }) {
  const mounted = useMounted();
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className="funnel">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label} className="funnel-row">
            <span className="funnel-label">{s.label}</span>
            <span className="funnel-track">
              <span className="funnel-bar" style={{ width: mounted ? `${Math.max(4, (s.value / top) * 100)}%` : 0, background: s.color ?? PALETTE[i % PALETTE.length], transitionDelay: `${i * 90}ms` }}>
                <b><AnimatedNumber value={s.value} /></b>
              </span>
            </span>
            <span className="funnel-conv">{conv === null ? "" : `${conv}%`}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Small column chart (e.g. matching runs per day) with hover values. */
export function ColumnChart({ data, height = 120 }: { data: Slice[]; height?: number }) {
  const mounted = useMounted();
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="columns" style={{ height: height + 22 }}>
      {data.map((d, i) => (
        <div key={d.label} className="column" title={`${d.label}: ${d.value}`}>
          <span className="column-value">{d.value}</span>
          <span className="column-bar" style={{ height: mounted ? Math.max(3, (d.value / max) * height) : 3, transitionDelay: `${i * 50}ms` }} />
          <span className="column-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** A card that fades and rises into view; `delay` staggers a row of them. */
export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return <div className={`reveal ${className}`} style={{ animationDelay: `${delay}ms` }}>{children}</div>;
}
