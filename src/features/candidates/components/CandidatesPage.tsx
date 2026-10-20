import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Search, Upload, Users, X } from "lucide-react";
import { Alert, Drawer, Empty, FileDrop, Loading, PageHeader, Pagination, StatusBadge } from "../../../components/ui";
import { api, downloadFile, openFile } from "../../../services/api";
import type { Candidate } from "../../../types/api";
import { errorMessage } from "../../../lib/axios";
import { MAX_RESUME_FILES, MAX_UPLOAD_MB } from "../../../config/constants";
import { formatBytes, formatDateTime, formatYears, labelize, STATUS_LABEL } from "../../../utils/format";
import UploadStatus from "./UploadStatus";
import ReviewQueue from "./ReviewQueue";

const LIMIT = 20;
const BATCH_KEY = "talentiq.lastBatch";

function storedBatch(): string | null {
  try { return localStorage.getItem(BATCH_KEY); } catch { return null; }
}

export default function ResumesPage() {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(storedBatch);
  const [rejected, setRejected] = useState<{ filename: string; reason: string }[]>([]);
  const [filters, setFilters] = useState({ category: "", search: "", skill: "", location: "", min_experience: "", status: "", sort: "date_added", order: "desc" });
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const list = useQuery({
    queryKey: ["candidates", filters, offset],
    queryFn: () => api.listCandidates({ ...filters, limit: LIMIT, offset }),
  });
  const upload = useMutation({
    mutationFn: () => api.uploadResumes(files, setProgress),
    onSuccess: (res) => {
      setFiles([]);
      setRejected(res.rejected);
      if (res.batch_id) {
        setBatchId(res.batch_id);
        try { localStorage.setItem(BATCH_KEY, res.batch_id); } catch { /* storage unavailable */ }
      }
    },
  });

  const setFilter = (key: keyof typeof filters, value: string) => { setFilters((f) => ({ ...f, [key]: value })); setOffset(0); };
  const addFiles = (incoming: File[]) => {
    setFiles((prev) => [...prev, ...incoming.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
  };
  // The server checks what each file really is; here only the size of the whole upload is checked.
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const tooMany = files.length > MAX_RESUME_FILES;
  const tooBig = totalBytes > MAX_UPLOAD_MB * 1024 * 1024;

  const totalResumes = categories.data?.reduce((sum, c) => sum + c.count, 0);
  const clearBatch = () => { setBatchId(null); try { localStorage.removeItem(BATCH_KEY); } catch { /* ignore */ } };

  return (
    <>
      <PageHeader
        title={<>Resumes {totalResumes !== undefined && <span className="badge brand plain title-count">{totalResumes} total</span>}</>}
        subtitle="Upload resumes and browse everyone you have."
      />

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body stack" style={{ gap: 10 }}>
          <FileDrop compact multiple folders onFiles={addFiles} hint="PDF, Word or scanned PDF. Up to 150 files, or one zip." />
          {files.length > 0 && (
            <div className="spread">
              <details className="picked">
                <summary>{files.length} file(s) selected · {formatBytes(totalBytes)}</summary>
                <div className="file-list">
                  {files.map((f) => (
                    <div key={f.name + f.size} className="file-item">
                      <span><FileText size={14} style={{ verticalAlign: -2 }} /> {f.name}</span>
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setFiles(files.filter((x) => x !== f))} aria-label="Remove"><X /></button>
                    </div>
                  ))}
                </div>
              </details>
              <div className="row">
                <button className="btn btn-ghost btn-sm" onClick={() => setFiles([])}>Clear</button>
                <button className="btn btn-primary" disabled={upload.isPending || tooMany || tooBig} onClick={() => upload.mutate()}>
                  <Upload /> {upload.isPending ? `Uploading ${progress}%` : "Upload"}
                </button>
              </div>
            </div>
          )}
          {tooMany && <Alert tone="warn">You chose {files.length} files. Please upload at most {MAX_RESUME_FILES} at a time.</Alert>}
          {tooBig && <Alert tone="warn">These files add up to {formatBytes(totalBytes)}. Please upload at most {MAX_UPLOAD_MB} MB at a time.</Alert>}
          {upload.isError && <Alert tone="error">{errorMessage(upload.error)}</Alert>}
          {rejected.length > 0 && (
            <Alert>
              <strong>{rejected.length} file(s) not added</strong>
              <ul className="skipped-list">
                {rejected.map((r, i) => <li key={`${r.filename}-${i}`}>{r.filename} — {r.reason}</li>)}
              </ul>
            </Alert>
          )}
          {batchId && (
            <UploadStatus key={batchId} batchId={batchId} onClose={clearBatch}
                          onFinished={() => {
                            void queryClient.invalidateQueries({ queryKey: ["candidates"] });
                            void queryClient.invalidateQueries({ queryKey: ["categories"] });
                            void queryClient.invalidateQueries({ queryKey: ["resume-review"] });
                          }} />
          )}
        </div>
      </div>

      <ReviewQueue origin="all" />

      <div className="card">
        <div className="toolbar">
          <select className="select" value={filters.category} onChange={(e) => setFilter("category", e.target.value)} aria-label="Category">
            <option value="">All categories ({totalResumes ?? 0})</option>
            {categories.data?.filter((c) => c.category).map((c) => (
              <option key={c.category} value={c.category ?? ""}>{c.category} ({c.count})</option>
            ))}
          </select>
          <div className="row grow" style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 10, color: "var(--ink-400)" }} />
            <input className="input grow" style={{ paddingLeft: 32 }} placeholder="Name, email or title"
                   value={filters.search} onChange={(e) => setFilter("search", e.target.value)} />
          </div>
          <input className="input" placeholder="Skill" value={filters.skill} onChange={(e) => setFilter("skill", e.target.value)} />
          <input className="input" placeholder="Location" value={filters.location} onChange={(e) => setFilter("location", e.target.value)} />
          <input className="input" style={{ minWidth: 110 }} type="number" min={0} placeholder="Min yrs"
                 value={filters.min_experience} onChange={(e) => setFilter("min_experience", e.target.value)} />
          <select className="select" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">Any status</option>
            <option value="new">New (not matched yet)</option>
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className="select" value={`${filters.sort}:${filters.order}`}
                  onChange={(e) => { const [s, o] = e.target.value.split(":"); setFilters((f) => ({ ...f, sort: s, order: o })); }}>
            <option value="date_added:desc">Newest first</option>
            <option value="date_added:asc">Oldest first</option>
            <option value="experience:desc">Most experience</option>
            <option value="name:asc">Name A–Z</option>
          </select>
        </div>
        {list.isLoading && <Loading />}
        {list.isError && <div className="card-body"><Alert tone="error">{errorMessage(list.error)}</Alert></div>}
        {list.data?.items.length === 0 && <Empty title="No resumes found" icon={<Users />}>Upload resumes or use Sourcing.</Empty>}
        {list.data && list.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Candidate</th><th>Category</th><th>Experience</th><th>Location</th><th>Top skills</th><th>Status by job</th><th>Source</th><th>Added</th><th>Resume</th></tr></thead>
              <tbody>
                {list.data.items.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setOpenId(c.id)}>
                    <td><div className="cell-title">{c.name ?? "Name not given"}</div><div className="cell-sub">{c.current_title ?? c.email ?? ""}</div></td>
                    <td>{c.category ? <span className="badge brand plain">{c.category}</span> : "—"}</td>
                    <td>{formatYears(c.total_years_experience)}</td>
                    <td>{c.location ?? "—"}</td>
                    <td><div className="chips">{c.skills.slice(0, 3).map((s) => <span key={s} className="tag gray">{s}</span>)}{c.skills.length > 3 && <span className="muted small">+{c.skills.length - 3}</span>}</div></td>
                    <td><JobStatuses items={c.job_statuses} /></td>
                    <td className="muted">{labelize(c.source_site ?? "upload")}</td>
                    <td className="muted">{formatDateTime(c.created_at)}</td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <button className="btn btn-sm" onClick={() => void openFile(`/api/v1/candidates/${c.id}/resume`)}><FileText /> View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination total={list.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
      </div>

      {openId && <CandidateDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/** A candidate's status per job ("New" when not matched to any job yet). */
function JobStatuses({ items, full }: { items: Candidate["job_statuses"]; full?: boolean }) {
  if (!items.length) return <StatusBadge status={null} />;
  const shown = full ? items : items.slice(0, 2);
  return (
    <div className="stack" style={{ gap: 4 }}>
      {shown.map((s) => (
        <div key={s.job_id} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <StatusBadge status={s.status} /><span className="small muted" style={{ whiteSpace: "nowrap" }}>{s.job_title}</span>
        </div>
      ))}
      {!full && items.length > 2 && <span className="small muted">+{items.length - 2} more jobs</span>}
    </div>
  );
}

function CandidateDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ["candidate", id], queryFn: () => api.getCandidate(id) });
  const c = detail.data;
  return (
    <Drawer title={c?.name ?? "Candidate"} onClose={onClose}
            footer={<>
              <button className="btn" onClick={() => void downloadFile(`/api/v1/candidates/${id}/resume`, { download: true }, c?.file_name ?? "resume")}><Download /> Download</button>
              <button className="btn btn-primary" onClick={() => void openFile(`/api/v1/candidates/${id}/resume`)}><FileText /> View resume</button>
            </>}>
      {detail.isLoading && <Loading />}
      {detail.isError && <Alert tone="error">{errorMessage(detail.error)}</Alert>}
      {c && (
        <>
          <dl className="kv">
            <dt>Current title</dt><dd>{c.current_title ?? "—"}</dd>
            <dt>Category</dt><dd>{c.category ?? "—"}</dd>
            <dt>Experience</dt><dd>{formatYears(c.total_years_experience)}</dd>
            <dt>Email</dt><dd>{c.email ?? "—"}</dd>
            <dt>Phone</dt><dd>{c.contact ?? "—"}</dd>
            <dt>Location</dt><dd>{c.location ?? "—"}</dd>
            <dt>Status</dt><dd><JobStatuses items={c.job_statuses} full /></dd>
            <dt>Source</dt><dd>{labelize(c.source_site ?? "upload")} · {c.file_name}</dd>
            <dt>Read by</dt><dd className="mono">{c.extraction_model ?? "—"}</dd>
          </dl>
          <div>
            <h3 style={{ marginBottom: 8 }}>Skills</h3>
            <div className="chips">{c.skills.map((s) => <span key={s} className="tag">{s}</span>)}</div>
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>Experience</h3>
            {c.roles_and_years?.length ? (
              <div className="events">
                {c.roles_and_years.map((r, i) => (
                  <div key={i} className="event" style={{ gridTemplateColumns: "1fr auto" }}>
                    <div><strong>{r.title}</strong>{r.company && <span className="muted"> · {r.company}</span>}</div>
                    <span className="muted">{r.years !== null ? formatYears(r.years) : ""}</span>
                  </div>
                ))}
              </div>
            ) : <p className="muted">No roles listed.</p>}
          </div>
          <div>
            <h3 style={{ marginBottom: 8 }}>Education</h3>
            {c.education?.length ? c.education.map((e, i) => (
              <p key={i}>{e.degree}{e.institution && <span className="muted"> · {e.institution}</span>}{e.year && <span className="muted"> · {e.year}</span>}</p>
            )) : <p className="muted">No education listed.</p>}
          </div>
        </>
      )}
    </Drawer>
  );
}
