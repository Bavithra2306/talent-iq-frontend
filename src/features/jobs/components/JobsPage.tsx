import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Plus, Search, X } from "lucide-react";
import { Alert, Empty, Loading, PageHeader, Pagination } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime } from "../../../utils/format";

const LIMIT = 15;
const EXPERIENCE = [
  { label: "0-2 yrs", min: 0, max: 2 }, { label: "3-5 yrs", min: 3, max: 5 },
  { label: "6-9 yrs", min: 6, max: 9 }, { label: "10+ yrs", min: 10, max: undefined },
];

export default function JobsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [offset, setOffset] = useState(0);
  const band = EXPERIENCE.find((b) => b.label === experience);
  const jobs = useQuery({
    queryKey: ["jobs", search, status, category, location, experience, offset],
    queryFn: () => api.listJobs({ search, status, category, location, min_experience: band?.min, max_experience: band?.max, limit: LIMIT, offset }),
  });
  // The category and location lists hold only values that exist in your jobs.
  const all = useQuery({ queryKey: ["jobs", "choices"], queryFn: () => api.listJobs({ limit: 100 }) });
  const categories = useMemo(() => [...new Set((all.data?.items ?? []).map((j) => j.category).filter(Boolean) as string[])].sort(), [all.data]);
  const locations = useMemo(() => [...new Set((all.data?.items ?? []).map((j) => j.location).filter(Boolean) as string[])].sort(), [all.data]);
  const filtered = Boolean(search || status || category || location || experience);
  const pick = (set: (v: string) => void) => (e: { target: { value: string } }) => { set(e.target.value); setOffset(0); };
  const clear = () => { setSearch(""); setStatus(""); setCategory(""); setLocation(""); setExperience(""); setOffset(0); };

  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Job descriptions you can match candidates against."
        actions={<Link to="/jobs/new" className="btn btn-primary"><Plus /> New job</Link>}
      />
      <div className="card">
        <div className="toolbar">
          <div className="row" style={{ position: "relative", flex: "0 1 210px" }}>
            <Search size={15} style={{ position: "absolute", left: 9, color: "var(--ink-400)" }} />
            <input className="input grow" style={{ paddingLeft: 30 }} placeholder="Role, skill, place"
                   value={search} onChange={pick(setSearch)} aria-label="Search jobs" />
          </div>
          <select className="select" value={category} onChange={pick(setCategory)} aria-label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" value={location} onChange={pick(setLocation)} aria-label="Location">
            <option value="">All locations</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="select" value={experience} onChange={pick(setExperience)} aria-label="Experience">
            <option value="">Any experience</option>
            {EXPERIENCE.map((b) => <option key={b.label} value={b.label}>{b.label}</option>)}
          </select>
          <select className="select" value={status} onChange={pick(setStatus)} aria-label="Status">
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          {filtered && <button className="btn btn-ghost btn-sm" onClick={clear}><X /> Clear</button>}
        </div>
        {jobs.isLoading && <Loading />}
        {jobs.isError && <div className="card-body"><Alert tone="error">{errorMessage(jobs.error)}</Alert></div>}
        {jobs.data && jobs.data.items.length === 0 && (
          <Empty title={filtered ? "No jobs match" : "No jobs yet"} icon={<Briefcase />}>{filtered ? "Try fewer filters or clear them." : "Create a job by uploading a job description or typing it in."}</Empty>
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
