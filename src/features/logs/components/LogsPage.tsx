import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ChevronRight, Clock, HelpCircle, Layers, List, RefreshCw, ScrollText, Search } from "lucide-react";
import { Alert, AnimatedNumber, Empty, Loading, PageHeader, Pagination, Reveal, StageBadge } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { describeAction, describeArea, formatDateTime, formatTime, friendlyDetails, labelize } from "../../../utils/format";
import type { LogEntry, Stage } from "../../../types/api";

const STAGES: Stage[] = ["created", "collecting", "reading", "scoring", "shortlisted", "exported", "partly_completed", "failed"];
const LIMIT = 30;

const parse = (value: string | null): Record<string, unknown> => {
  try { const o = JSON.parse(value ?? ""); return o && typeof o === "object" ? (o as Record<string, unknown>) : {}; } catch { return {}; }
};
const asUtc = (value: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);

function timeAgo(value: string): string {
  const s = Math.max(0, Math.round((Date.now() - asUtc(value).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** What happened, in words: the action, then the result details and how long it took. */
function outputText(entry: LogEntry): string {
  const details = friendlyDetails(entry.output_data);
  const took = entry.duration_ms ? `took ${(entry.duration_ms / 1000).toFixed(1)}s` : "";
  return [details, took].filter(Boolean).join(" · ");
}

type RunState = "progress" | "done" | "attention" | "failed";
interface Run { key: string; events: LogEntry[]; first: string; last: string; final: LogEntry; area: string; jobId: string | null; state: RunState; label: string }

const STATE_LABEL: Record<RunState, string> = { progress: "In progress", done: "Done", attention: "Needs attention", failed: "Failed" };
const STATE_TONE: Record<RunState, string> = { progress: "blue", done: "green", attention: "amber", failed: "red" };

/** A run's real status. Uploads end with a "reading" event whose output says finished: true,
 *  so the stage alone would show every finished upload as "Reading". */
function runState(events: LogEntry[], final: LogEntry): { state: RunState; label: string } {
  const stage = final.stage;
  if (stage === "failed") return { state: "failed", label: "Failed" };
  if (stage === "partly_completed") return { state: "attention", label: "Partly completed" };
  const finishedEvent = [...events].reverse().find((e) => parse(e.output_data).finished === true);
  if (finishedEvent) {
    const out = parse(finishedEvent.output_data);
    const failed = Number(out.failed ?? 0);
    return failed > 0 ? { state: "attention", label: `Done · ${failed} failed` } : { state: "done", label: "Done" };
  }
  if (stage === "shortlisted" || stage === "exported") return { state: "done", label: labelize(stage) };
  if (!final.category && events.length === 1) return { state: "done", label: "Recorded" };
  const idle = Date.now() - asUtc(events[events.length - 1].at).getTime();
  if (idle > 30 * 60 * 1000) return { state: "attention", label: "Ended without a result" };
  return { state: "progress", label: "In progress" };
}

const RUN_TITLE: Record<string, string> = {
  extraction: "Reading resumes", scraping: "Sourcing", scoring: "Matching", shortlisting: "Matching", exporting: "Export",
};

/** Groups events of the same upload / sourcing batch or matching run (they share a batch_id or run_id). */
function groupRuns(items: LogEntry[]): Run[] {
  const map = new Map<string, LogEntry[]>();
  for (const e of items) {
    const input = parse(e.input_data);
    const key = String(input.batch_id ?? input.run_id ?? e.id);
    map.set(key, [...(map.get(key) ?? []), e]);
  }
  return [...map.entries()].map(([key, events]) => {
    const sorted = [...events].sort((a, b) => asUtc(a.at).getTime() - asUtc(b.at).getTime());
    const final = [...sorted].reverse().find((e) => e.stage) ?? sorted[sorted.length - 1];
    return { key, events: sorted, first: sorted[0].at, last: sorted[sorted.length - 1].at, final, area: sorted[0].category ?? "",
      jobId: sorted.find((e) => e.job_id)?.job_id ?? null, ...runState(sorted, final) };
  }).sort((a, b) => asUtc(b.last).getTime() - asUtc(a.last).getTime());
}

export default function LogsPage() {
  const [filters, setFilters] = useState({ job_id: "", stage: "", category: "", only_stages: true });
  const [runFilter, setRunFilter] = useState<"" | RunState>("");
  const [offset, setOffset] = useState(0);
  const [live, setLive] = useState(true);
  const [view, setView] = useState<"runs" | "list">("runs");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [help, setHelp] = useState(false);

  const jobs = useQuery({ queryKey: ["jobs", "all-for-logs"], queryFn: () => api.listJobs({ limit: 100 }) });
  const jobTitle = (id: string | null) => (id ? jobs.data?.items.find((j) => j.id === id)?.title ?? "Deleted job" : "—");

  // List view: one page at a time.
  const list = useQuery({
    queryKey: ["logs", "list", filters, offset],
    queryFn: () => api.logs({ ...filters, limit: LIMIT, offset }),
    enabled: view === "list",
    refetchInterval: live ? 5000 : false,
  });
  // By-run view and the summary strip: the latest 200 events.
  const recent = useQuery({
    queryKey: ["logs", "recent", { ...filters, stage: "" }],
    queryFn: () => api.logs({ job_id: filters.job_id, category: filters.category, only_stages: true, limit: 200 }),
    refetchInterval: live ? 5000 : false,
  });

  const set = (patch: Partial<typeof filters>) => { setFilters((f) => ({ ...f, ...patch })); setOffset(0); };
  const toggle = (key: string) => setOpen((o) => { const n = new Set(o); if (n.has(key)) n.delete(key); else n.add(key); return n; });

  const runs = useMemo(() => groupRuns(recent.data?.items ?? []), [recent.data]);
  const stateCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of runs) c[r.state] = (c[r.state] ?? 0) + 1;
    return c;
  }, [runs]);
  const needle = search.trim().toLowerCase();
  const visibleRuns = runs.filter((r) =>
    (!runFilter || r.state === runFilter) &&
    (!needle || `${RUN_TITLE[r.area] ?? ""} ${jobTitle(r.jobId)} ${r.events.map((e) => `${describeAction(e.action)} ${outputText(e)}`).join(" ")}`.toLowerCase().includes(needle)));
  const visibleList = (list.data?.items ?? []).filter((e) => !needle || `${describeAction(e.action)} ${outputText(e)} ${jobTitle(e.job_id)}`.toLowerCase().includes(needle));

  const ok = stateCounts.done ?? 0;
  const attention = (stateCounts.attention ?? 0) + (stateCounts.failed ?? 0);
  const latest = recent.data?.items[0]?.at;

  const error = recent.isError ? recent.error : list.isError ? list.error : null;

  return (
    <>
      <PageHeader title="Activity log" subtitle="Every step the system takes, with the date and time."
                  actions={<>
                    <button className="btn btn-ghost btn-sm" onClick={() => setHelp(!help)} aria-expanded={help}><HelpCircle /> What am I looking at?</button>
                    <label className="check"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> <RefreshCw size={14} className={live ? "spin-slow" : ""} /> Live updates</label>
                  </>} />

      {help && (
        <Alert>
          <strong>Each line is one step.</strong> <em>Time</em> is when it happened. <em>Step</em> is where the run was
          (started, comparing, reading, scoring, done, or failed). <em>Input</em> is what the step was given
          (for example the number of files). <em>Output</em> is what came out (counts, seconds, or the reason it failed).
          <em> Job</em> is the job it belongs to. <strong>By run</strong> puts all the steps of one upload or matching run together.
        </Alert>
      )}

      <div className="log-stats">
        <Reveal><div className="log-stat"><Layers size={18} /><span><strong><AnimatedNumber value={runs.length} /></strong><small>runs (last 200 events)</small></span></div></Reveal>
        <Reveal delay={60}><div className="log-stat ok"><CheckCircle2 size={18} /><span><strong><AnimatedNumber value={ok} /></strong><small>finished fine</small></span></div></Reveal>
        <Reveal delay={120}><div className={`log-stat ${attention ? "bad" : ""}`}><AlertTriangle size={18} /><span><strong><AnimatedNumber value={attention} /></strong><small>need attention or failed</small></span></div></Reveal>
        <Reveal delay={180}><div className="log-stat"><Clock size={18} /><span><strong>{latest ? timeAgo(latest) : "—"}</strong><small>last activity</small></span></div></Reveal>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Log view">
            <button role="tab" aria-selected={view === "runs"} className={view === "runs" ? "active" : ""} onClick={() => setView("runs")}><Layers /> By run</button>
            <button role="tab" aria-selected={view === "list"} className={view === "list" ? "active" : ""} onClick={() => setView("list")}><List /> All steps</button>
          </div>
          <div className="row grow" style={{ position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 10, color: "var(--ink-400)" }} />
            <input className="input grow" style={{ paddingLeft: 32 }} placeholder="Search the log" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" value={filters.job_id} onChange={(e) => set({ job_id: e.target.value })}>
            <option value="">All jobs</option>
            {jobs.data?.items.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <select className="select" value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">All areas</option>
            <option value="extraction">Reading resumes &amp; job descriptions</option>
            <option value="scraping">Sourcing</option>
            <option value="scoring">Scoring</option>
            <option value="shortlisting">Shortlisting &amp; review</option>
            <option value="exporting">Exports</option>
          </select>
          {view === "list" && (
            <label className="check small"><input type="checkbox" checked={!filters.only_stages} onChange={(e) => set({ only_stages: !e.target.checked })} /> Show every event</label>
          )}
        </div>
        <div className="log-chips">
          {view === "runs" ? (
            <>
              <button className={`chip ${runFilter === "" ? "active" : ""}`} onClick={() => setRunFilter("")}>All runs <span className="count">{runs.length}</span></button>
              {(Object.keys(STATE_LABEL) as RunState[]).map((k) => (
                <button key={k} className={`chip ${runFilter === k ? "active" : ""}`} onClick={() => setRunFilter(runFilter === k ? "" : k)}>
                  {STATE_LABEL[k]}{stateCounts[k] ? <span className="count">{stateCounts[k]}</span> : null}
                </button>
              ))}
            </>
          ) : (
            <>
              <button className={`chip ${filters.stage === "" ? "active" : ""}`} onClick={() => set({ stage: "" })}>All steps</button>
              {STAGES.map((st) => (
                <button key={st} className={`chip ${filters.stage === st ? "active" : ""}`} onClick={() => set({ stage: filters.stage === st ? "" : st })}>{labelize(st)}</button>
              ))}
            </>
          )}
        </div>

        {error != null && <div className="card-body"><Alert tone="error">{errorMessage(error)}</Alert></div>}
        {(view === "runs" ? recent.isLoading : list.isLoading) && <Loading />}

        {view === "runs" && recent.data && (
          visibleRuns.length === 0
            ? <Empty title="No activity yet" icon={<ScrollText />}>Uploads, sourcing and matching runs appear here.</Empty>
            : (
              <div className="run-list">
                {visibleRuns.map((r) => {
                  const isOpen = open.has(r.key);
                  const secs = Math.max(0, Math.round((asUtc(r.last).getTime() - asUtc(r.first).getTime()) / 1000));
                  return (
                    <div key={r.key} className={`run ${isOpen ? "open" : ""}`}>
                      <button className="run-head" onClick={() => toggle(r.key)} aria-expanded={isOpen}>
                        <ChevronRight size={16} className="run-chevron" />
                        <span className="run-title"><strong>{RUN_TITLE[r.area] ?? describeArea(r.area)}</strong><span className="muted small">{jobTitle(r.jobId)}</span></span>
                        <span className="run-meta muted small">{r.events.length} step{r.events.length === 1 ? "" : "s"}{secs > 0 && ` · ${secs}s`}</span>
                        <span className={`badge ${STATE_TONE[r.state]}`}>{r.label}</span>
                        <time className="muted small">{formatDateTime(r.last)}</time>
                      </button>
                      {isOpen && (
                        <ol className="run-steps">
                          {r.events.map((e) => (
                            <li key={e.id} className={`run-step ${e.stage === "failed" ? "bad" : e.stage === "shortlisted" ? "ok" : ""}`}>
                              <span className="run-step-dot" />
                              <time className="muted small">{formatTime(e.at)}</time>
                              <span>
                                <strong>{e.action ? describeAction(e.action) : e.stage ? labelize(e.stage) : describeArea(e.category)}</strong>
                                {outputText(e) && <span className="muted"> — {outputText(e)}</span>}
                                {friendlyDetails(e.input_data) && <div className="muted small">Input: {friendlyDetails(e.input_data)}</div>}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  );
                })}
              </div>
            )
        )}

        {view === "list" && list.data && (
          visibleList.length === 0
            ? <Empty title="No activity yet" icon={<ScrollText />} />
            : (
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th></th><th>Time</th><th>Step</th><th>Input</th><th>Output (what happened)</th><th>Job</th></tr></thead>
                  <tbody>
                    {visibleList.map((l) => {
                      const isOpen = open.has(l.id);
                      return (
                        <Fragment key={l.id}>
                          <tr className="clickable" onClick={() => toggle(l.id)}>
                            <td style={{ width: 28 }}><ChevronRight size={15} className={`run-chevron ${isOpen ? "turned" : ""}`} /></td>
                            <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(l.at)}</td>
                            <td><StageBadge stage={l.stage} /></td>
                            <td className="small muted" style={{ maxWidth: 300 }}>{friendlyDetails(l.input_data) || "—"}</td>
                            <td style={{ maxWidth: 420 }}>
                              <div>{l.action ? describeAction(l.action) : describeArea(l.category)}</div>
                              {outputText(l) && <div className="small muted">{outputText(l)}</div>}
                            </td>
                            <td>{jobTitle(l.job_id)}</td>
                          </tr>
                          {isOpen && (
                            <tr className="log-detail-row">
                              <td></td>
                              <td colSpan={5}>
                                <dl className="kv log-detail">
                                  <dt>Area</dt><dd>{describeArea(l.category)}</dd>
                                  <dt>Input</dt><dd>{friendlyDetails(l.input_data) || "—"}</dd>
                                  <dt>Output</dt><dd>{friendlyDetails(l.output_data) || "—"}</dd>
                                  <dt>Took</dt><dd>{l.duration_ms ? `${(l.duration_ms / 1000).toFixed(2)} s` : "—"}</dd>
                                  <dt>Run id</dt><dd className="mono">{String(parse(l.input_data).batch_id ?? parse(l.input_data).run_id ?? "—")}</dd>
                                </dl>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
        )}
        {view === "list" && list.data && <Pagination total={list.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
      </div>
    </>
  );
}
