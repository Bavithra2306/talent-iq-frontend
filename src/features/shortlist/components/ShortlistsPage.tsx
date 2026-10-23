import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileText, ListChecks } from "lucide-react";
import { Alert, Drawer, Empty, Loading, PageHeader, ScoreBar, StatusBadge, useToast } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears, STATUS_LABEL } from "../../../utils/format";
import type { ShortlistEntry } from "../../../types/api";
import EntryDetail from "./EntryDetail";
import JobSummary from "./JobSummary";

/** Pick a job to match, and see scored candidates across all jobs. */
export default function ShortlistsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [listOpen, setListOpen] = useState(false); // the scored list is folded until you open it
  const [openEntry, setOpenEntry] = useState<ShortlistEntry | null>(null);
  const [view, setView] = useState({ job_id: "", status: "", location: "", min_score: "", max_score: "", sort: "score", order: "desc" });
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
  const saveNotes = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) => api.setNotes(entryId, text),
    onSuccess: (entry) => {
      setOpenEntry((current) => (current ? entry : current));
      void queryClient.invalidateQueries({ queryKey: ["all-shortlists"] });
      toast("Note saved.", "success");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  // The location list holds the cities of everyone scored (for the chosen job).
  const cityRows = useQuery({
    queryKey: ["all-shortlists", "cities", view.job_id],
    queryFn: () => api.allShortlists({ job_id: view.job_id, limit: 200, include_unranked: true }),
  });
  const cities = useMemo(() => {
    const byCity = new Map<string, string>();
    for (const e of cityRows.data?.items ?? []) {
      const city = e.location?.split(",")[0].trim();
      if (city && !byCity.has(city.toLowerCase())) byCity.set(city.toLowerCase(), city);
    }
    return [...byCity.values()].sort();
  }, [cityRows.data]);
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
        <button type="button" className="list-count list-toggle" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}>
          All scored candidates
          {entries.data && <span className="badge brand plain">{entries.data.total}</span>}
          <span className="muted small" style={{ fontWeight: 400 }}>across every job</span>
          <ChevronDown size={18} className={`list-chevron ${listOpen ? "open" : ""}`} />
        </button>
        {listOpen && <>
        <div className="toolbar slim">
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
          <select className="select" value={view.location} onChange={(e) => setView({ ...view, location: e.target.value })} aria-label="Location">
            <option value="">All locations</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select" value={view.min_score} onChange={(e) => setView({ ...view, min_score: e.target.value })} aria-label="Minimum score">
            <option value="">Any score</option>
            {[50, 60, 70, 80, 90].map((n) => <option key={n} value={n}>Minimum {n}</option>)}
          </select>
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
                  <tr key={e.id} className="clickable" onClick={() => setOpenEntry(e)}>
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
        </>}
      </div>

      {openEntry && (
        <Drawer title="Candidate details" onClose={() => setOpenEntry(null)} half
                footer={<button className="btn" onClick={() => navigate(`/jobs/${openEntry.job_id}/shortlist`)}>Open this job's shortlist</button>}>
          <p className="muted small" style={{ marginBottom: 10 }}>For the job: <strong>{jobTitle(openEntry.job_id)}</strong></p>
          <EntryDetail key={openEntry.id} entry={openEntry} onOpenResume={() => openFile(`/api/v1/candidates/${openEntry.candidate_id}/resume`, openEntry.name ?? "Resume")}
                       onSaveNotes={(text) => saveNotes.mutate({ entryId: openEntry.id, text })} savingNotes={saveNotes.isPending} />
        </Drawer>
      )}
    </>
  );
}
