import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText } from "lucide-react";
import { Alert, Empty, Loading, Modal } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears, labelize } from "../../../utils/format";
import type { CandidateDetail } from "../../../types/api";
import { SITE_LABEL } from "../sourceLabels";

/** The resumes one sourcing run added, each with what was read from it (click a row to open it). */
export default function SourcedResumes({ batchId, onClose }: { batchId: string; onClose: () => void }) {
  const list = useQuery({ queryKey: ["batch-candidates", batchId], queryFn: () => api.batchCandidates(batchId) });
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Modal title={`Resumes found by this run${list.data ? ` (${list.data.length})` : ""}`} onClose={onClose} wide>
      {list.isLoading && <Loading rows={3} />}
      {list.isError && <Alert tone="error">{errorMessage(list.error)}</Alert>}
      {list.data && list.data.length === 0 && (
        <Empty title="No new resumes">This run added no new resumes. Resumes that were already stored are not listed again.</Empty>
      )}
      {list.data && list.data.length > 0 && (
        <div className="sourced-list">
          {list.data.map((c) => <SourcedRow key={c.id} c={c} open={open === c.id} onToggle={() => setOpen(open === c.id ? null : c.id)} />)}
        </div>
      )}
    </Modal>
  );
}

function SourcedRow({ c, open, onToggle }: { c: CandidateDetail; open: boolean; onToggle: () => void }) {
  const facts = [c.current_title, formatYears(c.total_years_experience), c.location].filter((x) => x && x !== "—");
  return (
    <div className={`sourced-row ${open ? "open" : ""}`}>
      <button type="button" className="sourced-head" onClick={onToggle} aria-expanded={open}>
        <ChevronRight size={16} className="run-chevron" />
        <span className="sourced-who">
          <strong>{c.name ?? "Name not found"}</strong>
          <span className="muted small">{facts.join(" · ") || "No details found"}</span>
        </span>
        {c.category && <span className="badge brand plain">{c.category}</span>}
        <span className="badge plain">{c.source_site ? SITE_LABEL[c.source_site] ?? labelize(c.source_site) : "Uploaded"}</span>
      </button>
      {open && <div className="sourced-body"><CandidateFacts c={c} /></div>}
    </div>
  );
}

/** What was read from a sourced resume, with a button to open the file. */
export function CandidateFacts({ c }: { c: CandidateDetail }) {
  return (
    <>
      <dl className="kv">
        <dt>Email</dt><dd>{c.email ?? "—"}</dd>
        <dt>Phone</dt><dd>{c.contact ?? "—"}</dd>
        <dt>Skills</dt>
        <dd>{c.skills.length ? <span className="chips">{c.skills.map((s) => <span key={s} className="tag gray">{s}</span>)}</span> : "—"}</dd>
        <dt>Work history</dt>
        <dd>{c.roles_and_years?.length
          ? <ul className="reasons">{c.roles_and_years.map((r, i) => <li key={i}>{[r.title, r.company].filter(Boolean).join(" at ")}{r.years ? ` · ${r.years} yrs` : ""}</li>)}</ul>
          : "—"}</dd>
        <dt>Education</dt>
        <dd>{c.education?.length
          ? <ul className="reasons">{c.education.map((e, i) => <li key={i}>{[e.degree, e.institution, e.year].filter(Boolean).join(", ")}</li>)}</ul>
          : "—"}</dd>
      </dl>
      <button className="btn btn-sm" onClick={() => openFile(`/api/v1/candidates/${c.id}/resume`, c.name ?? "Resume")}><FileText /> View resume</button>
    </>
  );
}
