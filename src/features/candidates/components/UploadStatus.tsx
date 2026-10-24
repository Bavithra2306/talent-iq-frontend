import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, PartyPopper, X } from "lucide-react";
import { AnimatedNumber } from "../../../components/ui";
import { api } from "../../../services/api";
import type { BatchStatus } from "../../../types/api";

const STEPS = ["Uploaded", "Checking files", "Reading resumes", "Done"];

function currentStep(s: BatchStatus | undefined): number {
  if (!s) return 0;
  if (s.finished) return STEPS.length;
  return { created: 1, collecting: 1, reading: 2 }[s.stage as string] ?? 1;
}

/** What happened to the latest upload: the steps while it runs, then the counts and any failed files. */
export default function UploadStatus({ batchId, onFinished, onChange, onClose }: {
  batchId: string; onFinished?: (s: BatchStatus) => void; onChange?: () => void; onClose: () => void;
}) {
  const status = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => api.batchStatus(batchId),
    // Keep polling after the run while resumes are still being made searchable.
    refetchInterval: (q) => (q.state.data?.finished && !q.state.data.embeddings_pending ? false : 5000),
  });
  const s = status.data;
  const finished = Boolean(s?.finished);
  useEffect(() => {
    if (finished && s) onFinished?.(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);
  // Reload the result lists as the counts move, so nothing waits for a page refresh.
  useEffect(() => {
    if (s) onChange?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s?.saved, s?.needs_review, s?.failed, s?.stage]);
  if (status.isError) return null;

  const step = currentStep(s);
  const updated = s?.updated_candidates ?? 0;
  const percent = finished ? 100 : Math.round((step / STEPS.length) * 100);
  return (
    <div className={`upload-result ${finished ? "is-done" : "is-running"}`}>
      <div className="upload-bar slim"><span style={{ width: `${Math.max(8, percent)}%` }} /></div>
      <div className="spread">
        <div className="stages">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step && !finished;
            return (
              <div key={label} className="row" style={{ gap: 0 }}>
                {i > 0 && <span className="stage-line" />}
                <span className={`stage ${done ? "done" : current ? "current" : ""}`}>
                  <span className="dot">{done ? <CheckCircle2 /> : current ? <Loader2 className="spin-icon" /> : <Circle />}</span>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <span className="row" style={{ gap: 8 }}>
          <Link to="/logs" className="small">Activity log</Link>
          {finished && <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X /></button>}
        </span>
      </div>

      {s && finished && (
        <>
          <div className="done-banner"><PartyPopper size={18} /> Done{s.seconds !== null && <span className="muted"> in {Math.round(s.seconds)}s</span>}</div>
          <div className="count-tiles">
            <div className="count-tile"><strong><AnimatedNumber value={s.total ?? 0} /></strong><span>files uploaded</span></div>
            <div className="count-tile ok"><strong><AnimatedNumber value={s.saved ?? 0} /></strong><span>ready for matching{updated > 0 && ` (${(s.saved ?? 0) - updated} new, ${updated} updated)`}</span></div>
            <div className={`count-tile ${s.needs_review ? "warn" : ""}`}><strong><AnimatedNumber value={s.needs_review ?? 0} /></strong><span>waiting for your review</span></div>
            <div className={`count-tile ${s.failed ? "bad" : ""}`}><strong><AnimatedNumber value={s.failed ?? 0} /></strong><span>failed to read</span></div>
          </div>
          {Boolean(s.embeddings_pending) && (
            <p className="small muted" style={{ margin: 0 }}>
              {s.embeddings_pending} resume(s) are still being made searchable. They join matching automatically
              {s.embeddings_note?.includes("quota") ? " after today's free limit resets (around 05:30)" : " in a few minutes"}.
            </p>
          )}
          {Boolean(s.needs_review) && (
            <p className="small muted" style={{ margin: 0 }}>These resumes need your decision: see <strong>Waiting for your decision</strong> and <strong>Needs your review</strong> below.</p>
          )}
          {s.failures.length > 0 && (
            <div className="failed-files">
              <strong>Could not be read</strong>
              <ul>{s.failures.map((f, i) => <li key={`${f.filename}-${i}`}>{f.filename} — {f.reason}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
