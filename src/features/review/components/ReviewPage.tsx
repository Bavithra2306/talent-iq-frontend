import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, Check, ClipboardCheck, Eye, FileText, X } from "lucide-react";
import {
  Alert, Drawer, Empty, Loading, Modal, PageHeader, ScoreRing, StatusBadge, useToast,
} from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears } from "../../../utils/format";
import type { ShortlistEntry } from "../../../types/api";
import EntryDetail from "../../shortlist/components/EntryDetail";

const TABS = [
  { value: "", label: "All" },
  { value: "shortlisted", label: "To review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "interview_scheduled", label: "Interview scheduled" },
];

/** Hiring manager: candidates recruiters shared with me. */
export default function ReviewPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("shortlisted");
  const [open, setOpen] = useState<ShortlistEntry | null>(null);
  const [rejecting, setRejecting] = useState<ShortlistEntry | null>(null);

  const all = useQuery({ queryKey: ["review", "all"], queryFn: () => api.sharedWithMe({}) });
  const entries = useQuery({ queryKey: ["review", jobId, status], queryFn: () => api.sharedWithMe({ job_id: jobId, status }) });
  const jobs = useMemo(() => {
    const map = new Map<string, { title: string; total: number; pending: number }>();
    for (const e of all.data ?? []) {
      const j = map.get(e.job_id) ?? { title: e.job_title ?? "Job", total: 0, pending: 0 };
      j.total += 1;
      if (e.status === "shortlisted") j.pending += 1;
      map.set(e.job_id, j);
    }
    return [...map.entries()];
  }, [all.data]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["review"] });
  const decide = useMutation({
    mutationFn: ({ entry, decision, comment }: { entry: ShortlistEntry; decision: "approved" | "rejected"; comment: string }) =>
      api.decide(entry.id, decision, comment),
    onSuccess: (e) => { refresh(); setRejecting(null); toast(`${e.name ?? "Candidate"} ${e.status}.`, "success"); },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const interview = useMutation({
    mutationFn: (entry: ShortlistEntry) => api.scheduleInterview(entry.id),
    onSuccess: (e) => { refresh(); toast(`Interview marked as scheduled for ${e.name ?? "the candidate"}.`, "success"); },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  return (
    <>
      <PageHeader title="Review candidates" subtitle="Candidates that recruiters have shared with you. Approve or reject each one — the recruiter sees your decision straight away." />

      {jobs.length > 0 && (
        <div className="grid grid-3" style={{ marginBottom: 16 }}>
          {jobs.map(([id, j]) => (
            <div key={id} className={`card card-pad ${jobId === id ? "source-card selected" : ""}`}>
              <div className="spread">
                <button className="btn btn-ghost" style={{ padding: 0, height: "auto" }} onClick={() => setJobId(jobId === id ? "" : id)}>
                  <span className="cell-title">{j.title}</span>
                </button>
                <span className={`badge ${j.pending ? "amber" : "green"}`}>{j.pending ? `${j.pending} to review` : "All reviewed"}</span>
              </div>
              <div className="cell-sub" style={{ margin: "4px 0 10px" }}>{j.total} candidate(s) shared with you</div>
            </div>
          ))}
        </div>
      )}

      <div className="tabs">
        {TABS.map((t) => (
          <button key={t.value} className={`tab ${status === t.value ? "active" : ""}`} onClick={() => setStatus(t.value)}>{t.label}</button>
        ))}
      </div>

      {entries.isLoading && <Loading />}
      {entries.isError && <Alert tone="error">{errorMessage(entries.error)}</Alert>}
      {entries.data?.length === 0 && (
        <div className="card"><Empty title="Nothing here" icon={<ClipboardCheck />}>When a recruiter shares candidates with you, they appear here.</Empty></div>
      )}
      <div className="grid grid-2">
        {entries.data?.map((e) => (
          <div key={e.id} className="card candidate-card">
            <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
              <ScoreRing value={e.total_score} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="spread"><strong>{e.name ?? "Name not given"}</strong><StatusBadge status={e.status} /></div>
                <div className="muted small">{[e.current_title, formatYears(e.total_years_experience), e.location].filter((x) => x && x !== "—").join(" · ")}</div>
                <div className="muted small">For: {e.job_title}</div>
              </div>
            </div>
            {e.explanation?.summary && <p className="small" style={{ lineHeight: 1.6 }}>{e.explanation.summary}</p>}
            {e.notes_by_recruiter && <div className="notes"><strong>Recruiter’s note:</strong> {e.notes_by_recruiter}</div>}
            <div className="row">
              <button className="btn btn-sm" onClick={() => setOpen(e)}><Eye /> Details</button>
              <button className="btn btn-sm" onClick={() => void openFile(`/api/v1/review/${e.id}/resume`)}><FileText /> Resume</button>
              <span style={{ flex: 1 }} />
              {e.status !== "interview_scheduled" && (
                <>
                  <button className="btn btn-sm btn-success" disabled={e.status === "approved" || decide.isPending}
                          onClick={() => decide.mutate({ entry: e, decision: "approved", comment: "" })}><Check /> Approve</button>
                  <button className="btn btn-sm btn-danger" disabled={e.status === "rejected" || decide.isPending}
                          onClick={() => setRejecting(e)}><X /> Reject</button>
                </>
              )}
              {e.status === "approved" && (
                <button className="btn btn-sm btn-primary" disabled={interview.isPending} onClick={() => interview.mutate(e)}>
                  <CalendarCheck /> Schedule interview
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <Drawer title="Candidate details" onClose={() => setOpen(null)}>
          <EntryDetail entry={open} onOpenResume={() => void openFile(`/api/v1/review/${open.id}/resume`)} />
        </Drawer>
      )}
      {rejecting && (
        <RejectModal entry={rejecting} busy={decide.isPending} onClose={() => setRejecting(null)}
                     onConfirm={(comment) => decide.mutate({ entry: rejecting, decision: "rejected", comment })} />
      )}
    </>
  );
}

function RejectModal({ entry, busy, onClose, onConfirm }: {
  entry: ShortlistEntry; busy: boolean; onClose: () => void; onConfirm: (comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  return (
    <Modal title={`Reject ${entry.name ?? "candidate"}?`} onClose={onClose}
           footer={<><button className="btn" onClick={onClose}>Cancel</button>
             <button className="btn btn-danger" disabled={busy} onClick={() => onConfirm(comment)}>Reject</button></>}>
      <div className="field"><label htmlFor="why">Reason (optional, shared with the recruiter)</label>
        <textarea id="why" className="textarea" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="e.g. Needs more FastAPI experience" /></div>
    </Modal>
  );
}
