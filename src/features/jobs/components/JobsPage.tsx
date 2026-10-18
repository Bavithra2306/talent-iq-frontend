import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Plus, Search } from "lucide-react";
import { Alert, Empty, Loading, PageHeader, Pagination } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime } from "../../../utils/format";

const LIMIT = 15;

export default function JobsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const jobs = useQuery({
    queryKey: ["jobs", search, status, offset],
    queryFn: () => api.listJobs({ search, status, limit: LIMIT, offset }),
  });

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Job descriptions you can match candidates against."
        actions={<Link to="/jobs/new" className="btn btn-primary"><Plus /> New job</Link>}
      />
      <div className="card">
        <div className="toolbar">
          <div className="row grow" style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 10, color: "var(--ink-400)" }} />
            <input className="input grow" style={{ paddingLeft: 32 }} placeholder="Search title or location"
                   value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }} />
          </div>
          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        {jobs.isLoading && <Loading />}
        {jobs.isError && <div className="card-body"><Alert tone="error">{errorMessage(jobs.error)}</Alert></div>}
        {jobs.data && jobs.data.items.length === 0 && (
          <Empty title="No jobs yet" icon={<Briefcase />}>Create a job by uploading a JD PDF or typing it in.</Empty>
        )}
        {jobs.data && jobs.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Job</th><th>Category</th><th>Location</th><th>Experience</th><th>Skills</th><th>Status</th><th>Created</th></tr>
              </thead>
              <tbody>
                {jobs.data.items.map((job) => (
                  <tr key={job.id} className="clickable" onClick={() => navigate(`/jobs/${job.id}`)}>
                    <td><div className="cell-title">{job.title}</div><div className="cell-sub">{job.industry ?? ""}</div></td>
                    <td>{job.category ? <span className="badge brand plain">{job.category}</span> : "—"}</td>
                    <td>{job.location ?? "—"}{job.work_mode && <div className="cell-sub">{job.work_mode}</div>}</td>
                    <td>{job.experience_years !== null ? `${job.experience_years}+ yrs` : "—"}</td>
                    <td>{job.skills?.length ?? 0} required</td>
                    <td><span className={`badge ${job.status === "open" ? "green" : ""}`}>{job.status}</span></td>
                    <td className="muted">{formatDateTime(job.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {jobs.data && <Pagination total={jobs.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
      </div>
    </>
  );
}
