import { useMemo, useState, type DragEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Eye, FileText, GripVertical, X } from "lucide-react";
import {
  Alert, AnimatedNumber, Drawer, Empty, ScoreRing, Skeleton, useToast,
} from "../../../components/ui";
import { PageHeader } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears } from "../../../utils/format";
import type { ShortlistEntry } from "../../../types/api";
import EntryDetail from "../../shortlist/components/EntryDetail";

type ColumnKey = "review" | "approved" | "rejected";

const COLUMNS: { key: ColumnKey; title: string; tone: string; hint: string; drop?: "approved" | "rejected" }[] = [
  { key: "review", title: "To review", tone: "amber", hint: "Waiting for your decision" },
  { key: "approved", title: "Approved", tone: "green", hint: "Drop here to approve", drop: "approved" },
  { key: "rejected", title: "Rejected", tone: "red", hint: "Drop here to reject", drop: "rejected" },
];

function columnOf(e: ShortlistEntry): ColumnKey {
  if (e.status === "approved") return "approved";
  if (e.status === "rejected") return "rejected";
  return "review";
}

/** Hiring manager: candidates recruiters shared with me, as a board. */
export default function ReviewPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState("");
  const [open, setOpen] = useState<ShortlistEntry | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<ColumnKey | null>(null);

  const all = useQuery({ queryKey: ["review", "all"], queryFn: () => api.sharedWithMe({}) });
  const shared = useMemo(() => (all.data ?? []).filter((e) => !jobId || e.job_id === jobId), [all.data, jobId]);
  const byColumn = useMemo(() => {
    const map: Record<ColumnKey, ShortlistEntry[]> = { review: [], approved: [], rejected: [] };
    for (const e of shared) map[columnOf(e)].push(e);
    for (const list of Object.values(map)) list.sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
    return map;
  }, [shared]);
  const jobs = useMemo(() => {
    const map = new Map<string, { title: string; total: number; pending: number }>();
    for (const e of all.data ?? []) {
      const j = map.get(e.job_id) ?? { title: e.job_title ?? "Job", total: 0, pending: 0 };
      j.total += 1;
      if (columnOf(e) === "review") j.pending += 1;
      map.set(e.job_id, j);
    }
    return [...map.entries()];
  }, [all.data]);

  const decide = useMutation({
    mutationFn: ({ entry, decision }: { entry: ShortlistEntry; decision: "approved" | "rejected" }) => api.decide(entry.id, decision, ""),
    // Move the card at once; roll back if the server says no.
    onMutate: async ({ entry, decision }) => {
      await queryClient.cancelQueries({ queryKey: ["review", "all"] });
      const before = queryClient.getQueryData<ShortlistEntry[]>(["review", "all"]);
      queryClient.setQueryData<ShortlistEntry[]>(["review", "all"], (list) => list?.map((x) => (x.id === entry.id ? { ...x, status: decision } : x)));
      return { before };
    },
    onSuccess: (e) => toast(`${e.name ?? "Candidate"} ${e.status}.`, "success"),
    onError: (err, _vars, ctx) => {
      if (ctx?.before) queryClient.setQueryData(["review", "all"], ctx.before);
      toast(errorMessage(err), "error");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["review"] }),
  });

  const reject = (e: ShortlistEntry) => {
    if (window.confirm(`Reject ${e.name ?? "this candidate"}?`)) decide.mutate({ entry: e, decision: "rejected" });
  };
  const onDrop = (ev: DragEvent, target: "approved" | "rejected") => {
    ev.preventDefault();
    setOver(null);
    const id = ev.dataTransfer.getData("text/plain") || dragging;
    setDragging(null);
    const entry = shared.find((x) => x.id === id);
    if (!entry || entry.status === target) return;
    if (target === "rejected") reject(entry); else decide.mutate({ entry, decision: "approved" });
  };

  const total = shared.length;
  const reviewed = total - byColumn.review.length;

  return (
    <>
      <PageHeader title="Review candidates" subtitle="Drag a candidate into Approved or Rejected, or use the buttons." />

      {all.isLoading && <div className="board"><Skeleton h={260} r={14} /><Skeleton h={260} r={14} /><Skeleton h={260} r={14} /></div>}
      {all.isError && <Alert tone="error">{errorMessage(all.error)}</Alert>}

      {all.data && total === 0 && !jobId && (
        <div className="card"><Empty title="Nothing here" icon={<ClipboardCheck />}>When a recruiter shares candidates with you, they appear here.</Empty></div>
      )}

      {all.data && all.data.length > 0 && (
        <>
          <div className="review-top">
            <div className="chips">
              <button className={`chip ${jobId === "" ? "active" : ""}`} onClick={() => setJobId("")}>All jobs <span className="count">{all.data.length}</span></button>
              {jobs.map(([id, j]) => (
                <button key={id} className={`chip ${jobId === id ? "active" : ""}`} onClick={() => setJobId(jobId === id ? "" : id)}>
                  {j.title} {j.pending > 0 && <span className="count">{j.pending} to review</span>}
                </button>
              ))}
            </div>
            <div className="review-progress" title={`${reviewed} of ${total} reviewed`}>
              <span className="muted small"><strong><AnimatedNumber value={reviewed} /></strong> of {total} reviewed</span>
              <span className="upload-bar slim"><span style={{ width: `${total ? (reviewed / total) * 100 : 0}%` }} /></span>
            </div>
          </div>

          <div className="board">
            {COLUMNS.map((col) => {
              const list = byColumn[col.key];
              const droppable = Boolean(col.drop);
              return (
                <section key={col.key} className={`board-col tone-${col.tone} ${over === col.key ? "over" : ""} ${dragging && droppable ? "can-drop" : ""}`}
                         onDragOver={droppable ? (ev) => { ev.preventDefault(); setOver(col.key); } : undefined}
                         onDragLeave={droppable ? () => setOver((o) => (o === col.key ? null : o)) : undefined}
                         onDrop={col.drop ? (ev) => onDrop(ev, col.drop!) : undefined}>
                  <header className="board-head">
                    <span className={`board-dot ${col.tone}`} />
                    <strong>{col.title}</strong>
                    <span className="board-count"><AnimatedNumber value={list.length} duration={400} /></span>
                  </header>
                  <div className="board-list">
                    {list.length === 0 && <div className="board-empty muted small">{dragging && droppable ? col.hint : "Nobody here"}</div>}
                    {list.map((e) => (
                      <ReviewCard key={e.id} entry={e} dragging={dragging === e.id} busy={decide.isPending}
                                  onDragStart={(ev) => { ev.dataTransfer.setData("text/plain", e.id); ev.dataTransfer.effectAllowed = "move"; setDragging(e.id); }}
                                  onDragEnd={() => { setDragging(null); setOver(null); }}
                                  onDetails={() => setOpen(e)}
                                  onApprove={() => decide.mutate({ entry: e, decision: "approved" })}
                                  onReject={() => reject(e)} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      {open && (
        <Drawer title="Candidate details" onClose={() => setOpen(null)} half>
          <EntryDetail entry={open} onOpenResume={() => openFile(`/api/v1/review/${open.id}/resume`, open.name ?? "Resume")} />
        </Drawer>
      )}
    </>
  );
}

function ReviewCard({ entry: e, dragging, busy, onDragStart, onDragEnd, onDetails, onApprove, onReject }: {
  entry: ShortlistEntry; dragging: boolean; busy: boolean;
  onDragStart: (ev: DragEvent) => void; onDragEnd: () => void; onDetails: () => void; onApprove: () => void; onReject: () => void;
}): ReactNode {
  return (
    <article className={`kanban-card ${dragging ? "dragging" : ""}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="kanban-top">
        <GripVertical size={14} className="grip" />
        <ScoreRing value={e.total_score} />
        <div className="kanban-who">
          <strong title={e.name ?? ""}>{e.name ?? "Name not given"}</strong>
          <span className="muted small">{[e.current_title, formatYears(e.total_years_experience)].filter((x) => x && x !== "—").join(" · ")}</span>
          <span className="muted small">For: {e.job_title}</span>
        </div>
      </div>
      {e.explanation?.summary && <p className="kanban-summary small">{e.explanation.summary}</p>}
      {Boolean(e.explanation?.strengths?.length || e.explanation?.gaps?.length) && (
        <div className="chips">
          {e.explanation?.strengths?.slice(0, 2).map((s) => <span key={s} className="tag green">+ {s}</span>)}
          {e.explanation?.gaps?.slice(0, 1).map((s) => <span key={s} className="tag red">− {s}</span>)}
        </div>
      )}
      {e.notes_by_recruiter && <div className="notes small"><strong>Recruiter’s note:</strong> {e.notes_by_recruiter}</div>}
      <div className="kanban-actions">
        <button className="btn btn-sm" onClick={onDetails}><Eye /> Details</button>
        <button className="btn btn-sm" onClick={() => openFile(`/api/v1/review/${e.id}/resume`, e.name ?? "Resume")}><FileText /> Resume</button>
        <span style={{ flex: 1 }} />
        <button className="btn btn-sm btn-success btn-icon" title="Approve" aria-label="Approve" disabled={e.status === "approved" || busy} onClick={onApprove}><Check /></button>
        <button className="btn btn-sm btn-danger btn-icon" title="Reject" aria-label="Reject" disabled={e.status === "rejected" || busy} onClick={onReject}><X /></button>
      </div>
    </article>
  );
}
