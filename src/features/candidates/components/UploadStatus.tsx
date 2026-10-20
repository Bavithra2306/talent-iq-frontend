import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CheckCircle2, X } from "lucide-react";
import { api } from "../../../services/api";
import type { BatchStatus } from "../../../types/api";

const STEP: Record<string, string> = {
  created: "Starting", collecting: "Collecting files", reading: "Reading resumes", scoring: "Working",
};

/** One-line status of the latest upload; details are in the Activity log. */
export default function UploadStatus({ batchId, onFinished, onClose }: {
  batchId: string; onFinished?: (s: BatchStatus) => void; onClose: () => void;
}) {
  const status = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => api.batchStatus(batchId),
    refetchInterval: (q) => (q.state.data?.finished ? false : 2500),
  });
  const s = status.data;
  const finished = Boolean(s?.finished);
  useEffect(() => {
    if (finished && s) onFinished?.(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  if (status.isError) return null;
  const otherFailures = s ? (s.failed ?? 0) - (s.needs_review ?? 0) : 0;
  return (
    <div className="upload-status">
      {!s || !finished ? (
        <span><span className="spinner" /> {s ? STEP[s.stage] ?? "Working" : "Starting"}{s?.total ? ` · ${s.total} file(s)` : ""}…</span>
      ) : (
        <span>
          <CheckCircle2 size={16} style={{ verticalAlign: -3, color: "var(--green-600)" }} /> Upload finished
          {s.saved !== null && <> · <strong>{s.saved}</strong> saved</>}
          {Boolean(s.needs_review) && <> · <strong>{s.needs_review}</strong> need your review</>}
          {otherFailures > 0 && <> · <strong>{otherFailures}</strong> could not be read</>}
          {s.seconds !== null && <> · {s.seconds}s</>}
        </span>
      )}
      <span className="row" style={{ gap: 8 }}>
        <Link to="/logs" className="small">Details in Activity log</Link>
        {finished && <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close"><X /></button>}
      </span>
    </div>
  );
}
