import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Code2, Database, Globe, Link2, Play } from "lucide-react";
import type { ComponentType } from "react";
import { Alert, Loading, PageHeader } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import type { SourceInfo } from "../../../types/api";
import BatchProgress from "../../candidates/components/BatchProgress";
import { CATEGORIES } from "../../jobs/components/JobForm";

type SourceType = SourceInfo["type"];
const ICONS: Record<SourceType, ComponentType<{ size?: number }>> = {
  huggingface: Database, kaggle: BookOpen, github: Code2, stackexchange: Globe, url: Link2,
};

interface Options {
  huggingface: { dataset: string; category: string; max_results: number };
  kaggle: { category: string; max_results: number };
  github: { query: string; max_results: number };
  stackexchange: { tag: string; max_results: number };
  url: { urls: string; follow_links: boolean };
}

const DEFAULTS: Options = {
  huggingface: { dataset: "opensporks/resumes", category: "IT", max_results: 20 },
  kaggle: { category: "IT", max_results: 20 },
  github: { query: "language:python location:chennai", max_results: 10 },
  stackexchange: { tag: "python", max_results: 10 },
  url: { urls: "", follow_links: true },
};

export default function SourcingPage() {
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ["sources"], queryFn: api.sources });
  const [selected, setSelected] = useState<Set<SourceType>>(new Set(["huggingface"]));
  const [opts, setOpts] = useState<Options>(DEFAULTS);
  const [batchId, setBatchId] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: () => api.startSourcing(buildRequest(selected, opts)),
    onSuccess: (r) => setBatchId(r.batch_id),
  });

  const toggle = (t: SourceType) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(t)) next.delete(t); else next.add(t);
    return next;
  });
  const update = <T extends SourceType>(t: T, patch: Partial<Options[T]>) => setOpts((o) => ({ ...o, [t]: { ...o[t], ...patch } }));
  const urlCount = opts.url.urls.split(/\s+/).filter(Boolean).length;
  const invalid = selected.size === 0 || (selected.has("url") && urlCount === 0);

  return (
    <>
      <PageHeader
        title="Sourcing"
        subtitle="Collect resumes from public sources. They go through the same reading and indexing as uploads."
        actions={<button className="btn btn-primary" disabled={invalid || run.isPending} onClick={() => run.mutate()}>
          <Play /> {run.isPending ? "Starting…" : `Start (${selected.size} source${selected.size === 1 ? "" : "s"})`}
        </button>}
      />
      {run.isError && <div style={{ marginBottom: 16 }}><Alert tone="error">{errorMessage(run.error)}</Alert></div>}

      {batchId && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2>Sourcing run</h2><p>Each source reports what it found, then the resumes are read like uploads.</p></div></div>
          <div className="card-body">
            <BatchProgress key={batchId} batchId={batchId} fetchStatus={api.batchStatus}
                           onFinished={() => void queryClient.invalidateQueries({ queryKey: ["candidates"] })} />
          </div>
        </div>
      )}

      {catalog.isLoading && <Loading />}
      {catalog.isError && <Alert tone="error">{errorMessage(catalog.error)}</Alert>}
      <div className="grid grid-2">
        {catalog.data?.map((source) => {
          const Icon = ICONS[source.type];
          const on = selected.has(source.type);
          const disabled = !source.configured;
          return (
            <div key={source.type} className={`card source-card ${on ? "selected" : ""}`} style={disabled ? { opacity: 0.7 } : undefined}>
              <div className="spread">
                <label className="check" style={{ fontWeight: 650, fontSize: 15 }}>
                  <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggle(source.type)} />
                  <Icon size={18} /> {source.name}
                </label>
                {disabled ? <span className="badge amber">Needs setup</span> : <span className="badge green">Ready</span>}
              </div>
              <p className="muted">{source.description}</p>
              {on && <SourceOptions type={source.type} opts={opts} update={update} />}
              <div className="small muted"><strong>How much:</strong> {source.limits}</div>
              <div className="small muted"><strong>Good to know:</strong> {source.terms}</div>
              {source.needs && <div className="small muted"><strong>Optional setup:</strong> {source.needs}</div>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function SourceOptions({ type, opts, update }: {
  type: SourceType; opts: Options; update: <T extends SourceType>(t: T, patch: Partial<Options[T]>) => void;
}) {
  const categorySelect = (value: string, onChange: (v: string) => void) => (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Any category</option>
      {CATEGORIES.filter((c) => c !== "Other").map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
  const max = (value: number, limit: number, onChange: (v: number) => void) => (
    <input className="input" type="number" min={1} max={limit} value={value}
           onChange={(e) => onChange(Math.max(1, Math.min(limit, Number(e.target.value) || 1)))} />
  );
  switch (type) {
    case "huggingface":
      return (
        <div className="form-grid">
          <div className="field full"><label>Dataset</label>
            <select className="select" value={opts.huggingface.dataset} onChange={(e) => update("huggingface", { dataset: e.target.value })}>
              <option value="opensporks/resumes">opensporks/resumes (2,484 resumes)</option>
              <option value="ahmedheakl/resume-atlas">ahmedheakl/resume-atlas (13,389 resumes)</option>
            </select></div>
          <div className="field"><label>Category</label>{categorySelect(opts.huggingface.category, (v) => update("huggingface", { category: v }))}</div>
          <div className="field"><label>How many</label>{max(opts.huggingface.max_results, 50, (v) => update("huggingface", { max_results: v }))}</div>
        </div>
      );
    case "kaggle":
      return (
        <div className="form-grid">
          <div className="field"><label>Category</label>{categorySelect(opts.kaggle.category, (v) => update("kaggle", { category: v }))}</div>
          <div className="field"><label>How many</label>{max(opts.kaggle.max_results, 50, (v) => update("kaggle", { max_results: v }))}</div>
        </div>
      );
    case "github":
      return (
        <div className="form-grid">
          <div className="field full"><label>Search</label>
            <input className="input" value={opts.github.query} onChange={(e) => update("github", { query: e.target.value })} />
            <span className="hint">GitHub user search, e.g. language:java location:bangalore</span></div>
          <div className="field"><label>How many</label>{max(opts.github.max_results, 30, (v) => update("github", { max_results: v }))}</div>
        </div>
      );
    case "stackexchange":
      return (
        <div className="form-grid">
          <div className="field"><label>Tag</label>
            <input className="input" value={opts.stackexchange.tag} onChange={(e) => update("stackexchange", { tag: e.target.value })} /></div>
          <div className="field"><label>How many</label>{max(opts.stackexchange.max_results, 30, (v) => update("stackexchange", { max_results: v }))}</div>
        </div>
      );
    case "url":
      return (
        <div className="stack" style={{ gap: 8 }}>
          <textarea className="textarea" rows={4} value={opts.url.urls} onChange={(e) => update("url", { urls: e.target.value })}
                    placeholder={"One link per line:\nhttps://example.com/jane-doe-resume.pdf\nhttps://janedoe.dev"} />
          <label className="check small">
            <input type="checkbox" checked={opts.url.follow_links} onChange={(e) => update("url", { follow_links: e.target.checked })} />
            Follow resume/CV links found on pages
          </label>
        </div>
      );
  }
}

function buildRequest(selected: Set<SourceType>, o: Options): Record<string, unknown>[] {
  const sources: Record<string, unknown>[] = [];
  if (selected.has("huggingface")) sources.push({ type: "huggingface", ...o.huggingface, category: o.huggingface.category || null });
  if (selected.has("kaggle")) sources.push({ type: "kaggle", ...o.kaggle, category: o.kaggle.category || null });
  if (selected.has("github")) sources.push({ type: "github", ...o.github });
  if (selected.has("stackexchange")) sources.push({ type: "stackexchange", ...o.stackexchange });
  if (selected.has("url")) {
    sources.push({ type: "url", urls: o.url.urls.split(/\s+/).filter(Boolean).slice(0, 20), follow_links: o.url.follow_links });
  }
  return sources;
}
