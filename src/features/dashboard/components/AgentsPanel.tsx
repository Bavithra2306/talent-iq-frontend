import { useQuery } from "@tanstack/react-query";
import { Database, FileSearch, Target } from "lucide-react";
import { AgentCard, type AgentState } from "../../../components/AgentCard";
import { Reveal, Skeleton } from "../../../components/ui";
import { api } from "../../../services/api";
import type { EmbeddingQuota, LogEntry } from "../../../types/api";

const parse = (value: string | null): Record<string, unknown> => {
  try { const o = JSON.parse(value ?? ""); return o && typeof o === "object" ? (o as Record<string, unknown>) : {}; } catch { return {}; }
};
const asUtc = (value: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);

function ago(value: string): string {
  const s = Math.max(0, Math.round((Date.now() - asUtc(value).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
/** A run is "working now" only if its newest log line is recent and is not a finishing one. */
const recent = (e: LogEntry | undefined) => Boolean(e) && Date.now() - asUtc(e!.at).getTime() < 10 * 60 * 1000;
const FINISH = ["shortlisted", "failed", "partly_completed", "exported"];

/** The agents behind the app, with live status taken from the activity log and the search quota. */
export default function AgentsPanel({ quota }: { quota: EmbeddingQuota | undefined }) {
  const reading = useQuery({ queryKey: ["logs", "agent-reading"], queryFn: () => api.logs({ category: "extraction", only_stages: true, limit: 60 }), refetchInterval: 10000 });
  const matching = useQuery({ queryKey: ["logs", "agent-matching"], queryFn: () => api.logs({ category: "shortlisting", only_stages: true, limit: 40 }), refetchInterval: 10000 });

  // ---- Reading agent (the ingestion graph) ----
  const readNodes = ["Collect", "Read", "Check", "Extract", "Save"];
  const readItems = reading.data?.items ?? [];
  const readDone = readItems.find((e) => parse(e.output_data).finished === true);
  const readNewest = readItems[0];
  const readWorking = Boolean(readNewest) && !parse(readNewest.output_data).finished && !FINISH.includes(readNewest.stage ?? "") && recent(readNewest);
  const readOut = readDone ? parse(readDone.output_data) : {};
  let readState: AgentState = "idle", readLabel = "Ready", readActive = -1;
  if (readWorking) { readState = "running"; readLabel = "Working now"; readActive = ({ created: 0, collecting: 1, reading: 3 } as Record<string, number>)[readNewest.stage ?? ""] ?? 1; }
  else if (readNewest?.stage === "failed") { readState = "failed"; readLabel = "Last run failed"; }
  else if (readDone) { readActive = readNodes.length; if (num(readOut.failed) > 0) { readState = "attention"; readLabel = `Done · ${num(readOut.failed)} failed`; } else { readState = "done"; readLabel = "Last run done"; } }

  // ---- Matching agent (the matching graph) ----
  const matchNodes = ["Collect", "Earlier scores", "Scoring", "Rank"];
  const matchItems = matching.data?.items ?? [];
  const matchDone = matchItems.find((e) => e.stage === "shortlisted");
  const matchNewest = matchItems[0];
  const matchWorking = Boolean(matchNewest) && !FINISH.includes(matchNewest.stage ?? "") && recent(matchNewest);
  const matchOut = matchDone ? parse(matchDone.output_data) : {};
  let matchState: AgentState = "idle", matchLabel = "Ready", matchActive = -1;
  if (matchWorking) { matchState = "running"; matchLabel = "Working now"; matchActive = ({ created: 0, collecting: 0, reading: 1, scoring: 2 } as Record<string, number>)[matchNewest.stage ?? ""] ?? 1; }
  else if (matchNewest?.stage === "failed") { matchState = "failed"; matchLabel = "Last run failed"; }
  else if (matchNewest?.stage === "partly_completed") { matchState = "attention"; matchLabel = "Partly done"; matchActive = matchNodes.length; }
  else if (matchDone) { matchState = "done"; matchLabel = "Last run done"; matchActive = matchNodes.length; }

  // ---- Indexing agent (makes resumes searchable, runs by itself) ----
  const idxNodes = ["Queue", "Embed", "Searchable"];
  let idxState: AgentState = "done", idxLabel = "All resumes searchable", idxActive = idxNodes.length;
  if (quota?.paused) { idxState = "attention"; idxLabel = "Waiting for the daily limit"; idxActive = 1; }
  else if ((quota?.resumes_waiting ?? 0) > 0) { idxState = "running"; idxLabel = "Working in the background"; idxActive = 1; }
  const pct = quota ? Math.min(100, Math.round((quota.used_today / Math.max(1, quota.daily_limit)) * 100)) : 0;

  const loading = reading.isLoading || matching.isLoading || !quota;
  return (
    <Reveal delay={60} className="chart-card-wrap wide">
      <div className="card chart-card">
        <div className="chart-head"><h3>Your agents</h3><span className="muted small">Live status, refreshed every few seconds</span></div>
        {loading ? <div className="agent-grid"><Skeleton h={190} r={14} /><Skeleton h={190} r={14} /><Skeleton h={190} r={14} /></div> : (
          <div className="agent-grid">
            <AgentCard icon={FileSearch} name="Reading agent" role="Reads and understands every resume"
                       state={readState} stateLabel={readLabel} nodes={readNodes} active={readActive}
                       stats={[{ label: "files", value: readDone ? num(readOut.total) : "—" }, { label: "ready", value: readDone ? num(readOut.saved) : "—" }, { label: "failed", value: readDone ? num(readOut.failed) : "—" }]}
                       footer={readDone ? `Last run ${ago(readDone.at)}${readOut.seconds ? ` · took ${Math.round(num(readOut.seconds))}s` : ""}` : "No runs yet. Upload resumes to start it."} />
            <AgentCard icon={Database} name="Indexing agent" role="Makes new resumes searchable"
                       state={idxState} stateLabel={idxLabel} nodes={idxNodes} active={idxActive}
                       stats={[{ label: "waiting", value: quota?.resumes_waiting ?? 0 }, { label: "resets at", value: quota?.resumes_at.split(" ").slice(1).join(" ") || "—" }]}
                       meter={quota ? { pct, label: `${quota.used_today} of ${quota.daily_limit} used today` } : undefined}
                       footer="Runs by itself every 20 minutes." />
            <AgentCard icon={Target} name="Matching agent" role="Scores resumes against a job"
                       state={matchState} stateLabel={matchLabel} nodes={matchNodes} active={matchActive}
                       stats={[{ label: "scored", value: matchDone ? num(matchOut.scored) : "—" }, { label: "reused", value: matchDone ? num(matchOut.from_cache) : "—" }, { label: "took", value: matchDone && matchOut.seconds != null ? `${Math.round(num(matchOut.seconds) * 10) / 10}s` : "—" }]}
                       footer={matchDone ? `Last run ${ago(matchDone.at)}` : "No runs yet. Pick a job and press Start matching."} />
          </div>
        )}
      </div>
    </Reveal>
  );
}
