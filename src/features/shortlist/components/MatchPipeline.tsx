import { useEffect, useState } from "react";
import { Check, GitCompare, History, Play, Sparkles, X, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "../../../components/ui";
import type { RunStatus, Stage } from "../../../types/api";

const STEPS: { stage: Stage; label: string; icon: LucideIcon }[] = [
  { stage: "created", label: "Started", icon: Play },
  { stage: "collecting", label: "Comparing resumes", icon: GitCompare },
  { stage: "reading", label: "Earlier scores", icon: History },
  { stage: "scoring", label: "AI scoring", icon: Sparkles },
  { stage: "shortlisted", label: "Done", icon: Check },
];

/** The matching run as an animated pipeline: the line fills as each step finishes, the current step pulses,
 *  and the live counts appear under the steps. */
export default function MatchPipeline({ status, running }: { status: RunStatus | undefined; running: boolean }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const failed = status?.stage === "failed";
  const partly = status?.stage === "partly_completed";
  const finished = Boolean(status?.finished);
  const reached = !status ? -1 : finished && !failed && !partly ? STEPS.length : Math.max(0, STEPS.findIndex((s) => s.stage === status.stage));
  const idx = failed || partly ? STEPS.length - 1 : reached;
  const fill = status ? Math.min(100, (Math.max(0, Math.min(idx, STEPS.length - 1)) / (STEPS.length - 1)) * 100 + (finished && !failed && !partly ? 0 : 0)) : 0;

  const caption = (stage: Stage): string | null => {
    if (!status) return null;
    if (stage === "collecting" && status.considered != null) return `${status.considered} compared`;
    if (stage === "reading" && status.pool != null) return `${status.pool} picked${status.from_cache ? ` · ${status.from_cache} scored before` : ""}`;
    if (stage === "scoring" && status.scored != null) return `${status.scored} scored${status.failed ? ` · ${status.failed} failed` : ""}`;
    if (stage === "shortlisted" && status.finished && status.seconds != null) return `${Math.round(status.seconds * 10) / 10}s`;
    return null;
  };

  return (
    <div className={`pipeline ${running ? "is-running" : ""}`}>
      <div className="pipeline-track" aria-hidden="true"><span className="pipeline-fill" style={{ width: `${finished && !failed && !partly ? 100 : fill}%` }} /></div>
      <ol className="pipeline-steps">
        {STEPS.map((step, i) => {
          const done = finished && !failed && !partly ? true : i < idx;
          const current = !finished && i === idx;
          const bad = (failed || partly) && i === STEPS.length - 1;
          const Icon = bad ? X : step.icon;
          const text = caption(step.stage);
          return (
            <li key={step.stage} className={`pipeline-step ${done ? "done" : ""} ${current ? "current" : ""} ${bad ? (failed ? "failed" : "partly") : ""}`}>
              <span className="pipeline-dot"><Icon size={16} /></span>
              <span className="pipeline-label">{step.label}</span>
              <span className="pipeline-caption">{text ?? (current && running ? "working…" : "")}</span>
            </li>
          );
        })}
      </ol>
      <div className="pipeline-foot">
        {running && <span className="pipeline-timer"><span className="spinner" /> Working · {elapsed}s</span>}
        {status?.finished && Boolean(status.scored) && !failed && (
          <span className="found-count pop-in"><AnimatedNumber value={status.scored ?? 0} /> resumes found</span>
        )}
        {failed && <span className="found-count" style={{ color: "var(--red-600)" }}>The run failed. Please try again.</span>}
        {partly && <span className="found-count" style={{ color: "var(--amber-600)" }}>Finished with some candidates not scored.</span>}
      </div>
    </div>
  );
}
