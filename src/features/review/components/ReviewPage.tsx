import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ClipboardCheck, Eye, FileText, X } from "lucide-react";
import { Alert, AnimatedNumber, Drawer, Empty, Loading, PageHeader, Pagination, ScoreBar, useToast } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears } from "../../../utils/format";
import type { ShortlistEntry } from "../../../types/api";
import EntryDetail from "../../shortlist/components/EntryDetail";

type Tab = "review" | "approved" | "rejected";

const TABS: { key: Tab; label: string }[] = [
  { key: "review", label: "To review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];
const LIMIT = 15;

function tabOf(e: ShortlistEntry): Tab {
  if (e.status === "approved") return "approved";
  if (e.status === "rejected") return "rejected";
  return "review";
}

/** Hiring manager: the candidates recruiters shared with me, in one tidy table with three tabs. */
export default function ReviewPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("review");
  const [jobId, setJobId] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<ShortlistEntry | null>(null);
  useEffect(() => setOffset(0), [tab, jobId]); // a new tab or job starts from the first page

  const all = useQuery({ queryKey: ["review", "all"], queryFn: () => api.sharedWithMe({}) });
  const shared = useMemo(() => (all.data ?? []).filter((e) => !jobId || e.job_id === jobId), [all.data, jobId]);
  const counts = useMemo(() => {
    const c: Record<Tab, number> = { review: 0, approved: 0, rejected: 0 };
    for (const e of shared) c[tabOf(e)] += 1;
    return c;
  }, [shared]);
  const rows = useMemo(
    () => shared.filter((e) => tabOf(e) === tab).sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0)),
    [shared, tab],
  );
  const page = rows.slice(offset, offset + LIMIT);
  const jobs = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of all.data ?? []) map.set(e.job_id, e.job_title ?? "Job");
    return [...map.entries()];
  }, [all.data]);

  const decide = useMutation({
    mutationFn: ({ entry, decision }: { entry: ShortlistEntry; decision: "approved" | "rejected" }) => api.decide(entry.id, decision, ""),
    // Move the row at once; roll back if the server says no.
    onMutate: async ({ entry, decision }) => {
      await queryClient.cancelQueries({ queryKey: ["review", "all"] });
      const before = queryClient.getQueryData<ShortlistEntry[]>(["review", "all"]);
      queryClient.setQueryData<ShortlistEntry[]>(["review", "all"], (list) => list?.map((x) => (x.id === entry.id ? { ...x, status: decision } : x)));
      return { before };
    },
    onSuccess: (e) => toast(`${e.name ?? "Candidate"} ${e.status}.`, "success"),
    onError: (err, _vars, ctx) => {
      if (ctx?.before) queryClient.setQueryData(["review", "all"], ctx.before);
      toast(errorMessage(err), "error");
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["review"] }),
  });
  const reject = (e: ShortlistEntry) => {
    if (window.confirm(`Reject ${e.name ?? "this candidate"}?`)) decide.mutate({ entry: e, decision: "rejected" });
  };

  const total = shared.length;
  const reviewed = total - counts.review;

  return (
    <>
      <PageHeader title="Review candidates" subtitle="Open a candidate to see why they were picked, then approve or reject." />

      {all.isLoading && <Loading />}
      {all.isError && <Alert tone="error">{errorMessage(all.error)}</Alert>}

      {all.data && all.data.length === 0 && (
        <div className="card"><Empty title="Nothing here" icon={<ClipboardCheck />}>When a recruiter shares candidates with you, they appear here.</Empty></div>
      )}

      {all.data && all.data.length > 0 && (
        <div className="card">
          <div className="toolbar">
            <div className="segmented" role="tablist" aria-label="Review status">
              {TABS.map((t) => (
                <button key={t.key} role="tab" aria-selected={tab === t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)}>
                  {t.label} <span className="tab-count"><AnimatedNumber value={counts[t.key]} duration={300} /></span>
                </button>
              ))}
            </div>
            <select className="select" value={jobId} onChange={(e) => setJobId(e.target.value)} aria-label="Job">
              <option value="">All jobs</option>
              {jobs.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
            <span className="review-progress-line muted small">{reviewed} of {total} reviewed</span>
          </div>

          {rows.length === 0 ? (
            <Empty title={tab === "review" ? "You are all caught up" : "Nobody here yet"} icon={<ClipboardCheck />}>
              {tab === "review" ? "No candidates are waiting for your decision." : `No ${tab} candidates${jobId ? " for this job" : ""}.`}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="table review-table">
                <thead><tr><th>Candidate</th><th>Job</th><th>Score</th><th style={{ textAlign: "right" }}>Actions</th></tr></thead>
                <tbody>
                  {page.map((e) => (
                    <tr key={e.id} className="clickable" onClick={() => setOpen(e)}>
                      <td>
                        <div className="cell-title">{e.name ?? "Name not given"}</div>
                        <div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience)].filter((x) => x && x !== "—").join(" · ")}</div>
                      </td>
                      <td>{e.job_title}</td>
                      <td style={{ minWidth: 140 }}><ScoreBar value={e.total_score} /></td>
                      <td onClick={(ev) => ev.stopPropagation()}>
                        <div className="row review-actions">
                          <button className="btn btn-sm btn-icon" title="Details" aria-label="Details" onClick={() => setOpen(e)}><Eye /></button>
                          <button className="btn btn-sm btn-icon" title="View resume" aria-label="View resume"
                                  onClick={() => openFile(`/api/v1/review/${e.id}/resume`, e.name ?? "Resume")}><FileText /></button>
                          <button className="btn btn-sm btn-success btn-icon" title="Approve" aria-label="Approve" disabled={e.status === "approved" || decide.isPending}
                                  onClick={() => decide.mutate({ entry: e, decision: "approved" })}><Check /></button>
                          <button className="btn btn-sm btn-danger btn-icon" title="Reject" aria-label="Reject" disabled={e.status === "rejected" || decide.isPending}
                                  onClick={() => reject(e)}><X /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination total={rows.length} limit={LIMIT} offset={offset} onChange={setOffset} />
        </div>
      )}

      {open && (
        <Drawer title="Candidate details" onClose={() => setOpen(null)} half
                footer={tabOf(open) === "review" ? (
                  <>
                    <button className="btn btn-danger" disabled={decide.isPending} onClick={() => { reject(open); setOpen(null); }}><X /> Reject</button>
                    <button className="btn btn-success" disabled={decide.isPending} onClick={() => { decide.mutate({ entry: open, decision: "approved" }); setOpen(null); }}><Check /> Approve</button>
                  </>
                ) : undefined}>
          <EntryDetail entry={open} onOpenResume={() => openFile(`/api/v1/review/${open.id}/resume`, open.name ?? "Resume")} />
        </Drawer>
      )}
    </>
  );
}
