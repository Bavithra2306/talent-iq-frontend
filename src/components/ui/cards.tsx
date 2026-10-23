import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { AnimatedNumber, Reveal, Skeleton } from "./motion";

/** The one small card used across the dashboards: a number with a label, linking to its page. */
export function StatCard({ label, value, to, icon, delay = 0 }: { label: string; value: number | undefined; to: string; icon: ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <Link to={to} className="dash-card stat-card">
        <span className="stat-icon">{icon}</span>
        <span className="stat-text">
          <span className="stat-value">{value === undefined ? <Skeleton w={32} h={20} /> : <AnimatedNumber value={value} />}</span>
          <span className="stat-label">{label}</span>
        </span>
      </Link>
    </Reveal>
  );
}

/** The one small card used across the dashboards for charts and lists: a title, a short hint, then the content. */
export function DashCard({ title, hint, children, delay = 0, wide }: { title: string; hint?: string; children: ReactNode; delay?: number; wide?: boolean }) {
  return (
    <Reveal delay={delay} className={`chart-card-wrap ${wide ? "wide" : ""}`}>
      <div className="dash-card chart-card">
        <div className="chart-head"><h3>{title}</h3>{hint && <span className="muted small">{hint}</span>}</div>
        {children}
      </div>
    </Reveal>
  );
}
