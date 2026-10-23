import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Code2, Database, Eye, Globe, Link2, Play, Sparkles } from "lucide-react";
import type { ComponentType } from "react";
import { Alert, AnimatedNumber, Skeleton, PageHeader } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import type { SourceInfo } from "../../../types/api";
import BatchProgress from "../../candidates/components/BatchProgress";
import ReviewQueue from "../../candidates/components/ReviewQueue";
import SourcedResumes from "./SourcedResumes";
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

const SUGGESTIONS = ["Software engineer", "Data analyst", "Nurse", "Accountant", "HR manager"];

export default function SourcingPage() {
  const queryClient = useQueryClient();
  const catalog = useQuery({ queryKey: ["sources"], queryFn: api.sources });
  const [selected, setSelected] = useState<Set<SourceType>>(new Set(["huggingface"]));
  const [opts, setOpts] = useState<Options>(DEFAULTS);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false); // the run is done, so its resumes can be listed
  const [viewing, setViewing] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [details, setDetails] = useState<SourceType | null>(null);
  const hasKeyword = keyword.trim().length >= 2;

  const run = useMutation({
    mutationFn: () => api.startSourcing(buildRequest(selected, opts), hasKeyword ? keyword.trim() : undefined),
    onSuccess: (r) => { setBatchId(r.batch_id); setFinished(false); setViewing(false); },
  });

  const toggle = (t: SourceType) => setSelected((s) => {
    const next = new Set(s);
    if (next.has(t)) next.delete(t); else next.add(t);
    return next;
  });
  const update = <T extends SourceType>(t: T, patch: Partial<Options[T]>) => setOpts((o) => ({ ...o, [t]: { ...o[t], ...patch } }));
  const urlCount = opts.url.urls.split(/\s+/).filter(Boolean).length;
  const invalid = selected.size === 0 || (selected.has("url") && urlCount === 0);

  const upTo = (selected.has("huggingface") ? opts.huggingface.max_results : 0) + (selected.has("kaggle") ? opts.kaggle.max_results : 0)
    + (selected.has("github") ? opts.github.max_results : 0) + (selected.has("stackexchange") ? opts.stackexchange.max_results : 0)
    + (selected.has("url") ? urlCount : 0);
  const chosen = catalog.data?.filter((s) => selected.has(s.type)) ?? [];

  return (
    <>
      <PageHeader
        title="Sourcing"
        subtitle="Collect resumes from public sources. They are read and checked exactly like uploads."
        actions={<button className="btn btn-primary" disabled={invalid || run.isPending} onClick={() => run.mutate()}>
          <Play /> {run.isPending ? "Starting…" : `Start (${selected.size} source${selected.size === 1 ? "" : "s"})`}
        </button>}
      />
      {run.isError && <div style={{ marginBottom: 16 }}><Alert tone="error">{errorMessage(run.error)}</Alert></div>}

      <div className="card keyword-card reveal">
        <div className="field">
          <label htmlFor="keyword"><Sparkles size={15} /> What kind of candidates are you looking for?</label>
          <input id="keyword" className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                 placeholder="Type a role, e.g. software engineer" />
          <div className="chips suggestion-chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" className={`chip ${keyword === s ? "active" : ""}`} onClick={() => setKeyword(keyword === s ? "" : s)}>{s}</button>
            ))}
          </div>
          <span className="hint">
            {hasKeyword
              ? <>Using “<strong>{keyword.trim()}</strong>” to pick the field, search and tag for every source below. GitHub and Stack Overflow only have developers, so they skip other fields.</>
              : "Optional. One word fills in the field, search and tag for every source. Leave it empty to set each source yourself."}
          </span>
        </div>
      </div>

      <div className="source-grid">
        {catalog.isLoading && Array.from({ length: 5 }, (_, i) => <Skeleton key={i} h={118} r={14} />)}
        {catalog.isError && <Alert tone="error">{errorMessage(catalog.error)}</Alert>}
        {catalog.data?.map((source, i) => {
          const Icon = ICONS[source.type];
          const on = selected.has(source.type);
          const disabled = !source.configured;
          const open = details === source.type;
          return (
            <div key={source.type} className={`source-tile reveal ${on ? "on" : ""} ${disabled ? "off" : ""}`} style={{ animationDelay: `${i * 50}ms` }}>
              <label className="source-tile-main">
                <input type="checkbox" className="sr-only" checked={on} disabled={disabled} onChange={() => toggle(source.type)} />
                <span className="source-tile-icon"><Icon size={20} /></span>
                <span className="source-tile-text"><strong>{source.name}</strong></span>
                <span className="source-tile-tick"><Check size={14} /></span>
                <span className="source-tile-desc muted small">{source.description}</span>
              </label>
              <div className="source-tile-foot">
                {disabled ? <span className="badge amber">Needs setup</span> : <span className="badge green">Ready</span>}
                <button type="button" className="link-btn" onClick={() => setDetails(open ? null : source.type)} aria-expanded={open}>{open ? "Hide details" : "Details"}</button>
              </div>
              {open && (
                <div className="source-tile-info">
                  <div><strong>How much:</strong> {source.limits}</div>
                  <div><strong>Good to know:</strong> {source.terms}</div>
                  {source.needs && <div><strong>Optional setup:</strong> {source.needs}</div>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {chosen.length > 0 && (
        <div className="card settings-card reveal">
          <div className="card-header">
            <div><h2>Settings</h2><p>Only the sources you ticked appear here.</p></div>
            {upTo > 0 && <span className="badge brand plain">Up to <AnimatedNumber value={upTo} /> resumes</span>}
          </div>
          <div className="settings-list">
            {chosen.map((source) => {
              const Icon = ICONS[source.type];
              return (
                <section key={source.type} className="settings-section">
                  <div className="settings-title"><Icon size={16} /> {source.name}</div>
                  <SourceOptions type={source.type} opts={opts} update={update} byKeyword={hasKeyword} />
                </section>
              );
            })}
          </div>
        </div>
      )}

      {batchId && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><div><h2>Sourcing run</h2><p>Each source reports what it found, then the resumes are read like uploads.</p></div></div>
          <div className="card-body">
            <BatchProgress key={batchId} batchId={batchId} fetchStatus={api.batchStatus}
                           onFinished={() => {
                             setFinished(true);
                             void queryClient.invalidateQueries({ queryKey: ["candidates"] });
                             void queryClient.invalidateQueries({ queryKey: ["resume-review"] });
                           }} />
            {finished && (
              <div className="row" style={{ justifyContent: "center", marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => setViewing(true)}><Eye /> View resumes</button>
              </div>
            )}
          </div>
        </div>
      )}

      {viewing && batchId && <SourcedResumes batchId={batchId} onClose={() => setViewing(false)} />}

      <ReviewQueue origin="sourcing" />
    </>
  );
}

function SourceOptions({ type, opts, update, byKeyword }: {
  type: SourceType; opts: Options; update: <T extends SourceType>(t: T, patch: Partial<Options[T]>) => void; byKeyword: boolean;
}) {
  const categorySelect = (value: string, onChange: (v: string) => void) => (
    <select className="select" value={byKeyword ? "__keyword" : value} disabled={byKeyword} onChange={(e) => onChange(e.target.value)}>
      {byKeyword && <option value="__keyword">From your keyword</option>}
      <option value="">Any category</option>
      {CATEGORIES.filter((c) => c !== "Other").map((c) => <option key={c} value={c}>{c}</option>)}
    </select>
  );
  const max = (value: number, limit: number, onChange: (v: number) => void) => (
    <input className="input" type="number" min={1} max={limit} value={value}
           onChange={(e) => onChange(Math.max(1, Math.min(limit, Number(e.target.value) || 1)))} />
  );
  const fromKeyword = <span className="hint">Set by your keyword above.</span>;
  switch (type) {
    case "huggingface":
      return (
        <div className="form-grid">
          <div className="field full"><label>Dataset</label>
            <select className="select" value={opts.huggingface.dataset} onChange={(e) => update("huggingface", { dataset: e.target.value })}>
              <option value="opensporks/resumes">opensporks/resumes (2,484 resumes)</option>
              <option value="ahmedheakl/resume-atlas">ahmedheakl/resume-atlas (13,389 resumes)</option>
            </select>
            <span className="hint">Which public collection to take resumes from. Each collection is a ready-made set of resumes on huggingface.co.</span></div>
          <div className="field"><label>Category</label>{categorySelect(opts.huggingface.category, (v) => update("huggingface", { category: v }))}
            <span className="hint">{byKeyword ? "Set by your keyword above." : "The field of work to pick, e.g. IT or Medical."}</span></div>
          <div className="field"><label>How many</label>{max(opts.huggingface.max_results, 200, (v) => update("huggingface", { max_results: v }))}
            <span className="hint">Up to 200 per run.</span></div>
        </div>
      );
    case "kaggle":
      return (
        <div className="form-grid">
          <div className="field"><label>Category</label>{categorySelect(opts.kaggle.category, (v) => update("kaggle", { category: v }))}
            <span className="hint">{byKeyword ? "Set by your keyword above." : "The field of work to pick."}</span></div>
          <div className="field"><label>How many</label>{max(opts.kaggle.max_results, 200, (v) => update("kaggle", { max_results: v }))}</div>
        </div>
      );
    case "github":
      return (
        <div className="form-grid">
          <div className="field full"><label>Search</label>
            <input className="input" value={byKeyword ? "" : opts.github.query} disabled={byKeyword} placeholder={byKeyword ? "Set by your keyword" : undefined}
                   onChange={(e) => update("github", { query: e.target.value })} />
            <span className="hint">{byKeyword ? "Built from your keyword." : "GitHub’s own people search, e.g. language:java location:bangalore"}</span></div>
          <div className="field"><label>How many</label>{max(opts.github.max_results, 200, (v) => update("github", { max_results: v }))}</div>
        </div>
      );
    case "stackexchange":
      return (
        <div className="form-grid">
          <div className="field"><label>Tag</label>
            <input className="input" value={byKeyword ? "" : opts.stackexchange.tag} disabled={byKeyword} placeholder={byKeyword ? "Set by your keyword" : undefined}
                   onChange={(e) => update("stackexchange", { tag: e.target.value })} />
            <span className="hint">{byKeyword ? fromKeyword : "A topic such as python; we take its top answerers."}</span></div>
          <div className="field"><label>How many</label>{max(opts.stackexchange.max_results, 200, (v) => update("stackexchange", { max_results: v }))}</div>
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
    sources.push({ type: "url", urls: o.url.urls.split(/\s+/).filter(Boolean).slice(0, 200), follow_links: o.url.follow_links });
  }
  return sources;
}
