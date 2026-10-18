import { useState } from "react";
import { FileText, Save } from "lucide-react";
import { Alert, ScoreBar, ScoreRing, StatusBadge } from "../../../components/ui";
import { formatYears } from "../../../utils/format";
import type { ShortlistEntry, SkillMatch } from "../../../types/api";

const LEVEL: Record<number, { label: string; tone: string }> = {
  100: { label: "Has it", tone: "green" },
  75: { label: "Close match", tone: "blue" },
  50: { label: "Partly", tone: "amber" },
  0: { label: "Missing", tone: "red" },
};

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v * 100)}%`);

function SkillRows({ title, items }: { title: string; items: SkillMatch[] }) {
  if (!items.length) return null;
  return (
    <div>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <table className="table">
        <tbody>
          {items.map((s) => {
            const level = LEVEL[s.level] ?? LEVEL[0];
            return (
              <tr key={s.jd_skill}>
                <td style={{ width: "40%" }}><strong>{s.jd_skill}</strong></td>
                <td><span className={`badge ${level.tone}`}>{level.label} · {s.level}</span></td>
                <td className="muted">{s.matched && s.matched.toLowerCase() !== s.jd_skill.toLowerCase() ? `via ${s.matched}` : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Everything about one scored candidate for one job. */
export default function EntryDetail({ entry, onOpenResume, onSaveNotes, savingNotes }: {
  entry: ShortlistEntry;
  onOpenResume: () => void;
  onSaveNotes?: (notes: string) => void;
  savingNotes?: boolean;
}) {
  const [notes, setNotes] = useState(entry.notes_by_recruiter ?? "");
  const e = entry.explanation ?? {};
  const parts = entry.breakdown;

  return (
    <div className="stack">
      <div className="row" style={{ gap: 16, alignItems: "center" }}>
        <ScoreRing value={entry.total_score} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row"><strong style={{ fontSize: 16 }}>{entry.name ?? "Name not given"}</strong><StatusBadge status={entry.status} />
            {entry.rank && <span className="badge plain">Rank #{entry.rank}</span>}</div>
          <div className="muted">{[entry.current_title, formatYears(entry.total_years_experience), entry.location].filter((x) => x && x !== "—").join(" · ")}</div>
          <div className="muted small">{[entry.email, entry.contact].filter(Boolean).join(" · ")}</div>
        </div>
        <button className="btn" onClick={onOpenResume}><FileText /> Resume</button>
      </div>

      {parts && (
        <div className="card card-pad breakdown">
          <h3>How the score adds up</h3>
          {(["skills", "role", "experience", "education"] as const).map((k) => (
            <div key={k} className="breakdown-row">
              <span style={{ textTransform: "capitalize" }}>{k} <span className="muted small">({parts[k].weight}%)</span></span>
              <ScoreBar value={parts[k].score} />
              <span className="muted small" style={{ textAlign: "right" }}>+{parts[k].points} pts</span>
            </div>
          ))}
          <div className="spread" style={{ borderTop: "1px solid var(--ink-200)", paddingTop: 8 }}>
            <strong>Total</strong><strong>{entry.total_score} / 100</strong>
          </div>
        </div>
      )}

      {e.summary ? (
        <div className="explain">
          <strong>Why this candidate</strong>
          {e.stale && <span className="badge amber" style={{ marginLeft: 8 }}>Refreshing after weight change</span>}
          <p style={{ marginTop: 6 }}>{e.summary}</p>
          {(e.strengths?.length || e.gaps?.length) ? (
            <div className="row" style={{ marginTop: 10, alignItems: "flex-start" }}>
              {e.strengths?.map((s) => <span key={s} className="tag green">+ {s}</span>)}
              {e.gaps?.map((s) => <span key={s} className="tag red">− {s}</span>)}
            </div>
          ) : null}
        </div>
      ) : <Alert>An AI explanation is written for shortlisted candidates.</Alert>}

      <SkillRows title="Required skills" items={e.skills?.required ?? []} />
      <SkillRows title="Nice-to-have skills" items={e.skills?.nice ?? []} />

      <dl className="kv">
        <dt>Role match</dt><dd>{e.role ? `${LEVEL[e.role.level]?.label ?? e.role.level}${e.role.matched_role ? ` — ${e.role.matched_role}` : ""}` : "—"}</dd>
        <dt>Experience</dt><dd>{e.experience?.note ?? "—"}</dd>
        <dt>Education</dt><dd>{e.education?.note ?? "—"}</dd>
        {e.cosine && (e.cosine.skills !== null || e.cosine.role !== null) && <><dt>Profile similarity</dt><dd className="muted">skills {pct(e.cosine.skills)} · job titles {pct(e.cosine.role)}</dd></>}
      </dl>

      {onSaveNotes ? (
        <div className="field">
          <label htmlFor="notes">Recruiter notes</label>
          <textarea id="notes" className="textarea" value={notes} maxLength={2000} onChange={(ev) => setNotes(ev.target.value)}
                    placeholder="e.g. Strong backend profile; possibly overqualified" />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-sm" disabled={savingNotes || notes === (entry.notes_by_recruiter ?? "")} onClick={() => onSaveNotes(notes)}>
              <Save /> {savingNotes ? "Saving…" : "Save notes"}
            </button>
          </div>
        </div>
      ) : entry.notes_by_recruiter ? (
        <div className="notes"><strong>Recruiter notes:</strong> {entry.notes_by_recruiter}</div>
      ) : null}
    </div>
  );
}
