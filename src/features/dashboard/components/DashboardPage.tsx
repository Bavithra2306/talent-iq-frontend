import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, FilePlus2, ListChecks, ScrollText, Upload, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { ROLE_LABEL, useSession } from "../../../app/session";
import { Alert } from "../../../components/ui";
import { api } from "../../../services/api";

/** Home: a greeting, four numbers, three actions and the latest activity. Nothing else. */
export default function DashboardPage() {
  const { user } = useSession();
  const first = (user.name ?? user.email).split(/[\s@]/)[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="home">
      <div className="home-hello">
        <h1>Hello, {first}</h1>
        <p>{today} · {ROLE_LABEL[user.role]}</p>
      </div>
      {user.role === "recruiter" && <RecruiterHome />}
      {user.role === "hiring_manager" && <ManagerHome />}
      {user.role === "admin" && <AdminHome />}
    </div>
  );
}

function Tile({ label, value, to }: { label: string; value: number | undefined; to: string }) {
  return (
    <Link to={to} className="home-tile">
      <span className="home-tile-value">{value ?? "—"}</span>
      <span className="home-tile-label">{label}</span>
    </Link>
  );
}

function Action({ to, icon, label, primary }: { to: string; icon: ReactNode; label: string; primary?: boolean }) {
  return <Link to={to} className={`btn home-action ${primary ? "btn-primary" : ""}`}>{icon} {label}</Link>;
}

function RecruiterHome() {
  const resumes = useQuery({ queryKey: ["candidates", "count"], queryFn: () => api.listCandidates({ limit: 1 }) });
  const jobs = useQuery({ queryKey: ["jobs", "open-count"], queryFn: () => api.listJobs({ status: "open", limit: 1 }) });
  const shortlisted = useQuery({ queryKey: ["all-shortlists", "count"], queryFn: () => api.allShortlists({ status: "shortlisted", limit: 1 }) });
  const review = useQuery({ queryKey: ["resume-review"], queryFn: api.reviewFiles });
  const quota = useQuery({ queryKey: ["quota"], queryFn: api.embeddingQuota, refetchInterval: 60000 });
  return (
    <>
      <div className="home-tiles">
        <Tile label="Resumes" value={resumes.data?.total} to="/resumes" />
        <Tile label="Open jobs" value={jobs.data?.total} to="/jobs" />
        <Tile label="Shortlisted" value={shortlisted.data?.total} to="/shortlists" />
        <Tile label="Need your review" value={review.data?.length} to="/resumes" />
      </div>
      <div className="home-actions">
        <Action to="/resumes" icon={<Upload />} label="Upload resumes" primary />
        <Action to="/jobs/new" icon={<FilePlus2 />} label="New job description" />
        <Action to="/shortlists" icon={<ListChecks />} label="Start matching" />
      </div>
      {quota.data?.paused && (
        <Alert tone="warn">Today’s free search limit is used up. New resumes are still read; they are fully searchable after {quota.data.resumes_at}.</Alert>
      )}
    </>
  );
}

function ManagerHome() {
  const shared = useQuery({ queryKey: ["review", "all"], queryFn: () => api.sharedWithMe({}) });
  const count = (fn: (s: string, scheduled: boolean) => boolean) =>
    shared.data ? shared.data.filter((e) => fn(e.status, Boolean(e.interview_scheduled_at))).length : undefined;
  return (
    <>
      <div className="home-tiles">
        <Tile label="To review" value={count((s) => s === "shortlisted")} to="/review" />
        <Tile label="Approved" value={count((s) => s === "approved")} to="/review" />
        <Tile label="Interviews scheduled" value={count((_, scheduled) => scheduled)} to="/review" />
        <Tile label="Rejected" value={count((s) => s === "rejected")} to="/review" />
      </div>
      <div className="home-actions">
        <Action to="/review" icon={<ClipboardCheck />} label="Review candidates" primary />
        <Action to="/jobs/new" icon={<FilePlus2 />} label="New job description" />
        <Action to="/jobs" icon={<ListChecks />} label="See jobs" />
      </div>
    </>
  );
}

function AdminHome() {
  const team = useQuery({
    queryKey: ["team"],
    queryFn: async () => (await Promise.all((["admin", "recruiter", "hiring_manager"] as const).map((r) => api.directory(r)))).flat(),
  });
  const count = (fn: (role: string, status: string) => boolean) =>
    team.data ? team.data.filter((m) => fn(m.role, m.status)).length : undefined;
  return (
    <>
      <div className="home-tiles">
        <Tile label="Recruiters" value={count((r, s) => r === "recruiter" && s !== "invite_sent")} to="/team" />
        <Tile label="Hiring managers" value={count((r, s) => r === "hiring_manager" && s !== "invite_sent")} to="/team" />
        <Tile label="Invites not accepted" value={count((_, s) => s === "invite_sent")} to="/team" />
        <Tile label="Not signed in yet" value={count((_, s) => s === "pending")} to="/team" />
      </div>
      <div className="home-actions">
        <Action to="/team" icon={<UserPlus />} label="Invite someone" primary />
        <Action to="/logs" icon={<ScrollText />} label="Activity log" />
        <Action to="/profile" icon={<ClipboardCheck />} label="My profile" />
      </div>
    </>
  );
}
