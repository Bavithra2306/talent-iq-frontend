import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, ClipboardCheck, Globe, ListChecks, Plus, Upload, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useSession } from "../../app/session";
import { Alert, Loading, PageHeader, ScoreBar, StageBadge, StatusBadge } from "../../components/ui";
import { api } from "../../lib/api";
import { describeAction, describeArea, formatDateTime, formatYears } from "../../lib/format";

function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon: ReactNode }) {
  return (
    <div className="card stat">
      <div className="stat-label">{icon}{label}</div>
      <div className="stat-value">{value ?? "—"}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}

function RecentActivity() {
  const logs = useQuery({ queryKey: ["logs", "recent"], queryFn: () => api.logs({ only_stages: true, limit: 8 }), refetchInterval: 10000 });
  return (
    <div className="card">
      <div className="card-header"><h2>Recent activity</h2><Link to="/logs">See all</Link></div>
      {logs.isLoading && <Loading />}
      {logs.data?.items.length === 0 && <div className="card-body muted">Nothing has happened yet.</div>}
      <div className="table-wrap">
        <table className="table">
          <tbody>
            {logs.data?.items.map((l) => (
              <tr key={l.id}>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>{formatDateTime(l.at)}</td>
                <td><StageBadge stage={l.stage} /></td>
                <td>{l.action ? describeAction(l.action) : describeArea(l.category)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useSession();
  const first = (user.name ?? user.email).split(/[\s@]/)[0];
  return (
    <>
      <PageHeader title={`Hello, ${first}`} subtitle="Here is what is happening in TalentIQ." />
      {user.role === "recruiter" && <RecruiterHome />}
      {user.role === "hiring_manager" && <ManagerHome />}
      {user.role === "admin" && <AdminHome />}
    </>
  );
}

function RecruiterHome() {
  const jobs = useQuery({ queryKey: ["jobs", "open-count"], queryFn: () => api.listJobs({ status: "open", limit: 1 }) });
  const candidates = useQuery({ queryKey: ["candidates", "count"], queryFn: () => api.listCandidates({ limit: 1 }) });
  const shortlisted = useQuery({ queryKey: ["all-shortlists", "count"], queryFn: () => api.allShortlists({ status: "shortlisted", limit: 1 }) });
  const decided = useQuery({ queryKey: ["all-shortlists", "approved-count"], queryFn: () => api.allShortlists({ status: "approved", limit: 1, include_unranked: true }) });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const quota = useQuery({ queryKey: ["quota"], queryFn: api.embeddingQuota, refetchInterval: 60000 });

  return (
    <div className="stack">
      <div className="grid grid-4">
        <Stat icon={<Briefcase size={15} />} label="Open jobs" value={jobs.data?.total} />
        <Stat icon={<Users size={15} />} label="Candidates" value={candidates.data?.total} hint="Resumes read so far" />
        <Stat icon={<ListChecks size={15} />} label="Shortlisted" value={shortlisted.data?.total} hint="Waiting to be shared or reviewed" />
        <Stat icon={<ClipboardCheck size={15} />} label="Approved" value={decided.data?.total} hint="By hiring managers" />
      </div>
      {quota.data?.paused && (
        <Alert tone="warn">
          Today’s free AI search limit is used up. New resumes are still read and can be matched, and they will be fully indexed after {quota.data.resumes_at}.
        </Alert>
      )}
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <div className="card card-pad stack">
          <h2>Quick actions</h2>
          <div className="grid grid-2">
            <Link to="/jobs/new" className="btn"><Plus /> New job</Link>
            <Link to="/candidates" className="btn"><Upload /> Upload resumes</Link>
            <Link to="/sourcing" className="btn"><Globe /> Find resumes online</Link>
            <Link to="/shortlists" className="btn"><ListChecks /> Find best matches</Link>
          </div>
          <div>
            <h3 style={{ margin: "6px 0 10px" }}>Candidates by field</h3>
            {categories.isLoading && <Loading />}
            <div className="chips">
              {categories.data?.map((c) => c.category && (
                <Link key={c.category} to="/candidates" className="chip">{c.category}<span className="count">{c.count}</span></Link>
              ))}
              {categories.data?.length === 0 && <span className="muted">No candidates yet.</span>}
            </div>
          </div>
        </div>
        <RecentActivity />
      </div>
    </div>
  );
}

function ManagerHome() {
  const shared = useQuery({ queryKey: ["review", "all"], queryFn: () => api.sharedWithMe({}) });
  const navigate = useNavigate();
  const count = (s: string) => shared.data?.filter((e) => e.status === s).length ?? 0;
  const toReview = shared.data?.filter((e) => e.status === "shortlisted") ?? [];
  return (
    <div className="stack">
      <div className="grid grid-4">
        <Stat icon={<ClipboardCheck size={15} />} label="To review" value={shared.data ? count("shortlisted") : undefined} />
        <Stat icon={<ClipboardCheck size={15} />} label="Approved" value={shared.data ? count("approved") : undefined} />
        <Stat icon={<ClipboardCheck size={15} />} label="Rejected" value={shared.data ? count("rejected") : undefined} />
        <Stat icon={<ClipboardCheck size={15} />} label="Interviews" value={shared.data ? count("interview_scheduled") : undefined} />
      </div>
      <div className="card">
        <div className="card-header">
          <div><h2>Waiting for your review</h2><p>Shortlisted candidates that recruiters shared with you.</p></div>
          <div className="page-actions">
            <Link to="/jobs/new" className="btn"><Plus /> Create a job</Link>
            <Link to="/review" className="btn btn-primary"><ClipboardCheck /> Review all</Link>
          </div>
        </div>
        {shared.isLoading && <Loading />}
        {shared.data && toReview.length === 0 && (
          <div className="card-body muted">Nothing to review right now. When a recruiter shares a shortlist, it shows up here.</div>
        )}
        {toReview.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {toReview.slice(0, 6).map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => navigate("/review")}>
                    <td><div className="cell-title">{e.name ?? "Name not given"}</div>
                      <div className="cell-sub">{[e.current_title, formatYears(e.total_years_experience)].filter((x) => x && x !== "—").join(" · ")}</div></td>
                    <td>{e.job_title}</td>
                    <td style={{ minWidth: 150 }}><ScoreBar value={e.total_score} /></td>
                    <td><StatusBadge status={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <RecentActivity />
    </div>
  );
}

function AdminHome() {
  return (
    <div className="grid grid-2" style={{ alignItems: "start" }}>
      <div className="card card-pad stack">
        <h2>Quick actions</h2>
        <Link to="/team" className="btn btn-primary"><Users /> Invite a recruiter or hiring manager</Link>
        <Link to="/logs" className="btn">See the activity log</Link>
      </div>
      <RecentActivity />
    </div>
  );
}
