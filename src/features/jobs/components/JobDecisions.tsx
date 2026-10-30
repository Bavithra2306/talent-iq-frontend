import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, FileText, Users } from "lucide-react";
import { Alert, Empty, Loading, Modal, ScoreBar, StatusBadge } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears } from "../../../utils/format";
import type { CandidateStatus, ShortlistEntry } from "../../../types/api";
import EntryDetail from "../../shortlist/components/EntryDetail";

/** What the hiring manager sees per status ("shortlisted" means shared and waiting for their decision). */
const VIEWS: { value: "" | CandidateStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "interview_scheduled", label: "Interview scheduled" },
  { value: "shortlisted", label: "Waiting for you" },
];

/** Job page for a hiring manager: the candidates of this job shared with them, and what they decided.
 *  A row opens the match explanation in a centre panel with the resume. */
export default function JobDecisions({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<"" | CandidateStatus>("");
  const [openEntry, setOpenEntry] = useState<ShortlistEntry | null>(null);
  const shared = useQuery({ queryKey: ["review", "job", jobId], queryFn: () => api.sharedWithMe({ job_id: jobId }) });

  const items = shared.data ?? [];
  const count = (value: string) => (value ? items.filter((e) => e.status === value).length : items.length);
  const rows = status ? items.filter((e) => e.status === status) : items;
  const openResume = (e: ShortlistEntry) => openFile(`/api/v1/review/${e.id}/resume`, e.name ?? "Resume");
  const waiting = count("shortlisted");

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div><h2><Users size={18} style={{ verticalAlign: -3 }} /> Candidates shared with you</h2>
          <p>The candidates the recruiter sent you for this job and what you decided. Click a candidate to see why they got their score.</p></div>
        {waiting > 0 && <Link className="btn btn-primary" to="/review"><ClipboardCheck /> Review {waiting} waiting</Link>}
      </div>
      <div className="toolbar slim">
        <select className="select status-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as "" | CandidateStatus)}>
          {VIEWS.map((v) => <option key={v.value || "all"} value={v.value}>Status: {v.label} ({shared.data ? count(v.value) : "…"})</option>)}
        </select>
      </div>

      {shared.isLoading && <Loading />}
      {shared.isError && <div className="card-body"><Alert tone="error">{errorMessage(shared.error)}</Alert></div>}
      {shared.data && rows.length === 0 && (
        <Empty title={items.length ? "No candidates with this status" : "Nothing shared with you yet"} icon={<Users />}>
          {items.length ? "Pick another status." : "When the recruiter shares candidates for this job, they appear here."}
        </Empty>
      )}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Candidate</th><th>Score</th><th>Status</th><th>Resume</th></tr></thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => setOpenEntry(e)}>
                  <td><div className="cell-title">{e.name ?? "Name not given"}</div>
                    <div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience), e.location].filter((x) => x && x !== "—").join(" · ")}</div></td>
                  <td><ScoreBar value={e.total_score} /></td>
                  <td>{e.status === "shortlisted" ? <span className="badge amber">Waiting for you</span> : <StatusBadge status={e.status} />}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <button className="btn btn-sm" onClick={() => openResume(e)}><FileText /> View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openEntry && (
        <Modal title="Candidate details" onClose={() => setOpenEntry(null)} wide
               footer={<>
                 <button className="btn" onClick={() => setOpenEntry(null)}>Close</button>
                 <button className="btn btn-primary" onClick={() => openResume(openEntry)}><FileText /> View resume</button>
               </>}>
          <EntryDetail key={openEntry.id} entry={openEntry} onOpenResume={() => openResume(openEntry)} />
        </Modal>
      )}
    </div>
  );
}
