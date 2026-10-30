import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ListChecks, Send, Users, Wand2, X } from "lucide-react";
import { Alert, Empty, Loading, Modal, Pagination, ScoreBar, StatusBadge, useToast } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears, labelize, STATUS_LABEL } from "../../../utils/format";
import type { CandidateStatus, ParsedFilter, ShortlistEntry, ShortlistFilters, Weights } from "../../../types/api";
import EntryDetail from "../../shortlist/components/EntryDetail";
import { ShareModal } from "../../shortlist/components/ShareModals";

const LIMIT = 15;
const STATUSES = Object.keys(STATUS_LABEL) as CandidateStatus[];

/** Only "Matched" candidates can be added to the shortlist. */
const canShortlist = (e: ShortlistEntry) => e.status === "sourced" && !e.shared_to;
/** The tick works for matched (add) and shortlisted (remove) candidates; approved, rejected, interview
 *  and already-shared ones are locked. */
const canTick = (e: ShortlistEntry) => (e.status === "sourced" || e.status === "shortlisted") && !e.shared_to;
const lockedReason = (e: ShortlistEntry) => (e.shared_to ? "Already shared with a hiring manager" : `Already ${STATUS_LABEL[e.status].toLowerCase()}`);
/** A shortlisted candidate not shared yet can still be taken off the list (from the details panel). */
const canRemove = (e: ShortlistEntry) => e.status === "shortlisted" && !e.shared_to;

/** The filters the natural-language box produced, as list parameters. */
function filterParams(f: ShortlistFilters) {
  return {
    skills: f.must_have_skills ?? [], location: f.location ?? "", education: f.education ?? "",
    min_experience: f.min_experience ?? "", max_experience: f.max_experience ?? "",
  };
}

/** Job page: every candidate scored for this job, with a shortlist tick per row, "shortlist top K",
 *  and a plain-English filter. A row opens the match explanation (and the weights) in a centre panel. */
export default function JobCandidates({ jobId, previewWeights }: { jobId: string; previewWeights: Weights | null }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["job-candidates", jobId] });
  const [status, setStatus] = useState("");
  const [offset, setOffset] = useState(0);
  const [openEntry, setOpenEntry] = useState<ShortlistEntry | null>(null);
  const [nlText, setNlText] = useState("");
  const [parsed, setParsed] = useState<ParsedFilter | null>(null);
  const [applied, setApplied] = useState<ShortlistFilters>({});
  const [topK, setTopK] = useState(10);
  const [sharing, setSharing] = useState(false);
  const params = filterParams(applied);
  const hasFilter = Object.values(applied).some((v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && !v.length));

  // How many candidates have each status for this job (the plain-English filter applies too).
  const counts = useQuery({
    queryKey: ["job-candidates", jobId, "counts", applied],
    queryFn: async () => Object.fromEntries(await Promise.all(STATUSES.map(async (st) =>
      [st, (await api.shortlist(jobId, { ...params, status: st, limit: 1, include_unranked: true })).total] as const))),
  });
  const entries = useQuery({
    queryKey: ["job-candidates", jobId, status, applied, previewWeights, offset],
    queryFn: () => api.shortlist(jobId, {
      ...params, status, include_unranked: true, sort: "score", order: "desc", limit: LIMIT, offset, ...(previewWeights ?? {}),
    }),
    placeholderData: (previous) => previous,
  });
  const notShared = useQuery({
    queryKey: ["job-candidates", jobId, "to-share"],
    queryFn: async () => (await api.shortlist(jobId, { status: "shortlisted", limit: 200 })).items.filter((e) => !e.shared_to).length,
  });

  const interpret = useMutation({ mutationFn: () => api.parseFilter(nlText), onSuccess: setParsed, onError: (err) => toast(errorMessage(err), "error") });
  const applyParsed = (p: ParsedFilter) => {
    setApplied({ ...p.filters, category: null });
    if (p.top_k) setTopK(p.top_k);
    setParsed(null);
    setOffset(0);
  };
  const clearFilter = () => { setApplied({}); setNlText(""); setParsed(null); setOffset(0); };
  const pickTopK = useMutation({
    mutationFn: () => api.shortlistTopK(jobId, topK, {
      must_have_skills: applied.must_have_skills ?? [], location: applied.location ?? null, education: applied.education ?? null,
      min_experience: applied.min_experience ?? null, max_experience: applied.max_experience ?? null,
    }, null),
    onSuccess: (r) => { refresh(); toast(`Shortlisted ${r.shortlisted} of ${r.matching} matching candidate(s).`, "success"); },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const toggle = useMutation({
    mutationFn: ({ entryId, on }: { entryId: string; on: boolean }) => api.toggleShortlist(entryId, on),
    onSuccess: (entry) => { setOpenEntry((current) => (current?.id === entry.id ? entry : current)); refresh(); },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const saveNotes = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) => api.setNotes(entryId, text),
    onSuccess: (entry) => { setOpenEntry((current) => (current ? entry : current)); refresh(); toast("Note saved.", "success"); },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const openResume = (e: ShortlistEntry) => openFile(`/api/v1/candidates/${e.candidate_id}/resume`, e.name ?? "Resume");
  const all = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : null;
  const toShare = notShared.data ?? 0;

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div><h2><Users size={18} style={{ verticalAlign: -3 }} /> Candidates for this job</h2>
          <p>Tick candidates to shortlist them, or shortlist the top K. Click a candidate to see why they got their score.</p></div>
        <div className="row">
          <button className="btn btn-primary" disabled={!toShare} onClick={() => setSharing(true)}>
            <Send /> Share with hiring manager{toShare ? ` (${toShare})` : ""}
          </button>
        </div>
      </div>

      <div className="toolbar slim logs-toolbar job-candidates-toolbar">
        <select className="select status-select" aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setOffset(0); }}>
          <option value="">Status: All ({all ?? "…"})</option>
          {STATUSES.map((st) => <option key={st} value={st}>Status: {STATUS_LABEL[st]} ({counts.data?.[st] ?? "…"})</option>)}
        </select>
        <div className="row grow" style={{ position: "relative" }}>
          <Wand2 size={16} style={{ position: "absolute", left: 10, color: "var(--brand-600)" }} />
          <input className="input grow" style={{ paddingLeft: 32 }} value={nlText} onChange={(e) => setNlText(e.target.value)}
                 placeholder='Describe who you want, e.g. "5+ yrs in chennai with docker"'
                 onKeyDown={(e) => e.key === "Enter" && nlText.trim() && interpret.mutate()} />
        </div>
        <button className="btn btn-sm" disabled={!nlText.trim() || interpret.isPending} onClick={() => interpret.mutate()}>
          {interpret.isPending ? "Reading…" : "Apply"}
        </button>
        <label className="small muted" htmlFor="topk" style={{ whiteSpace: "nowrap" }}>Top</label>
        <input id="topk" className="input topk-input" type="number" min={1} max={100} value={topK}
               onChange={(e) => setTopK(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
        <button className="btn btn-sm btn-primary" style={{ whiteSpace: "nowrap" }} disabled={!all || pickTopK.isPending} onClick={() => pickTopK.mutate()}>
          <ListChecks /> Shortlist top {topK}
        </button>
      </div>

      {parsed && (
        <div className="card-body" style={{ paddingBottom: 0 }}>
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
      {hasFilter && (
        <div className="applied-filters">
          <span className="muted small">Filtered by:</span>
          {Object.entries(applied).filter(([k, v]) => k !== "category" && v !== null && v !== undefined && !(Array.isArray(v) && !v.length)).map(([k, v]) => (
            <span key={k} className="tag">{labelize(k)}: {Array.isArray(v) ? v.join(", ") : String(v)}</span>
          ))}
          <button className="btn btn-ghost btn-sm" onClick={clearFilter}><X /> Clear</button>
        </div>
      )}

      {entries.isLoading && <Loading />}
      {entries.isError && <div className="card-body"><Alert tone="error">{errorMessage(entries.error)}</Alert></div>}
      {entries.data?.items.length === 0 && (
        all === 0 && !hasFilter
          ? <Empty title="No candidates matched yet" icon={<ListChecks />}>Press “Start matching” above to score resumes for this job.</Empty>
          : <Empty title="No candidates here" icon={<Users />}>Try another status or clear the filter.</Empty>
      )}
      {entries.data && entries.data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Candidate</th><th>Score</th><th>Skills</th><th>Role</th><th>Exp.</th><th>Edu.</th><th>Status</th><th>Shortlist</th><th>Resume</th></tr></thead>
            <tbody>
              {entries.data.items.map((e, i) => (
                <tr key={e.id} className="clickable" onClick={() => setOpenEntry(e)}>
                  <td><strong>{e.rank ?? offset + i + 1}</strong></td>
                  <td><div className="cell-title">{e.name ?? "Name not given"} {e.notes_by_recruiter && <span title={e.notes_by_recruiter}>📝</span>}</div>
                    <div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience), e.location].filter((x) => x && x !== "—").join(" · ")}</div></td>
                  <td><ScoreBar value={e.total_score} /></td>
                  <td>{e.scores.skills ?? "—"}</td>
                  <td>{e.scores.role ?? "—"}</td>
                  <td>{e.scores.experience ?? "—"}</td>
                  <td>{e.scores.education ?? "—"}</td>
                  <td><StatusBadge status={e.status} />{e.shared_to && <div className="cell-sub">shared</div>}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <input type="checkbox" className="shortlist-check" checked={e.status !== "sourced"}
                           disabled={!canTick(e) || toggle.isPending}
                           title={!canTick(e) ? lockedReason(e) : e.status === "shortlisted" ? "Remove from shortlist" : "Add to shortlist"}
                           aria-label={`Shortlist ${e.name ?? "candidate"}`}
                           onChange={() => toggle.mutate({ entryId: e.id, on: e.status !== "shortlisted" })} />
                  </td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <button className="btn btn-sm" onClick={() => openResume(e)}><FileText /> View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {entries.data && <Pagination total={entries.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}

      {openEntry && (
        <Modal title="Candidate details" onClose={() => setOpenEntry(null)} wide
               footer={<>
                 {canRemove(openEntry) && (
                   <button className="btn" disabled={toggle.isPending} onClick={() => toggle.mutate({ entryId: openEntry.id, on: false })}><X /> Remove from shortlist</button>
                 )}
                 <button className="btn btn-primary" disabled={!canShortlist(openEntry) || toggle.isPending}
                         title={canShortlist(openEntry) ? undefined : `Already ${STATUS_LABEL[openEntry.status].toLowerCase()}`}
                         onClick={() => toggle.mutate({ entryId: openEntry.id, on: true })}>
                   <ListChecks /> {canShortlist(openEntry) ? "Shortlist" : STATUS_LABEL[openEntry.status]}
                 </button>
                 <button className="btn" onClick={() => openResume(openEntry)}><FileText /> View resume</button>
               </>}>
          <EntryDetail key={openEntry.id + openEntry.status} entry={openEntry} onOpenResume={() => openResume(openEntry)}
                       onSaveNotes={(text) => saveNotes.mutate({ entryId: openEntry.id, text })} savingNotes={saveNotes.isPending} />
        </Modal>
      )}
      {sharing && <ShareModal jobId={jobId} count={toShare} onClose={() => setSharing(false)} onShared={refresh} />}
    </div>
  );
}
