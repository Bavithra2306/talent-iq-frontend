import { useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, GitCompare, MapPin, Plus, StickyNote } from "lucide-react";
import { Modal, ScoreRing, StatusBadge, useToast } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears } from "../../../utils/format";
import type { ShortlistEntry } from "../../../types/api";

const PARTS = [
  { key: "skills", label: "Skills", color: "#1D4ED8" },
  { key: "role", label: "Role", color: "#0EA5E9" },
  { key: "experience", label: "Experience", color: "#16A34A" },
  { key: "education", label: "Education", color: "#F59E0B" },
] as const;

/** Slides cards to their new place when the order changes (e.g. after moving a weight slider). */
function useFlip(keys: string[]) {
  const container = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, DOMRect>());
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const next = new Map<string, DOMRect>();
    el.querySelectorAll<HTMLElement>("[data-flip]").forEach((node) => {
      const key = node.dataset.flip!;
      const rect = node.getBoundingClientRect();
      next.set(key, rect);
      const before = previous.current.get(key);
      if (before && (before.top !== rect.top || before.left !== rect.left) && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
        node.animate(
          [{ transform: `translate(${before.left - rect.left}px, ${before.top - rect.top}px)` }, { transform: "none" }],
          { duration: 380, easing: "cubic-bezier(.2,.7,.2,1)" },
        );
      }
    });
    previous.current = next;
  }, [keys.join("|")]); // eslint-disable-line react-hooks/exhaustive-deps
  return container;
}

/** Decisions belong to one job. This scores the candidate for another job so they can be shortlisted there. */
function AddToJob({ entry }: { entry: ShortlistEntry }) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const queryClient = useQueryClient();
  const jobs = useQuery({ queryKey: ["jobs", "pick"], queryFn: () => api.listJobs({ limit: 100 }), enabled: open });
  const add = useMutation({
    mutationFn: (jobId: string) => api.addCandidateToJob(jobId, entry.candidate_id),
    onSuccess: (_r, jobId) => {
      const title = jobs.data?.items.find((j) => j.id === jobId)?.title ?? "the job";
      toast(`${entry.name ?? "The candidate"} is being scored for ${title}. Open that job's shortlist in a minute.`, "success");
      setOpen(false);
      window.setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["shortlist"] }), 20000);
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const others = (jobs.data?.items ?? []).filter((j) => j.id !== entry.job_id);
  return (
    <span className="add-job">
      <button className="btn btn-sm btn-icon" title="Add to another job" aria-label="Add to another job" aria-expanded={open} onClick={() => setOpen(!open)}><Plus /></button>
      {open && (
        <div className="add-job-menu" role="menu">
          <strong className="small">Score {entry.name ?? "candidate"} for:</strong>
          {jobs.isLoading && <span className="muted small">Loading jobs…</span>}
          {!jobs.isLoading && others.length === 0 && <span className="muted small">No other jobs yet.</span>}
          {others.map((j) => (
            <button key={j.id} className="add-job-item" disabled={add.isPending} onClick={() => add.mutate(j.id)}>{j.title}</button>
          ))}
        </div>
      )}
    </span>
  );
}

export function CandidateCards({ items, onOpen, onToggle, toggling, compare, onCompare }: {
  items: ShortlistEntry[];
  onOpen: (e: ShortlistEntry) => void;
  onToggle: (entryId: string, on: boolean) => void;
  toggling: boolean;
  compare: string[];
  onCompare: (entryId: string) => void;
}) {
  const container = useFlip(items.map((e) => e.id));
  return (
    <div className="cand-grid" ref={container}>
      {items.map((e, i) => {
        const locked = Boolean(e.shared_to) || !["sourced", "shortlisted"].includes(e.status);
        const reasons = (e.explanation?.reason ?? []).filter((r) => !/(similar to|matching with) the job description$/.test(r)).slice(0, 2);
        const picked = compare.includes(e.id);
        return (
          <article key={e.id} data-flip={e.id} className={`cand-card status-${e.status} ${picked ? "is-compare" : ""}`}
                   style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }} onClick={() => onOpen(e)}>
            <header className="cand-top">
              <span className={`cand-rank ${(e.rank ?? i + 1) <= 3 ? "top" : ""}`}>#{e.rank ?? i + 1}</span>
              <div className="cand-who">
                <strong title={e.name ?? ""}>{e.name ?? "Name not given"}</strong>
                <span className="muted small">{e.current_title ?? "—"}</span>
              </div>
              <ScoreRing value={e.total_score} />
            </header>
            <div className="cand-meta muted small">
              <span>{formatYears(e.total_years_experience)}</span>
              {e.location && <span><MapPin size={11} /> {e.location}</span>}
              {e.notes_by_recruiter && <span title={e.notes_by_recruiter}><StickyNote size={11} /> note</span>}
            </div>
            <div className="cand-bars" aria-label="Score parts">
              {PARTS.map((p) => {
                const v = e.scores[p.key];
                return (
                  <div key={p.key} className="cand-bar" title={`${p.label}: ${v ?? "—"}`}>
                    <span className="cand-bar-label">{p.label}</span>
                    <span className="cand-bar-track"><span style={{ width: `${v ?? 0}%`, background: p.color }} /></span>
                    <span className="cand-bar-value">{v === null ? "—" : Math.round(v)}</span>
                  </div>
                );
              })}
            </div>
            {reasons.length > 0 && <ul className="reasons">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
            <footer className="cand-foot" onClick={(ev) => ev.stopPropagation()}>
              <span className="status-for"><StatusBadge status={e.status} />{locked && e.job_title && <small className="muted">for {e.job_title}</small>}</span>
              <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                {locked && <AddToJob entry={e} />}
                <button className={`btn btn-sm btn-icon ${picked ? "btn-primary" : ""}`} title="Compare" aria-pressed={picked} onClick={() => onCompare(e.id)}><GitCompare /></button>
                <button className="btn btn-sm btn-icon" title="View resume" onClick={() => openFile(`/api/v1/candidates/${e.candidate_id}/resume`, e.name ?? "Resume")}><FileText /></button>
                <label className="cand-check" title={locked ? `Already ${e.status === "shortlisted" ? "shared" : e.status} for ${e.job_title ?? "this job"}. This applies to this job only; ${e.name ?? "the candidate"} can still be shortlisted for other jobs.` : e.status === "shortlisted" ? "Remove from shortlist" : "Add to shortlist"}>
                  <input type="checkbox" className="shortlist-check" checked={e.status !== "sourced"} disabled={locked || toggling}
                         aria-label={`Shortlist ${e.name ?? "candidate"}`} onChange={() => onToggle(e.id, e.status !== "shortlisted")} />
                  <span className="small">Shortlist</span>
                </label>
              </span>
            </footer>
          </article>
        );
      })}
    </div>
  );
}

/** Two or three candidates side by side. */
export function CompareModal({ entries, onClose }: { entries: ShortlistEntry[]; onClose: () => void }) {
  const best = (key: (typeof PARTS)[number]["key"]) => Math.max(...entries.map((e) => e.scores[key] ?? -1));
  return (
    <Modal title={`Compare ${entries.length} candidates`} onClose={onClose} wide>
      <div className="compare" style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))` }}>
        {entries.map((e) => (
          <section key={e.id} className="compare-col">
            <div className="compare-head">
              <ScoreRing value={e.total_score} />
              <div><strong>{e.name ?? "Name not given"}</strong><div className="muted small">{e.current_title ?? "—"}</div></div>
            </div>
            <div className="cand-bars">
              {PARTS.map((p) => {
                const v = e.scores[p.key];
                const win = v !== null && v === best(p.key) && entries.length > 1;
                return (
                  <div key={p.key} className={`cand-bar ${win ? "win" : ""}`}>
                    <span className="cand-bar-label">{p.label}</span>
                    <span className="cand-bar-track"><span style={{ width: `${v ?? 0}%`, background: p.color }} /></span>
                    <span className="cand-bar-value">{v === null ? "—" : Math.round(v)}</span>
                  </div>
                );
              })}
            </div>
            <dl className="kv compare-kv">
              <dt>Experience</dt><dd>{formatYears(e.total_years_experience)}</dd>
              <dt>Location</dt><dd>{e.location ?? "—"}</dd>
              <dt>Status</dt><dd><StatusBadge status={e.status} /></dd>
            </dl>
            {e.explanation?.summary && <p className="explain">{e.explanation.summary}</p>}
            <div className="chips">
              {e.explanation?.strengths?.map((s) => <span key={s} className="tag green">+ {s}</span>)}
              {e.explanation?.gaps?.map((s) => <span key={s} className="tag red">− {s}</span>)}
            </div>
            <button className="btn btn-sm" onClick={() => openFile(`/api/v1/candidates/${e.candidate_id}/resume`, e.name ?? "Resume")}><FileText /> View resume</button>
          </section>
        ))}
      </div>
    </Modal>
  );
}
