import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, GitCompare, History, LayoutGrid, ListChecks, PenLine, Play, Rows3, Send, SlidersHorizontal, Sparkles, Wand2, X } from "lucide-react";
import {
  Alert, Drawer, Empty, Loading, Modal, PageHeader, ScoreBar, StatusBadge, TagInput, useToast,
} from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { describeAction, formatDateTime, formatYears, labelize, STATUS_LABEL } from "../../../utils/format";
import type { ParsedFilter, ShortlistEntry, Weights } from "../../../types/api";
import EntryDetail from "./EntryDetail";
import MatchPipeline from "./MatchPipeline";
import { CandidateCards, CompareModal } from "./CandidateCards";
import { DEFAULT_WEIGHTS, SCORE_PARTS } from "../scoreParts";


const total = (w: Weights) => w.skill_pct + w.role_pct + w.exp_pct + w.edu_pct;

interface ResultFilters {
  skills: string[]; location: string; min_experience: string; max_experience: string;
  education: string; min_score: string; max_score: string; status: string;
}
const NO_FILTERS: ResultFilters = { skills: [], location: "", min_experience: "", max_experience: "", education: "", min_score: "", max_score: "", status: "" };
const num = (v: string) => (v === "" ? null : Number(v));

export default function JobShortlistPage() {
  const { id = "" } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
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
  // Coming from "Start matching" on the Shortlists page: begin right away, once.
  const autostarted = useRef(false);
  useEffect(() => {
    if ((location.state as { autostart?: boolean } | null)?.autostart && job.data?.skills?.length && !autostarted.current) {
      autostarted.current = true;
      start.mutate();
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [job.data, location.state, location.pathname, navigate, start]);

  // 2. results, then filters / natural-language filter / top K
  const [filters, setFilters] = useState<ResultFilters>(NO_FILTERS);
  const [topK, setTopK] = useState(10);
  const [nlText, setNlText] = useState("");
  const [parsed, setParsed] = useState<ParsedFilter | null>(null);
  const [weights, setWeights] = useState<Weights | null>(null);
  const [savedWeights, setSavedWeights] = useState<Weights | null>(null);
  const [preview, setPreview] = useState(false);
  const [openEntry, setOpenEntry] = useState<ShortlistEntry | null>(null);
  const [sharing, setSharing] = useState(false);
  const [history, setHistory] = useState(false);
  const [tab, setTab] = useState<"matches" | "shortlisted">("matches");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [compare, setCompare] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const toggleCompare = (entryId: string) => setCompare((c) => c.includes(entryId) ? c.filter((x) => x !== entryId) : c.length >= 3 ? [...c.slice(1), entryId] : [...c, entryId]);

  const list = useQuery({
    queryKey: ["shortlist", id, filters, preview ? weights : null],
    queryFn: () => api.shortlist(id, {
      skills: filters.skills, location: filters.location, education: filters.education,
      min_experience: filters.min_experience, max_experience: filters.max_experience,
      min_score: filters.min_score, max_score: filters.max_score, status: filters.status,
      sort: "score", order: "desc", limit: 200, ...(preview && weights ? weights : {}),
    }),
  });
  useEffect(() => {
    if (list.data && !weights) { setWeights(list.data.weights); setSavedWeights(list.data.weights); }
  }, [list.data, weights]);

  const picked = useQuery({
    queryKey: ["shortlist", id, "shortlisted"],
    queryFn: () => api.shortlist(id, { status: "shortlisted", sort: "score", order: "desc", limit: 200 }),
  });

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
      setTab("shortlisted");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const saveWeights = useMutation({
    mutationFn: (w: Weights) => api.saveWeights(id, w),
    onSuccess: (_r, saved) => {
      setSavedWeights(saved);
      setPreview(false);
      void queryClient.invalidateQueries({ queryKey: ["shortlist", id] });
      toast("Weights saved and results re-ranked.", "success");
    },
  });
  const notes = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) => api.setNotes(entryId, text),
    onSuccess: (entry) => {
      setOpenEntry((current) => (current ? entry : current));
      void queryClient.invalidateQueries({ queryKey: ["shortlist", id] });
      toast("Note saved.", "success");
    },
  });
  const toggle = useMutation({
    mutationFn: ({ entryId, on }: { entryId: string; on: boolean }) => api.toggleShortlist(entryId, on),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["shortlist", id] }),
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const sum = weights ? total(weights) : 100;
  const changed = Boolean(weights && savedWeights && (Object.keys(weights) as (keyof Weights)[]).some((k) => weights[k] !== savedWeights[k]));
  const toShare = useMemo(() => picked.data?.items.filter((e) => !e.shared_to).length ?? 0, [picked.data]);
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);
  const s = runStatus.data;

  if (job.isLoading) return <Loading />;
  if (!job.data) return <Alert tone="error">{errorMessage(job.error, "Job not found.")}</Alert>;

  return (
    <>
      <PageHeader
        title={`Shortlist · ${job.data.title}`}
        subtitle={`${job.data.category ?? "Any category"} · ${job.data.skills?.length ?? 0} required skills · ${job.data.experience_years ?? 0}+ yrs · ${job.data.education ?? "no education requirement"}`}
        actions={<button className="btn" onClick={() => setHistory(true)}><History /> Review history</button>}
      />

      <div className="grid grid-2" style={{ marginBottom: 16, alignItems: "start" }}>
        {/* ---- 1. matching ---- */}
        <div className="card">
          <div className="card-header"><div><h2>Matching</h2>
            <p>Compares every {job.data.category ?? ""} resume with this job. All resumes at 75% similarity or more are scored;
               if fewer than 10 reach it, the next best are added up to 20 (never below 50%).</p></div></div>
          <div className="card-body stack">
            <div className="row" style={{ justifyContent: "flex-start" }}>
              <button className="btn btn-primary" disabled={running || !job.data.skills?.length} onClick={() => start.mutate()}>
                <Play /> {running ? "Matching…" : list.data?.total ? "Match again" : "Start matching"}
              </button>
              {!job.data.skills?.length && <span className="muted small">Add required skills to the job first.</span>}
            </div>
            {start.isError && <Alert tone="error">{errorMessage(start.error)}</Alert>}
            {(runId || running) && (
              <div className="stack" style={{ gap: 10 }}>
                <MatchPipeline status={s} running={running} />
                {s?.note && <Alert tone={s.pool ? "info" : "warn"}>{s.note}</Alert>}
                {Boolean(s?.not_indexed) && s?.finished && (
                  <Alert tone="warn">{s?.not_indexed} resume(s) are still being added to search and were left out. Run matching again later to include them.</Alert>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---- weights ---- */}
        <div className="card">
          <div className="card-header"><div><h2><SlidersHorizontal size={17} style={{ verticalAlign: -3 }} /> How the score is made</h2>
            <p>Every job starts with the default weights: 40% skills, 25% experience, 20% role and industry, 15% education. Change them only if this job needs it; the four must add up to 100%.</p></div></div>
          <div className="card-body stack">
            {weights && SCORE_PARTS.map(({ weight: key, label, color, hint }) => (
              <div key={key} className="slider-row weight-row">
                <span className="weight-name"><span><i className="dot-swatch" style={{ background: color }} /> {label}</span><small className="muted">{hint}</small></span>
                <input type="range" className="weight-slider" min={0} max={100} step={5} value={weights[key]}
                       style={{ ["--c" as string]: color, ["--v" as string]: `${weights[key]}%` }} aria-label={`${label} weight`}
                       onChange={(e) => { const next = { ...weights, [key]: Number(e.target.value) }; setWeights(next); setPreview(total(next) === 100); }} />
                <strong style={{ textAlign: "right" }}>{weights[key]}%</strong>
              </div>
            ))}
            <div className="spread">
              <span className={sum === 100 ? "muted" : ""} style={sum === 100 ? undefined : { color: "var(--red-600)", fontWeight: 600 }}>
                Total {sum}% {sum !== 100 && "— the four weights must add up to 100% before you can save"}
              </span>
              <div className="row">
                <button className="btn btn-sm" onClick={() => { setWeights({ ...DEFAULT_WEIGHTS }); setPreview(true); }}>Reset</button>
                <button className="btn btn-sm btn-primary" disabled={sum !== 100 || !changed || saveWeights.isPending} onClick={() => weights && saveWeights.mutate(weights)}>Save</button>
              </div>
            </div>
            {sum !== 100 && <Alert tone="warn">The weights add up to {sum}%. Change them until the total is exactly 100%.</Alert>}
            {preview && sum === 100 && <Alert>Live preview: the ranking below uses these weights. Press Save to keep them.</Alert>}
            {saveWeights.isError && <Alert tone="error">{errorMessage(saveWeights.error)}</Alert>}
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === "matches" ? "active" : ""}`} onClick={() => setTab("matches")}>
          Matches {list.data ? `(${list.data.total})` : ""}
        </button>
        <button className={`tab ${tab === "shortlisted" ? "active" : ""}`} onClick={() => setTab("shortlisted")}>
          Shortlisted {picked.data ? `(${picked.data.total})` : ""}
        </button>
      </div>

      {tab === "matches" && (
        <>
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
          <input className="input" style={{ maxWidth: 120 }} type="number" min={0} max={100} placeholder="Score from" value={filters.min_score} onChange={(e) => setFilters({ ...filters, min_score: e.target.value })} />
          <input className="input" style={{ maxWidth: 120 }} type="number" min={0} max={100} placeholder="Score to" value={filters.max_score} onChange={(e) => setFilters({ ...filters, max_score: e.target.value })} />
          <select className="select" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((st) => <option key={st} value={st}>{STATUS_LABEL[st]}</option>)}
          </select>
          {filtered && <button className="btn btn-ghost btn-sm" onClick={() => setFilters(NO_FILTERS)}><X /> Clear</button>}
        </div>
        <div className="toolbar">
          <span className="muted">{list.data ? `${list.data.total} candidate(s)${filtered ? " match these filters" : ""}` : ""}</span>
          <div className="segmented" role="tablist" aria-label="Results view">
            <button role="tab" aria-selected={view === "cards"} className={view === "cards" ? "active" : ""} onClick={() => setView("cards")}><LayoutGrid /> Cards</button>
            <button role="tab" aria-selected={view === "table"} className={view === "table" ? "active" : ""} onClick={() => setView("table")}><Rows3 /> Table</button>
          </div>
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
        {list.data && list.data.items.length > 0 && view === "cards" && (
          <div className="card-body">
            <CandidateCards items={list.data.items} onOpen={setOpenEntry} compare={compare} onCompare={toggleCompare}
                            toggling={toggle.isPending} onToggle={(entryId, on) => toggle.mutate({ entryId, on })} />
          </div>
        )}
        {list.data && list.data.items.length > 0 && view === "table" && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>#</th><th>Candidate and reasons</th><th>Total</th><th>Skills</th><th>Role</th><th>Exp.</th><th>Edu.</th><th>Status</th><th title="In the shortlist">Shortlist</th><th>Resume</th></tr></thead>
              <tbody>
                {list.data.items.map((e, i) => {
                  const locked = Boolean(e.shared_to) || !["sourced", "shortlisted"].includes(e.status);
                  const reasons = (e.explanation?.reason ?? []).filter((r) => !/(similar to|matching with) the job description$/.test(r));
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
                      <td style={{ minWidth: 140 }}><ScoreBar value={e.total_score} /></td>
                      <td>{e.scores.skills ?? "—"}</td>
                      <td>{e.scores.role ?? "—"}</td>
                      <td>{e.scores.experience ?? "—"}</td>
                      <td>{e.scores.education ?? "—"}</td>
                      <td><StatusBadge status={e.status} />{e.shared_to && <div className="cell-sub">shared</div>}</td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <input type="checkbox" className="shortlist-check" checked={e.status !== "sourced"}
                               disabled={locked || toggle.isPending}
                               title={locked ? "Already shared or reviewed" : e.status === "shortlisted" ? "Remove from shortlist" : "Add to shortlist"}
                               aria-label={`Shortlist ${e.name ?? "candidate"}`}
                               onChange={() => toggle.mutate({ entryId: e.id, on: e.status !== "shortlisted" })} />
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

        </>
      )}

      {tab === "shortlisted" && (
        <>
      {/* ---- 3. shortlisted: notes, then share ---- */}
      <div className="card">
        <div className="card-header">
          <div><h2>Shortlisted {picked.data ? `(${picked.data.total})` : ""}</h2>
            <p>Write why you chose each person, then share them with a hiring manager.</p></div>
          <button className="btn btn-primary" disabled={!toShare} onClick={() => setSharing(true)}>
            <Send /> Share with hiring manager{toShare ? ` (${toShare})` : ""}
          </button>
        </div>
        {picked.isLoading && <Loading />}
        {picked.data?.items.length === 0 && (
          <Empty title="No one shortlisted yet" icon={<ListChecks />}>Use “Shortlist top K” above, or the star on a result.</Empty>
        )}
        {picked.data && picked.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Candidate</th><th>Total</th><th>Status</th><th style={{ minWidth: 300 }}>Your note</th><th></th></tr></thead>
              <tbody>
                {picked.data.items.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div className="cell-title">{e.name ?? "Name not given"}</div>
                      <div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience), e.location].filter((x) => x && x !== "—").join(" · ")}</div>
                    </td>
                    <td style={{ minWidth: 130 }}><ScoreBar value={e.total_score} /></td>
                    <td>{e.shared_to ? <span className="badge brand plain">Shared</span> : <StatusBadge status={e.status} />}</td>
                    <td><NoteCell key={e.id + (e.notes_by_recruiter ?? "")} entry={e} saving={notes.isPending}
                                  onSave={(text) => notes.mutate({ entryId: e.id, text })} /></td>
                    <td>
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <button className="btn btn-sm" onClick={() => void openFile(`/api/v1/candidates/${e.candidate_id}/resume`)}><FileText /> View</button>
                        {!e.shared_to && (
                          <button className="btn btn-sm btn-ghost" disabled={toggle.isPending} title="Remove from the shortlist"
                                  onClick={() => toggle.mutate({ entryId: e.id, on: false })}><X /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        </>
      )}

      {compare.length > 0 && (
        <div className="compare-bar" role="status">
          <span><GitCompare size={16} /> <strong>{compare.length}</strong> selected to compare{compare.length < 2 && " (pick one more)"}</span>
          <span className="row">
            <button className="btn btn-sm btn-ghost" onClick={() => setCompare([])}>Clear</button>
            <button className="btn btn-sm btn-primary" disabled={compare.length < 2} onClick={() => setComparing(true)}>Compare</button>
          </span>
        </div>
      )}
      {comparing && list.data && (
        <CompareModal entries={list.data.items.filter((e) => compare.includes(e.id))} onClose={() => setComparing(false)} />
      )}
      {openEntry && (
        <Drawer title="Candidate match" onClose={() => setOpenEntry(null)} half>
          <EntryDetail key={openEntry.id + (openEntry.notes_by_recruiter ?? "")} entry={openEntry}
                       onOpenResume={() => void openFile(`/api/v1/candidates/${openEntry.candidate_id}/resume`)}
                       savingNotes={notes.isPending}
                       onSaveNotes={(text) => notes.mutate({ entryId: openEntry.id, text })} />
        </Drawer>
      )}
      {sharing && <ShareModal jobId={id} count={toShare} onClose={() => setSharing(false)}
                              onShared={() => void queryClient.invalidateQueries({ queryKey: ["shortlist", id] })} />}
      {history && <HistoryModal jobId={id} onClose={() => setHistory(false)} />}
    </>
  );
}

/** The recruiter's note on why this person was chosen (sent to the hiring manager). */
function NoteCell({ entry, saving, onSave }: { entry: ShortlistEntry; saving: boolean; onSave: (text: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(entry.notes_by_recruiter ?? "");
  if (!editing) {
    return entry.notes_by_recruiter ? (
      <div><span className="note-text">{entry.notes_by_recruiter}</span>{" "}
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button></div>
    ) : (
      <button className="btn btn-sm" onClick={() => setEditing(true)}><PenLine /> Add a note</button>
    );
  }
  return (
    <div className="note-cell">
      <textarea className="textarea" autoFocus value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Why did you choose this person? e.g. Strong FastAPI work, can join in 30 days" maxLength={1000} />
      <div className="row" style={{ marginTop: 6 }}>
        <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => { onSave(text); setEditing(false); }}>Save</button>
        <button className="btn btn-sm" onClick={() => { setText(entry.notes_by_recruiter ?? ""); setEditing(false); }}>Cancel</button>
      </div>
    </div>
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
      <p className="muted">The {count} shortlisted candidate(s) not shared yet go to the hiring manager with their scores, reasons and your notes.</p>
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
