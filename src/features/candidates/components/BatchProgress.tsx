import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Alert, StageTimeline } from "../../../components/ui";
import type { BatchStatus, Stage } from "../../../types/api";

const STAGES: Stage[] = ["created", "collecting", "reading"];

function friendlyNote(note: string, pending: number): string {
  const when = note.match(/after ([^.]+)\./)?.[1];
  if (/quota/i.test(note)) {
    return `Today's free AI search limit is used up. ${pending} resume(s) are saved and read; they join matching once added to search${when ? ` after ${when}` : " tomorrow"}.`;
  }
  return `${pending} resume(s) are being added to search.`;
}

/** Polls an ingestion/sourcing batch until it finishes and shows its stage timeline. */
export default function BatchProgress({ batchId, fetchStatus, onFinished, onChange }: {
  batchId: string;
  fetchStatus: (id: string) => Promise<BatchStatus>;
  onFinished?: (status: BatchStatus) => void;
  onChange?: () => void; // the counts moved: reload the lists that show the results
}) {
  const status = useQuery({
    queryKey: ["batch", batchId],
    queryFn: () => fetchStatus(batchId),
    refetchInterval: (q) => (q.state.data?.finished && !q.state.data.embeddings_pending ? false : 2500),
  });
  const data = status.data;
  const finished = Boolean(data?.finished);

  useEffect(() => {
    if (finished && data) onFinished?.(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // Reload the result lists whenever the counts change while the batch runs, so nothing waits for a page refresh.
  useEffect(() => {
    if (data) onChange?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.saved, data?.needs_review, data?.failed, data?.stage]);

  if (!data) return <div className="loading"><span className="spinner" /> Starting…</div>;
  return (
    <div className="stack">
      <StageTimeline stages={STAGES} current={data.stage} finished={finished} events={data.events} />
      <div className="row">
        {data.total !== null && <span className="badge plain">{data.total} files</span>}
        {data.saved !== null && <span className="badge green">{data.saved} saved</span>}
        {Boolean(data.needs_review) && <span className="badge amber">{data.needs_review} waiting for your review</span>}
        {Boolean(data.failed) && <span className="badge red">{data.failed} failed</span>}
        {data.seconds !== null && <span className="badge plain">{data.seconds}s</span>}
        {Boolean(data.embeddings_pending) && <span className="badge amber">{data.embeddings_pending} being added to search</span>}
      </div>
      {data.embeddings_note && <Alert tone="warn">{friendlyNote(data.embeddings_note, data.embeddings_pending ?? 0)}</Alert>}
      {Boolean(data.review?.length) && (
        <div className="file-list">
          <strong className="small">Waiting for your review</strong>
          {data.review!.map((f, i) => (
            <div key={i} className="file-item"><span>{f.filename}</span><span className="muted">{f.reason.replace(" Waiting for your review.", "")}</span></div>
          ))}
        </div>
      )}
      {data.failures.length > 0 && (
        <div className="file-list">
          {data.failures.map((f, i) => (
            <div key={i} className="file-item"><span>{f.filename}</span><span className="muted">{f.reason}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}
