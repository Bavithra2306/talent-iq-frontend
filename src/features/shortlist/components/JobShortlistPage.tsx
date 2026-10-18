import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Play, Send, SlidersHorizontal, Sparkles, Star, Wand2, FileText } from "lucide-react";
import {
  Alert, Drawer, Empty, Loading, Modal, PageHeader, ScoreBar, StageTimeline, StatusBadge, TagInput, useToast,
} from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { describeAction, formatDateTime, formatYears, labelize, STATUS_LABEL } from "../../../utils/format";
import type { ParsedFilter, ShortlistEntry, ShortlistFilters, Stage, Weights } from "../../../types/api";
import EntryDetail from "./EntryDetail";

const RUN_STAGES: Stage[] = ["created", "collecting", "reading", "scoring", "shortlisted"];
const WEIGHT_LABELS: [keyof Weights, string][] = [
  ["skill_pct", "Skills"], ["role_pct", "Role"], ["exp_pct", "Experience"], ["edu_pct", "Education"],
];

export default function JobShortlistPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const job = useQuery({ queryKey: ["job", id], queryFn: () => api.getJob(id) });

  // run settings
  const [filters, setFilters] = useState<ShortlistFilters>({ must_have_skills: [] });
  const [topK, setTopK] = useState(10);
  const [runId, setRunId] = useState<string | null>(null);
  const [nlText, setNlText] = useState("");
  const [parsed, setParsed] = useState<ParsedFilter | null>(null);
  useEffect(() => {
    if (job.data?.category) setFilters((f) => ({ ...f, category: f.category ?? job.data?.category }));
  }, [job.data?.category]);

  // results view
  const [view, setView] = useState({ status: "", min_score: "", skill: "", location: "", sort: "rank", order: "asc", include_unranked: false });
  const [weights, setWeights] = useState<Weights | null>(null);
  const [preview, setPreview] = useState(false);
  const [openEntry, setOpenEntry] = useState<ShortlistEntry | null>(null);
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(false);

  const list = useQuery({
    queryKey: ["shortlist", id, view, preview ? weights : null],
    queryFn: () => api.shortlist(id, { ...view, limit: 200, ...(preview && weights ? weights : {}) }),
  });
  useEffect(() => {
    if (list.data && !weights) setWeights(list.data.weights);
  }, [list.data, weights]);

  const runStatus = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.runStatus(runId!),
    enabled: Boolean(runId),
    refetchInterval: (q) => (q.state.data?.finished ? false : 2000),
  });
  useEffect(() => {
    if (runStatus.data?.finished) void queryClient.invalidateQueries({ queryKey: ["shortlist", id] });
  }, [runStatus.data?.finished, id, queryClient]);

  const interpret = useMutation({ mutationFn: () => api.parseFilter(nlText), onSuccess: setParsed });
  const run = useMutation({
    mutationFn: () => api.runShortlist(id, filters, topK),
    onSuccess: (r) => setRunId(r.run_id),
  });
  const saveWeights = useMutation({
    mutationFn: (w: Weights) => api.saveWeights(id, w),
    onSuccess: (data) => {
      setPreview(false);
      queryClient.setQueryData(["shortlist", id, view, null], data);
      void queryClient.invalidateQueries({ queryKey: ["shortlist", id] });
      toast("Weights saved and shortlist re-ranked.", "success");
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
  const running = Boolean(runId && !runStatus.data?.finished);

  if (job.isLoading) return <Loading />;
  if (!job.data) return <Alert tone="error">{errorMessage(job.error, "Job not found.")}</Alert>;

  return (
    <>
      <PageHeader
        crumb={<><Link to="/shortlists">Shortlists</Link> / <Link to={`/jobs/${id}`}>{job.data.title}</Link></>}
        title={`Shortlist · ${job.data.title}`}
        subtitle={`${job.data.skills?.length ?? 0} required skills · ${job.data.experience_years ?? 0}+ yrs · ${job.data.education ?? "no education requirement"}`}
        actions={
          <>
            <button className="btn" onClick={() => setHistory(true)}><History /> Review history</button>
            <button className="btn btn-primary" disabled={!shortlisted} onClick={() => setSharing(true)}><Send /> Share with hiring manager</button>
          </>
        }
      />

      <div className="grid grid-2" style={{ marginBottom: 16, alignItems: "start" }}>
        {/* ---- run matching ---- */}
        <div className="card">
          <div className="card-header"><div><h2>Find candidates</h2><p>Choose who to consider. AI then checks each person’s skills and past jobs against this role.</p></div></div>
          <div className="card-body stack">
            <div className="field">
              <label htmlFor="nl"><Wand2 size={14} style={{ verticalAlign: -2 }} /> Describe who you want</label>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input id="nl" className="input" value={nlText} onChange={(e) => setNlText(e.target.value)}
                       placeholder='e.g. "5yrs experince in chenai with pythn"' onKeyDown={(e) => e.key === "Enter" && nlText.trim() && interpret.mutate()} />
                <button className="btn" disabled={!nlText.trim() || interpret.isPending} onClick={() => interpret.mutate()}>
                  {interpret.isPending ? "Reading…" : "Go"}
                </button>
              </div>
              {interpret.isError && <Alert tone="error">{errorMessage(interpret.error)}</Alert>}
            </div>
            {parsed && (
              <Alert>
                <div className="stack" style={{ gap: 8 }}>
                  <div>Did you mean: <strong>“{parsed.corrected_text}”</strong>?</div>
                  <div className="row">
                    {Object.entries(parsed.filters).filter(([, v]) => v !== null && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
                      <span key={k} className="tag">{labelize(k)}: {Array.isArray(v) ? v.join(", ") : String(v)}</span>
                    ))}
                    {parsed.top_k && <span className="tag">Top {parsed.top_k}</span>}
                  </div>
                  <div className="row">
                    <button className="btn btn-sm btn-primary" onClick={() => {
                      setFilters({ ...parsed.filters, category: parsed.filters.category ?? filters.category, must_have_skills: parsed.filters.must_have_skills ?? [] });
                      if (parsed.top_k) setTopK(parsed.top_k);
                      setParsed(null);
                    }}>Yes, use these filters</button>
                    <button className="btn btn-sm" onClick={() => setParsed(null)}>No</button>
                  </div>
                </div>
              </Alert>
            )}
            <div className="form-grid">
              <div className="field"><label>Category</label>
                <input className="input" value={filters.category ?? ""} onChange={(e) => setFilters({ ...filters, category: e.target.value || null })} placeholder="Any" /></div>
              <div className="field"><label>Location</label>
                <input className="input" value={filters.location ?? ""} onChange={(e) => setFilters({ ...filters, location: e.target.value || null })} placeholder="Any" /></div>
              <div className="field"><label>Min experience</label>
                <input className="input" type="number" min={0} value={filters.min_experience ?? ""} onChange={(e) => setFilters({ ...filters, min_experience: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="field"><label>Max experience</label>
                <input className="input" type="number" min={0} value={filters.max_experience ?? ""} onChange={(e) => setFilters({ ...filters, max_experience: e.target.value === "" ? null : Number(e.target.value) })} /></div>
              <div className="field"><label>Education contains</label>
                <input className="input" value={filters.education ?? ""} onChange={(e) => setFilters({ ...filters, education: e.target.value || null })} placeholder="e.g. B.Tech" /></div>
              <div className="field"><label>How many to shortlist</label>
                <input className="input" type="number" min={1} max={100} value={topK} onChange={(e) => setTopK(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} /></div>
              <div className="field full"><span className="label">Must-have skills</span>
                <TagInput value={filters.must_have_skills ?? []} onChange={(v) => setFilters({ ...filters, must_have_skills: v })} placeholder="Only people who have these skills" /></div>
            </div>
            {run.isError && <Alert tone="error">{errorMessage(run.error)}</Alert>}
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btn-primary" disabled={running || run.isPending || !job.data.skills?.length} onClick={() => run.mutate()}>
                <Play /> {running ? "Finding matches…" : "Find best matches"}
              </button>
            </div>
            {runId && runStatus.data && (
              <div className="stack" style={{ gap: 8 }}>
                <StageTimeline stages={RUN_STAGES} current={runStatus.data.stage} finished={runStatus.data.finished} />
                <div className="row small">
                  {runStatus.data.pool !== null && <span className="badge plain">{runStatus.data.pool} checked</span>}
                  {runStatus.data.scored !== null && <span className="badge plain">{runStatus.data.scored} scored</span>}
                  {Boolean(runStatus.data.from_cache) && <span className="badge plain">{runStatus.data.from_cache} scored before</span>}
                  {runStatus.data.shortlisted !== null && <span className="badge green">{runStatus.data.shortlisted} shortlisted</span>}
                  {Boolean(runStatus.data.failed) && <span className="badge red">{runStatus.data.failed} failed</span>}
                  {runStatus.data.seconds !== null && <span className="badge plain">{runStatus.data.seconds}s</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---- weights ---- */}
        <div className="card">
          <div className="card-header"><div><h2><SlidersHorizontal size={17} style={{ verticalAlign: -3 }} /> What matters most</h2><p>Move the sliders to change how candidates are ranked. Changes show instantly.</p></div></div>
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

      {/* ---- results ---- */}
      <div className="card">
        <div className="toolbar">
          <select className="select" value={view.status} onChange={(e) => setView({ ...view, status: e.target.value })}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <input className="input" type="number" min={0} max={100} placeholder="Min score" value={view.min_score} onChange={(e) => setView({ ...view, min_score: e.target.value })} />
          <input className="input" placeholder="Skill" value={view.skill} onChange={(e) => setView({ ...view, skill: e.target.value })} />
          <input className="input" placeholder="Location" value={view.location} onChange={(e) => setView({ ...view, location: e.target.value })} />
          <select className="select" value={`${view.sort}:${view.order}`} onChange={(e) => { const [s, o] = e.target.value.split(":"); setView({ ...view, sort: s, order: o }); }}>
            <option value="rank:asc">Rank</option>
            <option value="score:desc">Highest score</option>
            <option value="experience:desc">Most experience</option>
            <option value="date_added:desc">Newest</option>
            <option value="name:asc">Name A–Z</option>
          </select>
          <label className="check small"><input type="checkbox" checked={view.include_unranked} onChange={(e) => setView({ ...view, include_unranked: e.target.checked })} /> Show earlier results</label>
        </div>
        {list.isLoading && <Loading />}
        {list.isError && <div className="card-body"><Alert tone="error">{errorMessage(list.error)}</Alert></div>}
        {list.data?.items.length === 0 && (
          <Empty title="No matches yet" icon={<Sparkles />}>Press “Find best matches” above to check candidates for this job.</Empty>
        )}
        {list.data && list.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Candidate</th><th>Total</th><th>Skills</th><th>Role</th><th>Experience</th><th>Education</th><th>Status</th><th title="In final shortlist">Shortlist</th><th>Resume</th></tr></thead>
              <tbody>
                {list.data.items.map((e) => {
                  const locked = Boolean(e.shared_to) || !["sourced", "shortlisted"].includes(e.status);
                  return (
                    <tr key={e.id} className="clickable" onClick={() => setOpenEntry(e)}>
                      <td><strong>{e.rank ?? "—"}</strong></td>
                      <td>
                        <div className="cell-title">{e.name ?? "Name not given"} {e.notes_by_recruiter && <span title={e.notes_by_recruiter}>📝</span>}</div>
                        <div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience), e.location].filter((x) => x && x !== "—").join(" · ")}</div>
                      </td>
                      <td style={{ minWidth: 150 }}><ScoreBar value={e.total_score} /></td>
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
      <p className="muted">The {count} shortlisted candidate(s) are shared with their scores, explanations and your notes.</p>
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
