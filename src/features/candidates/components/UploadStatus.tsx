import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, Circle, Loader2, X } from "lucide-react";
import { api } from "../../../services/api";
import type { BatchStatus } from "../../../types/api";

const STEPS = ["Uploaded", "Checking files", "Reading resumes", "Done"];

function currentStep(s: BatchStatus | undefined): number {
  if (!s) return 0;
  if (s.finished) return STEPS.length;
  return { created: 1, collecting: 1, reading: 2 }[s.stage as string] ?? 1;
}

/** What happened to the latest upload: the steps while it runs, then the counts and any failed files. */
export default function UploadStatus({ batchId, onFinished, onClose }: {
  batchId: string; onFinished?: (s: BatchStatus) => void; onClose: () => void;
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
  if (status.isError) return null;

  const step = currentStep(s);
  const updated = s?.updated_candidates ?? 0;
  return (
    <div className="upload-result">
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
          <div className="upload-counts">
            <span><strong>{s.total ?? 0}</strong> files uploaded</span>
            <span className="ok"><strong>{s.saved ?? 0}</strong> ready for shortlisting
              {updated > 0 && <> ({(s.saved ?? 0) - updated} new, {updated} updated)</>}</span>
            <span className={s.needs_review ? "warn" : ""}><strong>{s.needs_review ?? 0}</strong> not a resume</span>
            <span className={s.failed ? "bad" : ""}><strong>{s.failed ?? 0}</strong> failed to read</span>
            {s.seconds !== null && <span className="muted">{Math.round(s.seconds)}s</span>}
          </div>
          {Boolean(s.embeddings_pending) && (
            <p className="small muted" style={{ margin: 0 }}>
              {s.embeddings_pending} resume(s) are still being made searchable. They join matching automatically
              {s.embeddings_note?.includes("quota") ? " after today's free limit resets (around 05:30)" : " in a few minutes"}.
            </p>
          )}
          {Boolean(s.needs_review) && (
            <p className="small muted" style={{ margin: 0 }}>Files that are not resumes are listed under <strong>Needs your review</strong> below.</p>
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
