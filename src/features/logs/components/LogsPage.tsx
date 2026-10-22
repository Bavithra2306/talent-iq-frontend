import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ScrollText } from "lucide-react";
import { Alert, Empty, Loading, PageHeader, Pagination, StageBadge } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { describeAction, describeArea, formatDateTime, friendlyDetails, labelize } from "../../../utils/format";
import type { LogEntry, Stage } from "../../../types/api";

const STAGES: Stage[] = ["created", "collecting", "reading", "scoring", "shortlisted", "exported", "partly_completed", "failed"];
const LIMIT = 30;

/** What happened, e.g. "Scoring finished", then the result details and how long it took. */
function outputText(entry: LogEntry): string {
  const details = friendlyDetails(entry.output_data);
  const took = entry.duration_ms ? `took ${(entry.duration_ms / 1000).toFixed(1)}s` : "";
  return [details, took].filter(Boolean).join(" · ");
}

export default function LogsPage() {
  const [filters, setFilters] = useState({ job_id: "", stage: "", category: "", only_stages: true });
  const [offset, setOffset] = useState(0);
  const [live, setLive] = useState(true);
  const jobs = useQuery({ queryKey: ["jobs", "all-for-logs"], queryFn: () => api.listJobs({ limit: 100 }) });
  const logs = useQuery({
    queryKey: ["logs", filters, offset],
    queryFn: () => api.logs({ ...filters, limit: LIMIT, offset }),
    refetchInterval: live ? 5000 : false,
  });
  const jobTitle = (id: string | null) => (id ? jobs.data?.items.find((j) => j.id === id)?.title ?? "Deleted job" : "—");
  const set = (patch: Partial<typeof filters>) => { setFilters((f) => ({ ...f, ...patch })); setOffset(0); };

  return (
    <>
      <PageHeader title="Activity log" subtitle="Every step the system takes, with the date and time: started, collecting, reading, scoring, shortlisted, exported — or partly done and failed."
                  actions={<label className="check"><input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> <RefreshCw size={14} /> Live updates</label>} />
      <div className="card">
        <div className="toolbar">
          <select className="select" value={filters.job_id} onChange={(e) => set({ job_id: e.target.value })}>
            <option value="">All jobs</option>
            {jobs.data?.items.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
          <select className="select" value={filters.stage} onChange={(e) => set({ stage: e.target.value })}>
            <option value="">All steps</option>
            {STAGES.map((s) => <option key={s} value={s}>{labelize(s)}</option>)}
          </select>
          <select className="select" value={filters.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">All areas</option>
            <option value="extraction">Reading resumes &amp; job descriptions</option>
            <option value="scraping">Sourcing</option>
            <option value="scoring">Scoring</option>
            <option value="shortlisting">Shortlisting &amp; review</option>
            <option value="exporting">Exports</option>
          </select>
          <label className="check small"><input type="checkbox" checked={!filters.only_stages} onChange={(e) => set({ only_stages: !e.target.checked })} /> Show every event</label>
        </div>
        {logs.isLoading && <Loading />}
        {logs.isError && <div className="card-body"><Alert tone="error">{errorMessage(logs.error)}</Alert></div>}
        {logs.data?.items.length === 0 && <Empty title="No activity yet" icon={<ScrollText />} />}
        {logs.data && logs.data.items.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Time</th><th>Step</th><th>Input</th><th>Output (what happened)</th><th>Job</th></tr></thead>
              <tbody>
                {logs.data.items.map((l) => (
                  <tr key={l.id}>
                    <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(l.at)}</td>
                    <td><StageBadge stage={l.stage} /></td>
                    <td className="small muted" style={{ maxWidth: 300 }}>{friendlyDetails(l.input_data) || "—"}</td>
                    <td style={{ maxWidth: 420 }}>
                      <div>{l.action ? describeAction(l.action) : describeArea(l.category)}</div>
                      {outputText(l) && <div className="small muted">{outputText(l)}</div>}
                    </td>
                    <td>{jobTitle(l.job_id)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {logs.data && <Pagination total={logs.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
      </div>
    </>
  );
}
