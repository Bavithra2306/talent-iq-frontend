import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Globe, RotateCcw, Search, Upload, User, Users, X } from "lucide-react";
import { Alert, Drawer, Empty, FileDrop, Modal, InlineFile, Loading, PageHeader, Pagination, StatusBadge } from "../../../components/ui";
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
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ category: searchParams.get("category") ?? "", search: "", min_experience: "", max_experience: "", status: "", sort: "date_added", order: "desc" });
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false); // the upload dialog

  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  // How many resumes are ready for matching (have their search fingerprints); refreshes every minute.
  const quota = useQuery({ queryKey: ["quota"], queryFn: api.embeddingQuota, refetchInterval: 60000 });
  const list = useQuery({
    queryKey: ["candidates", filters, offset],
    queryFn: () => api.listCandidates({ ...filters, limit: LIMIT, offset }),
  });
  // Resumes stored but never read (the AI or the reader failed): can be run again in one click.
  const failed = useQuery({ queryKey: ["failed-resumes"], queryFn: api.failedCount, refetchInterval: 60000 });
  const retry = useMutation({
    mutationFn: api.retryFailed,
    onSuccess: (res) => {
      if (res.batch_id) {
        setBatchId(res.batch_id);
        try { localStorage.setItem(BATCH_KEY, res.batch_id); } catch { /* storage unavailable */ }
      }
      void queryClient.invalidateQueries({ queryKey: ["failed-resumes"] });
    },
  });
  const upload = useMutation({
    mutationFn: () => api.uploadResumes(files, setProgress),
    onSuccess: (res) => {
      setFiles([]);
      setUploadOpen(false);
      setRejected(res.rejected);
      if (res.batch_id) {
        setBatchId(res.batch_id);
        try { localStorage.setItem(BATCH_KEY, res.batch_id); } catch { /* storage unavailable */ }
      }
    },
  });

  const setFilter = (key: keyof typeof filters, value: string) => { setFilters((f) => ({ ...f, [key]: value })); setOffset(0); setListOpen(true); };
  const addFiles = (incoming: File[]) => {
    setFiles((prev) => [...prev, ...incoming.filter((f) => !prev.some((p) => p.name === f.name && p.size === f.size))]);
  };
  // The server checks what each file really is; here only the size of the whole upload is checked.
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  const tooMany = files.length > MAX_RESUME_FILES;
  const tooBig = totalBytes > MAX_UPLOAD_MB * 1024 * 1024;

  const totalResumes = categories.data?.reduce((sum, c) => sum + c.count, 0);
  const closeUpload = () => { setUploadOpen(false); setFiles([]); upload.reset(); };
  const clearBatch = () => { setBatchId(null); try { localStorage.removeItem(BATCH_KEY); } catch { /* ignore */ } };

  return (
    <>
      <PageHeader
        title={<>Resumes {totalResumes !== undefined && <span className="badge brand plain title-count">{totalResumes} total</span>}
          {totalResumes !== undefined && quota.data && (
            <span className={`badge plain title-count ${quota.data.resumes_waiting ? "amber" : "green"}`}
                  title="Resumes that can be compared with a job. New resumes get ready automatically every 20 minutes.">
              Ready for matching: {Math.max(0, totalResumes - quota.data.resumes_waiting)} of {totalResumes}
              {quota.data.resumes_waiting > 0 && (quota.data.paused ? ` · the rest after ${quota.data.resumes_at}` : " · the rest within minutes")}
            </span>
          )}</>}
        subtitle="Upload resumes and browse everyone you have."
        actions={<button className="btn btn-primary" onClick={() => setUploadOpen(true)}><Upload /> Upload resumes</button>}
      />

      <div style={{ marginBottom: 12 }}>
        <div className="stack upload-card" style={{ gap: 8 }}>
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
                            void queryClient.invalidateQueries({ queryKey: ["quota"] });
                            void queryClient.invalidateQueries({ queryKey: ["failed-resumes"] });
                          }} />
          )}
          {!batchId && (failed.data ?? 0) > 0 && (
            <Alert tone="warn">
              <div className="spread">
                <span><strong>{failed.data} resume(s) could not be read</strong> (the AI service was busy or the file failed). Run them again; files that still fail are listed with the reason.</span>
                <button className="btn btn-sm" disabled={retry.isPending} onClick={() => retry.mutate()}>
                  <RotateCcw /> {retry.isPending ? "Starting…" : "Retry failed"}
                </button>
              </div>
            </Alert>
          )}
          {retry.isError && <Alert tone="error">{errorMessage(retry.error)}</Alert>}
        </div>
      </div>

      <ReviewQueue origin="all" />

      <div className="card">
        {list.data && (
          <div className="list-count">
            {filters.status === "new" ? "New (not matched yet)" : filters.status ? STATUS_LABEL[filters.status as keyof typeof STATUS_LABEL] : "All resumes"}
            {filters.category && ` · ${filters.category}`} <span className="badge brand plain">{list.data.total}</span></div>
        )}
        <div className="toolbar slim">
          <select className="select" value={filters.category} onChange={(e) => setFilter("category", e.target.value)} aria-label="Category">
            <option value="">All categories ({totalResumes ?? 0})</option>
            {categories.data?.filter((c) => c.category).map((c) => (
              <option key={c.category} value={c.category ?? ""}>{c.category} ({c.count})</option>
            ))}
          </select>
          <div className="row grow" style={{ position: "relative" }}>
            <Search size={15} style={{ position: "absolute", left: 9, color: "var(--ink-400)" }} />
            <input className="input grow" style={{ paddingLeft: 30 }} placeholder="Search name, skill, title or place"
                   value={filters.search} onChange={(e) => setFilter("search", e.target.value)} />
          </div>
<select className="select" aria-label="Experience" value={`${filters.min_experience}-${filters.max_experience}`}
                  onChange={(e) => { const [lo, hi] = e.target.value.split("-"); setFilters((f) => ({ ...f, min_experience: lo, max_experience: hi })); setOffset(0); }}>
            <option value="-">Any experience</option>
            <option value="0-2">0-2 yrs</option><option value="3-5">3-5 yrs</option>
            <option value="6-9">6-9 yrs</option><option value="10-">10+ yrs</option>
          </select>
          <select className="select" value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">Any status</option>
            <option value="new">New</option>
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
          <div className="table-wrap fit">
            <table className="table fit">
              <thead><tr><th>Candidate</th><th>Category</th><th>Location</th><th>Status</th><th>Source</th><th>Added</th><th>Resume</th></tr></thead>
              <tbody>
                {list.data.items.map((c) => (
                  <tr key={c.id} className="clickable" onClick={() => setOpenId(c.id)}>
                    <td><div className="cell-title">{c.name ?? "Name not given"}</div><div className="cell-sub">{c.current_title ?? c.email ?? ""}</div></td>
                    <td>{c.category ? <span className="badge brand plain">{c.category}</span> : "—"}</td>
                    <td>{c.location ?? "—"}</td>
                    <td><JobStatuses items={c.job_statuses} /></td>
                    <td><SourceBadge site={c.source_site} /></td>
                    <td className="muted">{formatDateTime(c.created_at)}</td>
                    <td onClick={(ev) => ev.stopPropagation()}>
                      <button className="btn btn-sm" onClick={() => openFile(`/api/v1/candidates/${c.id}/resume`, c.name ?? "Resume")}><FileText /> View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pagination total={list.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
      </div>

      {uploadOpen && (
        <Modal title="Upload resumes" onClose={() => !upload.isPending && closeUpload()}
               footer={files.length > 0 ? (
                 <>
                   <button className="btn btn-ghost" onClick={() => setFiles([])} disabled={upload.isPending}>Clear</button>
                   <button className="btn btn-primary" disabled={upload.isPending || tooMany || tooBig} onClick={() => upload.mutate()}>
                     <Upload /> {upload.isPending ? `Uploading ${progress}%` : `Upload ${files.length} file${files.length === 1 ? "" : "s"}`}
                   </button>
                 </>
               ) : undefined}>
          <div className="stack" style={{ gap: 12 }}>
            <FileDrop multiple folders onFiles={addFiles} hint="PDF, Word or scanned PDF. Drag files, a folder, or one zip. Up to 150 files." />
            {files.length > 0 && (
              <div className="picked-box">
                <div className="chip-files">
                  {files.slice(0, 12).map((f) => (
                    <span key={f.name + f.size} className="file-chip" title={f.name}>
                      <FileText size={14} /><span className="file-chip-name">{f.name}</span><span className="muted small">{formatBytes(f.size)}</span>
                      <button className="file-chip-x" onClick={() => setFiles(files.filter((x) => x !== f))} aria-label={`Remove ${f.name}`} disabled={upload.isPending}><X size={12} /></button>
                    </span>
                  ))}
                  {files.length > 12 && <span className="file-chip more">+{files.length - 12} more</span>}
                </div>
                <span className="muted small"><strong>{files.length}</strong> file(s) · {formatBytes(totalBytes)}</span>
                {upload.isPending && <div className="upload-bar"><span style={{ width: `${progress}%` }} /></div>}
              </div>
            )}
            {tooMany && <Alert tone="warn">You chose {files.length} files. Please upload at most {MAX_RESUME_FILES} at a time.</Alert>}
            {tooBig && <Alert tone="warn">These files add up to {formatBytes(totalBytes)}. Please upload at most {MAX_UPLOAD_MB} MB at a time.</Alert>}
            {upload.isError && <Alert tone="error">{errorMessage(upload.error)}</Alert>}
          </div>
        </Modal>
      )}

      {openId && <CandidateDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

/** A candidate's status per job ("New" when not matched to any job yet). */
function JobStatuses({ items, full }: { items: Candidate["job_statuses"]; full?: boolean }) {
  if (!items.length) return <StatusBadge status={null} />;
  if (!full) {
    const all = items.map((i) => `${i.job_title}: ${i.status.replace("_", " ")}`).join(", ");
    return (
      <div className="row" style={{ gap: 4, flexWrap: "nowrap" }} title={all}>
        <StatusBadge status={items[0].status} />{items.length > 1 && <span className="small muted">+{items.length - 1}</span>}
      </div>
    );
  }
  return (
    <div className="stack" style={{ gap: 4 }}>
      {items.map((s) => (
        <div key={s.job_id} className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
          <StatusBadge status={s.status} /><span className="small muted" style={{ whiteSpace: "nowrap" }}>{s.job_title}</span>
        </div>
      ))}
    </div>
  );
}

const SITE_LABEL: Record<string, string> = {
  github: "GitHub", stackexchange: "Stack Overflow", huggingface: "Hugging Face", kaggle: "Kaggle",
};

/** Where a resume came from: "Uploaded" by a person, or the public site it was sourced from. */
function SourceBadge({ site }: { site: string | null }) {
  if (!site) return <span className="badge plain source-pill">Uploaded</span>;
  return <span className="badge blue plain source-pill"><Globe /> {SITE_LABEL[site] ?? labelize(site)}</span>;
}

function CandidateDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ["candidate", id], queryFn: () => api.getCandidate(id) });
  const [view, setView] = useState<"profile" | "resume">("profile");
  const c = detail.data;
  return (
    <Drawer title={c?.name ?? "Candidate"} onClose={onClose} half
            footer={<>
              <button className="btn" onClick={() => void downloadFile(`/api/v1/candidates/${id}/resume`, { download: true }, c?.file_name ?? "resume")}>Download</button>
            </>}>
      {detail.isLoading && <Loading />}
      {detail.isError && <Alert tone="error">{errorMessage(detail.error)}</Alert>}
      {c && (
        <div className="segmented" role="tablist" aria-label="Candidate view">
          <button role="tab" aria-selected={view === "profile"} className={view === "profile" ? "active" : ""} onClick={() => setView("profile")}><User /> Profile</button>
          <button role="tab" aria-selected={view === "resume"} className={view === "resume" ? "active" : ""} onClick={() => setView("resume")}><FileText /> Resume</button>
        </div>
      )}
      {c && view === "resume" && <InlineFile url={`/api/v1/candidates/${id}/resume`} title={c.name ?? "Resume"} height={620} />}
      {c && view === "profile" && (
        <>
          <dl className="kv">
            <dt>Current title</dt><dd>{c.current_title ?? "—"}</dd>
            <dt>Category</dt><dd>{c.category ?? "—"}</dd>
            <dt>Experience</dt><dd>{formatYears(c.total_years_experience)}</dd>
            <dt>Email</dt><dd>{c.email ?? "—"}</dd>
            <dt>Phone</dt><dd>{c.contact ?? "—"}</dd>
            <dt>Location</dt><dd>{c.location ?? "—"}</dd>
            <dt>Status</dt><dd><JobStatuses items={c.job_statuses} full /></dd>
            <dt>Source</dt><dd><SourceBadge site={c.source_site} /> <span className="muted small">{c.file_name}</span></dd>
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
