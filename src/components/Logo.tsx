/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";

/** The TalentIQ mark: a bold T with a spark (the "IQ"). `animated` makes the spark twinkle. */
export function LogoMark({ size = 34, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="TalentIQ">
      <rect width="64" height="64" rx="16" fill="#1D4ED8" />
      <rect x="16" y="16" width="32" height="9" rx="3" fill="#fff" />
      <rect x="28" y="16" width="8" height="32" rx="3" fill="#fff" />
      <path className={animated ? "logo-spark" : undefined} d="M47 35 L49.2 42.8 L57 45 L49.2 47.2 L47 55 L44.8 47.2 L37 45 L44.8 42.8 Z" fill="#7DD3FC" />
    </svg>
  );
}

/** Full-screen loading state: the logo with a twinkling spark and a short message. */
export function Splash({ message = "Loading…", children }: { message?: string; children?: ReactNode }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="splash-logo"><LogoMark size={72} animated /></div>
      <strong className="splash-name">Talent<b>IQ</b></strong>
      <span className="muted">{message}</span>
      {children}
    </div>
  );
}
