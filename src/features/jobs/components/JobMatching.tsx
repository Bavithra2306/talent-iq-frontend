import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import { Alert, useToast } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import type { Job, Weights } from "../../../types/api";
import MatchPipeline from "../../shortlist/components/MatchPipeline";
import { DEFAULT_WEIGHTS, SCORE_PARTS } from "../../shortlist/scoreParts";
import type { Matching } from "../useMatching";

const total = (w: Weights) => w.skill_pct + w.role_pct + w.exp_pct + w.edu_pct;

/** Job page: the weights the scores use. `onPreview` gets unsaved weights that add up to 100,
 *  so the candidates table can re-rank live. */
export default function JobMatching({ job, onPreview }: { job: Job; onPreview: (w: Weights | null) => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const refreshCandidates = () => void queryClient.invalidateQueries({ queryKey: ["job-candidates", job.id] });

  // weights: the job's saved weights come with its results
  const saved = useQuery({ queryKey: ["job-candidates", job.id, "weights"], queryFn: async () => (await api.shortlist(job.id, { limit: 1 })).weights });
  const [draft, setDraft] = useState<Weights | null>(null);
  const weights = draft ?? saved.data ?? null;
  const setWeights = (next: Weights) => { setDraft(next); onPreview(total(next) === 100 ? next : null); };
  const saveWeights = useMutation({
    mutationFn: (w: Weights) => api.saveWeights(job.id, w),
    onSuccess: () => { setDraft(null); onPreview(null); refreshCandidates(); toast("Weights saved and candidates re-ranked.", "success"); },
  });
  const sum = weights ? total(weights) : 100;
  const changed = Boolean(draft && saved.data && (Object.keys(draft) as (keyof Weights)[]).some((k) => draft[k] !== saved.data[k]));

  return (
    <div className="card job-weights">
      <div className="card-header"><div><h2><SlidersHorizontal size={17} style={{ verticalAlign: -3 }} /> Weights used for the score</h2>
        <p>How much each part counts. Move a slider to preview the new ranking; Save keeps it for this job.</p></div></div>
      <div className="card-body stack">
        {weights && SCORE_PARTS.map(({ weight: key, label, color }) => (
          <div key={key} className="slider-row">
            <span><i className="dot-swatch" style={{ background: color }} /> {label}</span>
            <input type="range" className="weight-slider" min={0} max={100} step={5} value={weights[key]}
                   style={{ ["--c" as string]: color, ["--v" as string]: `${weights[key]}%` }} aria-label={`${label} weight`}
                   onChange={(e) => setWeights({ ...weights, [key]: Number(e.target.value) })} />
            <strong style={{ textAlign: "right" }}>{weights[key]}%</strong>
          </div>
        ))}
        <div className="spread">
          <span className={sum === 100 ? "muted" : ""} style={sum === 100 ? undefined : { color: "var(--red-600)", fontWeight: 600 }}>
            Total {sum}% {sum !== 100 && "— must add up to 100% to save"}
          </span>
          <div className="row">
            <button className="btn btn-sm" onClick={() => setWeights({ ...DEFAULT_WEIGHTS })}>Reset</button>
            <button className="btn btn-sm btn-primary" disabled={sum !== 100 || !changed || saveWeights.isPending} onClick={() => weights && saveWeights.mutate(weights)}>Save</button>
          </div>
        </div>
        {changed && sum === 100 && <Alert>Live preview: the table below uses these weights. Press Save to keep them.</Alert>}
        {saveWeights.isError && <Alert tone="error">{errorMessage(saveWeights.error)}</Alert>}
      </div>
    </div>
  );
}

/** The progress of a matching run started from the header's "Start matching" button (hidden until one starts). */
export function MatchProgress({ job, matching }: { job: Job; matching: Matching }) {
  const s = matching.status;
  if (!matching.started && !matching.running && !matching.error) return null;
  return (
    <div className="card">
      <div className="card-header"><div><h2>{matching.running ? "Matching…" : "Matching finished"}</h2>
        <p>Compares every {job.category ?? ""} resume with this job and scores the best ones. The results appear in the table below.</p></div></div>
      <div className="card-body stack" style={{ gap: 10 }}>
        {matching.error && <Alert tone="error">{errorMessage(matching.error)}</Alert>}
        {matching.started && <MatchPipeline status={s} running={matching.running} />}
        {s?.note && <Alert tone={s.pool ? "info" : "warn"}>{s.note}</Alert>}
        {Boolean(s?.not_indexed) && s?.finished && (
          <Alert tone="warn">{s?.not_indexed} resume(s) are still being added to search and were left out. Run matching again later to include them.</Alert>
        )}
      </div>
    </div>
  );
}
