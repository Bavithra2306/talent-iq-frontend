import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, ListChecks } from "lucide-react";
import { Alert, Empty, Loading, PageHeader, ScoreBar, StatusBadge } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears, STATUS_LABEL } from "../../../utils/format";
import JobSummary from "./JobSummary";

/** Pick a job to match, and see scored candidates across all jobs. */
export default function ShortlistsPage() {
  const navigate = useNavigate();
  const [view, setView] = useState({ job_id: "", status: "shortlisted", location: "", min_score: "", max_score: "", sort: "score", order: "desc" });
  // How many candidates have each status (for the chosen job, or all jobs).
  const counts = useQuery({
    queryKey: ["all-shortlists", "status-counts", view.job_id, view.location, view.min_score, view.max_score],
    queryFn: async () => Object.fromEntries(await Promise.all(
      (Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map(async (st) =>
        [st, (await api.allShortlists({ job_id: view.job_id, location: view.location, min_score: view.min_score, max_score: view.max_score, status: st, limit: 1, include_unranked: true })).total] as const),
    )),
  });
  const jobs = useQuery({ queryKey: ["jobs", "open-all"], queryFn: () => api.listJobs({ status: "open", limit: 100 }) });
  const entries = useQuery({
    queryKey: ["all-shortlists", view],
    queryFn: () => api.allShortlists({ ...view, limit: 100 }),
  });
  const [selectedId, setSelectedId] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const selectedJob = jobs.data?.items.find((j) => j.id === selectedId);
  const visibleJobs = useMemo(
    () => (jobs.data?.items ?? []).filter((j) => !jobSearch.trim() || `${j.title} ${j.category ?? ""}`.toLowerCase().includes(jobSearch.trim().toLowerCase())),
    [jobs.data, jobSearch],
  );
  const jobTitle = (id: string) => jobs.data?.items.find((j) => j.id === id)?.title ?? "Job";

  return (
    <>
      <PageHeader title="Shortlists" subtitle="Choose a job, check its key details, then start matching." />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div><h2>Job descriptions</h2><p>Click a job to see what it asks for.</p></div>
          {(jobs.data?.items.length ?? 0) > 6 && (
            <input className="input" style={{ maxWidth: 220 }} placeholder="Search jobs" value={jobSearch} onChange={(e) => setJobSearch(e.target.value)} />
          )}
        </div>
        {jobs.isLoading && <Loading rows={2} />}
        {jobs.data?.items.length === 0 && <Empty title="No open jobs">Create a job first.</Empty>}
        {jobs.data && jobs.data.items.length > 0 && (
          <div className="jd-list">
            {visibleJobs.map((j) => (
              <button key={j.id} className={`jd-card ${selectedJob?.id === j.id ? "on" : ""}`} onClick={() => setSelectedId(selectedJob?.id === j.id ? "" : j.id)}
                      aria-pressed={selectedJob?.id === j.id}>
                <strong>{j.title}</strong>
                <span className="muted small">{[j.category, j.experience_years != null ? `${j.experience_years}+ yrs` : null].filter(Boolean).join(" · ") || "—"}</span>
              </button>
            ))}
            {visibleJobs.length === 0 && <span className="muted small" style={{ padding: 8 }}>No job matches “{jobSearch}”.</span>}
          </div>
        )}
        {selectedJob && <div className="card-body jd-detail-wrap" key={selectedJob.id}><JobSummary job={selectedJob} /></div>}
      </div>

      <div className="card">
        <div className="card-header"><div><h2>All scored candidates</h2><p>Across every job.</p></div></div>
        <div className="toolbar">
          <select className="select" value={view.job_id} onChange={(e) => setView({ ...view, job_id: e.target.value })}>
            <option value="">All jobs</option>
            {jobs.data?.items.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <select className="select" value={view.status} onChange={(e) => setView({ ...view, status: e.target.value })}>
            <option value="">All statuses ({counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : "…"})</option>
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((st) => (
              <option key={st} value={st}>{STATUS_LABEL[st]} ({counts.data?.[st] ?? "…"})</option>
            ))}
          </select>
          <input className="input" placeholder="Location" value={view.location} onChange={(e) => setView({ ...view, location: e.target.value })} />
          <input className="input" style={{ maxWidth: 120 }} type="number" min={0} max={100} placeholder="Score from" value={view.min_score} onChange={(e) => setView({ ...view, min_score: e.target.value })} />
          <input className="input" style={{ maxWidth: 120 }} type="number" min={0} max={100} placeholder="Score to" value={view.max_score} onChange={(e) => setView({ ...view, max_score: e.target.value })} />
          <select className="select" value={`${view.sort}:${view.order}`} onChange={(e) => { const [s, o] = e.target.value.split(":"); setView({ ...view, sort: s, order: o }); }}>
            <option value="score:desc">Highest score</option>
            <option value="experience:desc">Most experience</option>
            <option value="date_added:desc">Newest</option>
            <option value="name:asc">Name A–Z</option>
          </select>
        </div>
        {entries.isLoading && <Loading />}
        {entries.isError && <div className="card-body"><Alert tone="error">{errorMessage(entries.error)}</Alert></div>}
        {entries.data?.items.length === 0 && <Empty title="Nothing here yet" icon={<ListChecks />}>Open a job description above and press “Start matching”.</Empty>}
        {entries.data && entries.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Candidate</th><th>Job</th><th>Rank</th><th>Score</th><th>Status</th><th>Resume</th></tr></thead>
              <tbody>
                {entries.data.items.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => navigate(`/jobs/${e.job_id}/shortlist`)}>
                    <td><div className="cell-title">{e.name ?? "Name not given"}</div><div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience)].filter((x) => x && x !== "—").join(" · ")}</div></td>
                    <td>{jobTitle(e.job_id)}</td>
                    <td>{e.rank ?? "—"}</td>
                    <td style={{ minWidth: 150 }}><ScoreBar value={e.total_score} /></td>
                    <td><StatusBadge status={e.status} /></td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <button className="btn btn-sm" onClick={() => openFile(`/api/v1/candidates/${e.candidate_id}/resume`, e.name ?? "Resume")}><FileText /> View</button>
                    </td>
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
