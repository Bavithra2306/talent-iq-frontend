import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, History, ListChecks, Play, Send, SlidersHorizontal, Sparkles, Star, Wand2, X } from "lucide-react";
import {
  Alert, Drawer, Empty, Loading, Modal, PageHeader, ScoreBar, StageTimeline, StatusBadge, TagInput, useToast,
} from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { describeAction, formatDateTime, formatYears, labelize, STATUS_LABEL } from "../../../utils/format";
import type { ParsedFilter, ShortlistEntry, Stage, Weights } from "../../../types/api";
import EntryDetail from "./EntryDetail";

const RUN_STAGES: Stage[] = ["created", "collecting", "reading", "scoring", "shortlisted"];
const STAGE_NAMES: Partial<Record<Stage, string>> = {
  created: "Started", collecting: "Comparing resumes", reading: "Earlier scores", scoring: "AI scoring", shortlisted: "Done",
};
const WEIGHT_LABELS: [keyof Weights, string][] = [
  ["skill_pct", "Skills"], ["role_pct", "Role"], ["exp_pct", "Experience"], ["edu_pct", "Education"],
];

interface ResultFilters {
  skills: string[]; location: string; min_experience: string; max_experience: string;
  education: string; min_score: string; status: string;
}
const NO_FILTERS: ResultFilters = { skills: [], location: "", min_experience: "", max_experience: "", education: "", min_score: "", status: "" };
const num = (v: string) => (v === "" ? null : Number(v));

export default function JobShortlistPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => api.getJob(id) });

  // 1. matching
  const [runId, setRunId] = useState<string | null>(null);
  const runStatus = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.runStatus(runId!),
    enabled: Boolean(runId),
    refetchInterval: (q) => (q.state.data?.finished ? false : 2000),
  });
  const start = useMutation({ mutationFn: () => api.startMatching(id), onSuccess: (r) => setRunId(r.run_id) });
  useEffect(() => {
    if (runStatus.data?.finished) void queryClient.invalidateQueries({ queryKey: ["shortlist", id] });
  }, [runStatus.data?.finished, id, queryClient]);
  const running = start.isPending || Boolean(runId && !runStatus.data?.finished);

  // 2. results, then filters / natural-language filter / top K
  const [filters, setFilters] = useState<ResultFilters>(NO_FILTERS);
  const [topK, setTopK] = useState(10);
  const [nlText, setNlText] = useState("");
  const [parsed, setParsed] = useState<ParsedFilter | null>(null);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [preview, setPreview] = useState(false);
  const [openEntry, setOpenEntry] = useState<ShortlistEntry | null>(null);
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(false);

  const list = useQuery({
    queryKey: ["shortlist", id, filters, preview ? weights : null],
    queryFn: () => api.shortlist(id, {
      skills: filters.skills, location: filters.location, education: filters.education,
      min_experience: filters.min_experience, max_experience: filters.max_experience,
      min_score: filters.min_score, status: filters.status,
      sort: "score", order: "desc", limit: 200, ...(preview && weights ? weights : {}),
    }),
  });
  useEffect(() => {
    if (list.data && !weights) setWeights(list.data.weights);
  }, [list.data, weights]);

  const interpret = useMutation({ mutationFn: () => api.parseFilter(nlText), onSuccess: setParsed });
  const applyParsed = (p: ParsedFilter) => {
    const f = p.filters;
    setFilters({
      ...filters,
      skills: f.must_have_skills ?? [], location: f.location ?? "", education: f.education ?? "",
      min_experience: f.min_experience?.toString() ?? "", max_experience: f.max_experience?.toString() ?? "",
    });
    if (p.top_k) setTopK(p.top_k);
    setParsed(null);
  };
  const pickTopK = useMutation({
    mutationFn: () => api.shortlistTopK(id, topK, {
      must_have_skills: filters.skills, location: filters.location || null, education: filters.education || null,
      min_experience: num(filters.min_experience), max_experience: num(filters.max_experience),
    }, num(filters.min_score)),
    onSuccess: (r) => {
      void queryClient.invalidateQueries({ queryKey: ["shortlist", id] });
      toast(`Shortlisted ${r.shortlisted} of ${r.matching} matching candidate(s).`, "success");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const saveWeights = useMutation({
    mutationFn: (w: Weights) => api.saveWeights(id, w),
    onSuccess: () => {
      setPreview(false);
      void queryClient.invalidateQueries({ queryKey: ["shortlist", id] });
      toast("Weights saved and results re-ranked.", "success");
    },
  });
  const notes = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) => api.setNotes(entryId, text),
    onSuccess: (entry) => { setOpenEntry(entry); void queryClient.invalidateQueries({ queryKey: ["shortlist", id] }); toast("Notes saved.", "success"); },
  });
  const toggle = useMutation({
    mutationFn: ({ entryId, on }: { entryId: string; on: boolean }) => api.toggleShortlist(entryId, on),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shortlist", id] }),
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const sum = weights ? weights.skill_pct + weights.role_pct + weights.exp_pct + weights.edu_pct : 100;
  const shortlisted = useMemo(() => list.data?.items.filter((e) => e.status === "shortlisted").length ?? 0, [list.data]);
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const s = runStatus.data;

  if (job.isLoading) return <Loading />;
  if (!job.data) return <Alert tone="error">{errorMessage(job.error, "Job not found.")}</Alert>;

  return (
    <>
      <PageHeader
        title={`Shortlist · ${job.data.title}`}
        subtitle={`${job.data.category ?? "Any category"} · ${job.data.skills?.length ?? 0} required skills · ${job.data.experience_years ?? 0}+ yrs · ${job.data.education ?? "no education requirement"}`}
        actions={
          <>
            <button className="btn" onClick={() => setHistory(true)}><History /> Review history</button>
            <button className="btn btn-primary" disabled={!shortlisted} onClick={() => setSharing(true)}><Send /> Share with hiring manager</button>
          </>
        }
      />

      <div className="grid grid-2" style={{ marginBottom: 16, alignItems: "start" }}>
        {/* ---- 1. matching ---- */}
        <div className="card">
          <div className="card-header"><div><h2>Matching</h2>
            <p>Compares every {job.data.category ?? ""} resume with this job description. Experience and education are scored by rules;
               resumes that are at least 75% similar are then scored by AI on skills and role.</p></div></div>
          <div className="card-body stack">
            <div className="row" style={{ justifyContent: "flex-start" }}>
              <button className="btn btn-primary" disabled={running || !job.data.skills?.length} onClick={() => start.mutate()}>
                <Play /> {running ? "Matching…" : list.data?.total ? "Match again" : "Start matching"}
              </button>
              {!job.data.skills?.length && <span className="muted small">Add required skills to the job first.</span>}
            </div>
            {start.isError && <Alert tone="error">{errorMessage(start.error)}</Alert>}
            {runId && s && (
              <div className="stack" style={{ gap: 8 }}>
                <StageTimeline stages={RUN_STAGES} current={s.stage} finished={s.finished} labels={STAGE_NAMES} />
                <div className="row small">
                  {s.considered !== null && <span className="badge plain">{s.considered} in {job.data.category ?? "the category"}</span>}
                  {s.pool !== null && <span className="badge green">{s.pool} at least 75% similar</span>}
                  {Boolean(s.below_threshold) && <span className="badge plain">{s.below_threshold} below 75%</span>}
                  {Boolean(s.not_indexed) && <span className="badge amber">{s.not_indexed} not searchable yet</span>}
                  {s.scored !== null && <span className="badge plain">{s.scored} scored</span>}
                  {Boolean(s.from_cache) && <span className="badge plain">{s.from_cache} reused</span>}
                  {Boolean(s.failed) && <span className="badge red">{s.failed} failed</span>}
                  {s.seconds !== null && <span className="badge plain">{s.seconds}s</span>}
                </div>
                {s.note && <Alert tone="warn">{s.note}</Alert>}
                {Boolean(s.not_indexed) && s.finished && (
                  <Alert tone="warn">{s.not_indexed} resume(s) are still being added to search and were left out. Run matching again later to include them.</Alert>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---- weights ---- */}
        <div className="card">
          <div className="card-header"><div><h2><SlidersHorizontal size={17} style={{ verticalAlign: -3 }} /> How the score is made</h2>
            <p>Default: skills 40%, experience 25%, role 20%, education 15%. Change them to re-rank instantly.</p></div></div>
          <div className="card-body stack">
            {weights && WEIGHT_LABELS.map(([key, label]) => (
              <div key={key} className="slider-row">
                <span>{label}</span>
                <input type="range" min={0} max={100} step={5} value={weights[key]}
                       onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })} />
                <strong style={{ textAlign: "right" }}>{weights[key]}%</strong>
              </div>
            ))}
            <div className="spread">
              <span className={sum === 100 ? "muted" : ""} style={sum === 100 ? undefined : { color: "var(--red-600)", fontWeight: 600 }}>
                Total {sum}% {sum !== 100 && "— must be 100%"}
              </span>
              <div className="row">
                <button className="btn btn-sm" onClick={() => setWeights({ skill_pct: 40, role_pct: 20, exp_pct: 25, edu_pct: 15 })}>Reset</button>
                <button className={`btn btn-sm ${preview ? "btn-primary" : ""}`} disabled={sum !== 100} onClick={() => setPreview(!preview)}>
                  {preview ? "Trying it" : "Try it"}
                </button>
                <button className="btn btn-sm btn-primary" disabled={sum !== 100 || saveWeights.isPending} onClick={() => weights && saveWeights.mutate(weights)}>Save</button>
              </div>
            </div>
            {preview && <Alert>You are seeing the ranking with these settings. Press Save to keep them.</Alert>}
            {saveWeights.isError && <Alert tone="error">{errorMessage(saveWeights.error)}</Alert>}
          </div>
        </div>
      </div>

      {/* ---- 2. results ---- */}
      <div className="card">
        <div className="card-header"><div><h2>Results</h2>
          <p>Everyone scored for this job, best first, with the reasons. Narrow them down, then shortlist the top candidates.</p></div></div>

        <div className="toolbar" style={{ display: "block" }}>
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <Wand2 size={16} style={{ color: "var(--brand-600)", flex: "none" }} />
            <input className="input" value={nlText} onChange={(e) => setNlText(e.target.value)}
                   placeholder='Describe who you want, e.g. "5+ yrs in chennai with docker"'
                   onKeyDown={(e) => e.key === "Enter" && nlText.trim() && interpret.mutate()} />
            <button className="btn" disabled={!nlText.trim() || interpret.isPending} onClick={() => interpret.mutate()}>
              {interpret.isPending ? "Reading…" : "Apply"}
            </button>
          </div>
          {interpret.isError && <div style={{ marginTop: 8 }}><Alert tone="error">{errorMessage(interpret.error)}</Alert></div>}
          {parsed && (
            <div style={{ marginTop: 8 }}>
              <Alert>
                <div className="stack" style={{ gap: 8 }}>
                  <div>Did you mean: <strong>“{parsed.corrected_text}”</strong>?</div>
                  <div className="row">
                    {Object.entries(parsed.filters).filter(([k, v]) => k !== "category" && v !== null && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
                      <span key={k} className="tag">{labelize(k)}: {Array.isArray(v) ? v.join(", ") : String(v)}</span>
                    ))}
                    {parsed.top_k && <span className="tag">Top {parsed.top_k}</span>}
                  </div>
                  <div className="row">
                    <button className="btn btn-sm btn-primary" onClick={() => applyParsed(parsed)}>Yes, use these filters</button>
                    <button className="btn btn-sm" onClick={() => setParsed(null)}>No</button>
                  </div>
                </div>
              </Alert>
            </div>
          )}
        </div>
        <div className="toolbar">
          <div style={{ minWidth: 220, flex: 1 }}>
            <TagInput value={filters.skills} onChange={(v) => setFilters({ ...filters, skills: v })} placeholder="Must-have skills" />
          </div>
          <input className="input" placeholder="Location" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} />
          <input className="input" style={{ maxWidth: 110 }} type="number" min={0} placeholder="Min yrs" value={filters.min_experience} onChange={(e) => setFilters({ ...filters, min_experience: e.target.value })} />
          <input className="input" style={{ maxWidth: 110 }} type="number" min={0} placeholder="Max yrs" value={filters.max_experience} onChange={(e) => setFilters({ ...filters, max_experience: e.target.value })} />
          <input className="input" placeholder="Education, e.g. B.Tech" value={filters.education} onChange={(e) => setFilters({ ...filters, education: e.target.value })} />
          <input className="input" style={{ maxWidth: 120 }} type="number" min={0} max={100} placeholder="Min score" value={filters.min_score} onChange={(e) => setFilters({ ...filters, min_score: e.target.value })} />
          <select className="select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
          </select>
          {filtered && <button className="btn btn-ghost btn-sm" onClick={() => setFilters(NO_FILTERS)}><X /> Clear</button>}
        </div>
        <div className="toolbar">
          <span className="muted">{list.data ? `${list.data.total} candidate(s)${filtered ? " match these filters" : ""}` : ""}</span>
          <div className="row" style={{ marginLeft: "auto" }}>
            <label className="small muted" htmlFor="topk">Top</label>
            <input id="topk" className="input" style={{ width: 80 }} type="number" min={1} max={100} value={topK}
                   onChange={(e) => setTopK(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
            <button className="btn btn-primary" disabled={!list.data?.total || pickTopK.isPending} onClick={() => pickTopK.mutate()}>
              <ListChecks /> Shortlist top {topK}
            </button>
          </div>
        </div>

        {list.isLoading && <Loading />}
        {list.isError && <div className="card-body"><Alert tone="error">{errorMessage(list.error)}</Alert></div>}
        {list.data?.items.length === 0 && (
          filtered
            ? <Empty title="No one matches these filters" icon={<Sparkles />}>Change or clear the filters.</Empty>
            : <Empty title="No results yet" icon={<Sparkles />}>Press “Start matching” to score the resumes for this job.</Empty>
        )}
        {list.data && list.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Candidate and reasons</th><th>Similar</th><th>Total</th><th>Skills</th><th>Role</th><th>Exp.</th><th>Edu.</th><th>Status</th><th title="In the shortlist">Shortlist</th><th>Resume</th></tr></thead>
              <tbody>
                {list.data.items.map((e, i) => {
                  const locked = Boolean(e.shared_to) || !["sourced", "shortlisted"].includes(e.status);
                  const reasons = (e.explanation?.reason ?? []).filter((r) => !r.endsWith("similar to the job description"));
                  const similarity = e.explanation?.similarity;
                  return (
                    <tr key={e.id} className="clickable" onClick={() => setOpenEntry(e)}>
                      <td><strong>{e.rank ?? i + 1}</strong></td>
                      <td style={{ minWidth: 280 }}>
                        <div className="cell-title">{e.name ?? "Name not given"} {e.notes_by_recruiter && <span title={e.notes_by_recruiter}>📝</span>}</div>
                        <div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience), e.location].filter((x) => x && x !== "—").join(" · ")}</div>
                        {reasons.length > 0 && (
                          <ul className="reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                        )}
                      </td>
                      <td>{similarity != null ? `${Math.round(similarity * 100)}%` : "—"}</td>
                      <td style={{ minWidth: 140 }}><ScoreBar value={e.total_score} /></td>
                      <td>{e.scores.skills ?? "—"}</td>
                      <td>{e.scores.role ?? "—"}</td>
                      <td>{e.scores.experience ?? "—"}</td>
                      <td>{e.scores.education ?? "—"}</td>
                      <td><StatusBadge status={e.status} />{e.shared_to && <div className="cell-sub">shared</div>}</td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <button className={`btn btn-sm btn-icon ${e.status === "shortlisted" ? "btn-primary" : ""}`} disabled={locked || toggle.isPending}
                                title={locked ? "Already shared or reviewed" : e.status === "shortlisted" ? "Remove from shortlist" : "Add to shortlist"}
                                onClick={() => toggle.mutate({ entryId: e.id, on: e.status !== "shortlisted" })}>
                          <Star />
                        </button>
                      </td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <button className="btn btn-sm" onClick={() => void openFile(`/api/v1/candidates/${e.candidate_id}/resume`)}><FileText /> View</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {openEntry && (
        <Drawer title="Candidate match" onClose={() => setOpenEntry(null)}>
          <EntryDetail key={openEntry.id + (openEntry.notes_by_recruiter ?? "")} entry={openEntry}
                       onOpenResume={() => void openFile(`/api/v1/candidates/${openEntry.candidate_id}/resume`)}
                       savingNotes={notes.isPending}
                       onSaveNotes={(text) => notes.mutate({ entryId: openEntry.id, text })} />
        </Drawer>
      )}
      {sharing && <ShareModal jobId={id} count={shortlisted} onClose={() => setSharing(false)}
                              onShared={() => void queryClient.invalidateQueries({ queryKey: ["shortlist", id] })} />}
      {history && <HistoryModal jobId={id} onClose={() => setHistory(false)} />}
    </>
  );
}

function ShareModal({ jobId, count, onClose, onShared }: { jobId: string; count: number; onClose: () => void; onShared: () => void }) {
  const toast = useToast();
  const managers = useQuery({ queryKey: ["directory", "hiring_manager"], queryFn: () => api.directory("hiring_manager") });
  const [managerId, setManagerId] = useState("");
  const [note, setNote] = useState("");
  const share = useMutation({
    mutationFn: () => api.share(jobId, managerId, note),
    onSuccess: (r) => {
      toast(`Shared ${r.shared} candidate(s)${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}.`, "success");
      onShared();
      onClose();
    },
  });
  return (
    <Modal title="Share with a hiring manager" onClose={onClose}
           footer={<><button className="btn" onClick={onClose}>Cancel</button>
             <button className="btn btn-primary" disabled={!managerId || share.isPending} onClick={() => share.mutate()}><Send /> Share {count} candidate(s)</button></>}>
      <p className="muted">The {count} shortlisted candidate(s) are shared with their scores, reasons and your notes.</p>
      {managers.isLoading && <Loading />}
      {managers.data?.length === 0 && <Alert tone="warn">There are no active hiring managers yet. An admin can invite one from Team.</Alert>}
      {managers.data && managers.data.length > 0 && (
        <div className="field"><label htmlFor="hm">Hiring manager</label>
          <select id="hm" className="select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Choose…</option>
            {managers.data.map((m) => <option key={m.id} value={m.id}>{m.name ? `${m.name} (${m.email})` : m.email}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label htmlFor="note">Message (optional)</label>
        <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please review by Friday" /></div>
      {share.isError && <Alert tone="error">{errorMessage(share.error)}</Alert>}
    </Modal>
  );
}

function HistoryModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const events = useQuery({ queryKey: ["review-history", jobId], queryFn: () => api.reviewHistory(jobId) });
  return (
    <Modal title="Review history" onClose={onClose} wide>
      {events.isLoading && <Loading />}
      {events.data?.length === 0 && <p className="muted">No reviews yet.</p>}
      <div className="events">
        {events.data?.map((e, i) => {
          const d = typeof e.detail === "object" && e.detail ? e.detail : {};
          const extra = ["comment", "note", "notes"].map((k) => d[k]).find(Boolean);
          return (
            <div key={i} className="event" style={{ gridTemplateColumns: "120px 1fr" }}>
              <time>{formatDateTime(e.at)}</time>
              <div><strong>{describeAction(e.action)}</strong>{extra ? <span className="muted"> — “{String(extra)}”</span> : null}</div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
