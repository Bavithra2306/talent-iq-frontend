import { Check, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AnimatedNumber } from "./ui";

export type AgentState = "running" | "idle" | "done" | "attention" | "failed";

/** One agent in the agents panel: avatar, live status, its steps as a chain that lights up
 *  while it works, a few numbers and when it last ran. `active` is the step being worked on
 *  (`nodes.length` = every step finished, `-1` = none yet). */
export function AgentCard({ icon: Icon, name, role, state, stateLabel, nodes, active, stats, meter, footer }: {
  icon: LucideIcon;
  name: string;
  role: string;
  state: AgentState;
  stateLabel: string;
  nodes: string[];
  active: number;
  stats: { label: string; value: number | string }[];
  meter?: { pct: number; label: string };
  footer?: ReactNode;
}) {
  return (
    <article className={`agent-card ${state}`}>
      <header className="agent-head">
        <span className="agent-avatar"><Icon size={20} />{state === "running" && <i className="agent-ping" />}</span>
        <span className="agent-title"><strong>{name}</strong><small>{role}</small></span>
        <span className={`agent-state ${state}`}><i />{stateLabel}</span>
      </header>
      <ol className="agent-flow" aria-label={`${name} steps`}>
        {nodes.map((n, i) => {
          const status = i < active ? "done" : i === active && state === "running" ? "current" : "idle";
          return (
            <li key={n} className={`agent-step ${status}`} style={{ ["--i" as string]: i }}>
              <span className="agent-node">{status === "done" && <Check size={11} strokeWidth={3} />}</span>
              <em>{n}</em>
            </li>
          );
        })}
      </ol>
      <div className="agent-stats">
        {stats.map((s) => (
          <div key={s.label}>
            <strong>{typeof s.value === "number" ? <AnimatedNumber value={s.value} /> : s.value}</strong>
            <small>{s.label}</small>
          </div>
        ))}
      </div>
      {meter && (
        <div className="agent-meter" title={meter.label}>
          <span className="agent-meter-track"><span className={meter.pct > 85 ? "hot" : ""} style={{ width: `${meter.pct}%` }} /></span>
          <small className="muted">{meter.label}</small>
        </div>
      )}
      {footer && <footer className="agent-foot muted small">{footer}</footer>}
    </article>
  );
}
