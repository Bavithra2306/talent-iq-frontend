import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListChecks } from "lucide-react";
import { Alert, Empty, Loading, PageHeader, ScoreBar, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/axios";
import { formatYears, labelize } from "../../lib/format";

/** Pick a job to match, and see scored candidates across all jobs. */
export default function ShortlistsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState({ job_id: "", status: "shortlisted", min_score: "", sort: "score", order: "desc" });
  const jobs = useQuery({ queryKey: ["jobs", "open-all"], queryFn: () => api.listJobs({ status: "open", limit: 100 }) });
  const entries = useQuery({
    queryKey: ["all-shortlists", view],
    queryFn: () => api.allShortlists({ ...view, limit: 100 }),
  });
  const jobTitle = (id: string) => jobs.data?.items.find((j) => j.id === id)?.title ?? "Job";

  return (
    <>
      <PageHeader title="Shortlists" subtitle="Pick a job to find the best candidates for it, and see everyone you have scored." />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><div><h2>Open jobs</h2><p>Choose a job to find and shortlist candidates.</p></div></div>
        {jobs.isLoading && <Loading />}
        {jobs.data?.items.length === 0 && <Empty title="No open jobs">Create a job first.</Empty>}
        {jobs.data && jobs.data.items.length > 0 && (
          <div className="card-body grid grid-3">
            {jobs.data.items.map((j) => (
              <button key={j.id} className="card card-pad" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => navigate(`/jobs/${j.id}/shortlist`)}>
                <div className="cell-title">{j.title}</div>
                <div className="cell-sub">{[j.category, j.location, j.experience_years !== null ? `${j.experience_years}+ yrs` : null].filter(Boolean).join(" · ")}</div>
                <div className="chips" style={{ marginTop: 10 }}>{(j.skills ?? []).slice(0, 4).map((s) => <span key={s} className="tag gray">{s}</span>)}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-header"><div><h2>All scored candidates</h2><p>Across every job.</p></div></div>
        <div className="toolbar">
          <select className="select" value={view.job_id} onChange={(e) => setView({ ...view, job_id: e.target.value })}>
            <option value="">All jobs</option>
            {jobs.data?.items.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <select className="select" value={view.status} onChange={(e) => setView({ ...view, status: e.target.value })}>
            <option value="">All statuses</option>
            {["sourced", "shortlisted", "approved", "rejected", "interview_scheduled"].map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </select>
          <input className="input" type="number" min={0} max={100} placeholder="Min score" value={view.min_score} onChange={(e) => setView({ ...view, min_score: e.target.value })} />
          <select className="select" value={`${view.sort}:${view.order}`} onChange={(e) => { const [s, o] = e.target.value.split(":"); setView({ ...view, sort: s, order: o }); }}>
            <option value="score:desc">Highest score</option>
            <option value="experience:desc">Most experience</option>
            <option value="date_added:desc">Newest</option>
            <option value="name:asc">Name A–Z</option>
          </select>
        </div>
        {entries.isLoading && <Loading />}
        {entries.isError && <div className="card-body"><Alert tone="error">{errorMessage(entries.error)}</Alert></div>}
        {entries.data?.items.length === 0 && <Empty title="Nothing here yet" icon={<ListChecks />}>Open a job above and press “Find best matches”.</Empty>}
        {entries.data && entries.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Candidate</th><th>Job</th><th>Rank</th><th>Score</th><th>Status</th></tr></thead>
              <tbody>
                {entries.data.items.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => navigate(`/jobs/${e.job_id}/shortlist`)}>
                    <td><div className="cell-title">{e.name ?? "Name not given"}</div><div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience)].filter((x) => x && x !== "—").join(" · ")}</div></td>
                    <td>{jobTitle(e.job_id)}</td>
                    <td>{e.rank ?? "—"}</td>
                    <td style={{ minWidth: 150 }}><ScoreBar value={e.total_score} /></td>
                    <td><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
