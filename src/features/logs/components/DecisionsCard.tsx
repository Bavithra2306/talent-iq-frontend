import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, UserCheck, XCircle } from "lucide-react";
import { Alert } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime } from "../../../utils/format";

/** Activity log: a one-line dropdown with how many shortlisted candidates hiring managers approved
 *  or rejected; opens to show each job and the latest decisions. Follows the job filter and live updates. */
export default function DecisionsCard({ jobId, live }: { jobId: string; live: boolean }) {
  const [open, setOpen] = useState(false);
  const summary = useQuery({
    queryKey: ["logs", "decisions", jobId],
    queryFn: () => api.decisions({ job_id: jobId }),
    refetchInterval: live ? 5000 : false,
  });
  const managers = useQuery({
    queryKey: ["directory", "hiring_manager"], queryFn: () => api.directory("hiring_manager"), enabled: open,
  });
  const managerName = (id: string | null) => {
    const m = managers.data?.find((u) => u.id === id);
    return m ? m.name ?? m.email : "Hiring manager";
  };

  const s = summary.data;
  return (
    <div className="card decisions" style={{ marginBottom: 16 }}>
      <button className="decisions-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <ChevronRight size={16} className={`chev ${open ? "open" : ""}`} />
        <UserCheck size={16} />
        <strong>Hiring manager decisions</strong>
        {s && (s.shared === 0
          ? <span className="muted small">Nothing shared yet</span>
          : (
            <span className="decision-counts small">
              <span className="ok">{s.approved} approved</span> · <span className="bad">{s.rejected} rejected</span>
              {s.waiting > 0 && <> · <span className="muted">{s.waiting} waiting</span></>}
              <span className="muted"> of {s.shared} shared</span>
            </span>
          ))}
      </button>
      {summary.isError && <div className="card-body"><Alert tone="error">{errorMessage(summary.error)}</Alert></div>}
      {open && s && s.shared > 0 && (
        <div className="decisions-body">
          <table className="table">
            <thead><tr><th>Job</th><th>Hiring manager</th><th>Shared</th><th>Approved</th><th>Rejected</th><th>Waiting</th></tr></thead>
            <tbody>
              {s.jobs.map((j) => (
                <tr key={j.job_id}>
                  <td className="cell-title">{j.job_title}</td>
                  <td className="muted">{j.hiring_manager_ids.map(managerName).join(", ")}</td>
                  <td>{j.shared}</td><td className="ok">{j.approved}</td><td className="bad">{j.rejected}</td><td>{j.waiting}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.recent.length > 0 && (
            <ul className="decision-list">
              {s.recent.map((e, i) => (
                <li key={`${e.at}-${i}`}>
                  {e.decision === "approved" ? <CheckCircle2 size={15} className="ok" /> : <XCircle size={15} className="bad" />}
                  <span>
                    {managerName(e.decided_by)} {e.decision} <strong>{e.candidate_name ?? "a candidate"}</strong>
                    {e.job_title && <> for {e.job_title}</>}
                    {e.comment && <span className="muted"> · “{e.comment}”</span>}
                  </span>
                  <time className="muted small">{formatDateTime(e.at)}</time>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
