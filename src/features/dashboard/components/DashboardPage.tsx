import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, FilePlus2, ListChecks, Upload, UserPlus, ScrollText } from "lucide-react";
import type { ReactNode } from "react";
import { ROLE_LABEL, useSession } from "../../../app/session";
import { Alert, AnimatedNumber, BarList, ColumnChart, DonutChart, Funnel, Reveal, Skeleton, type Slice } from "../../../components/ui";
import { api } from "../../../services/api";
import AgentsPanel from "./AgentsPanel";
import { STATUS_LABEL } from "../../../utils/format";
import type { CandidateStatus } from "../../../types/api";

/** Home: a greeting, counting numbers, a few live charts and quick actions. */
export default function DashboardPage() {
  const { user } = useSession();
  const first = (user.name ?? user.email).split(/[\s@]/)[0];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="home">
      <div className="home-hello reveal">
        <h1>{greeting}, {first}</h1>
        <p>{today} · {ROLE_LABEL[user.role]}</p>
      </div>
      {user.role === "recruiter" && <RecruiterHome />}
      {user.role === "hiring_manager" && <ManagerHome />}
      {user.role === "admin" && <AdminHome />}
    </div>
  );
}

function Tile({ label, value, to, icon, delay = 0 }: { label: string; value: number | undefined; to: string; icon: ReactNode; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <Link to={to} className="home-tile">
        <span className="home-tile-icon">{icon}</span>
        <span className="home-tile-value">{value === undefined ? <Skeleton w={48} h={30} /> : <AnimatedNumber value={value} />}</span>
        <span className="home-tile-label">{label}</span>
      </Link>
    </Reveal>
  );
}

function Action({ to, icon, label, primary }: { to: string; icon: ReactNode; label: string; primary?: boolean }) {
  return <Link to={to} className={`btn home-action ${primary ? "btn-primary" : ""}`}>{icon} {label}</Link>;
}

function ChartCard({ title, hint, children, delay = 0, wide }: { title: string; hint?: string; children: ReactNode; delay?: number; wide?: boolean }) {
  return (
    <Reveal delay={delay} className={`chart-card-wrap ${wide ? "wide" : ""}`}>
      <div className="card chart-card">
        <div className="chart-head"><h3>{title}</h3>{hint && <span className="muted small">{hint}</span>}</div>
        {children}
      </div>
    </Reveal>
  );
}

const STATUSES = Object.keys(STATUS_LABEL) as CandidateStatus[];

function RecruiterHome() {
  const navigate = useNavigate();
  const resumes = useQuery({ queryKey: ["candidates", "count"], queryFn: () => api.listCandidates({ limit: 1 }) });
  const jobs = useQuery({ queryKey: ["jobs", "open-count"], queryFn: () => api.listJobs({ status: "open", limit: 1 }) });
  const review = useQuery({ queryKey: ["resume-review"], queryFn: api.reviewFiles });
  const quota = useQuery({ queryKey: ["quota"], queryFn: api.embeddingQuota, refetchInterval: 60000 });
  const categories = useQuery({ queryKey: ["categories"], queryFn: api.categories });
  const counts = useQuery({
    queryKey: ["all-shortlists", "dashboard-counts"],
    queryFn: async () => Object.fromEntries(await Promise.all(STATUSES.map(async (st) =>
      [st, (await api.allShortlists({ status: st, limit: 1, include_unranked: true })).total] as const))) as Record<CandidateStatus, number>,
  });
  const runs = useQuery({
    queryKey: ["logs", "runs-per-day"],
    queryFn: () => api.logs({ stage: "shortlisted", category: "shortlisting", only_stages: true, limit: 200 }),
  });

  const c = counts.data;
  const shortlistedPlus = c ? c.shortlisted + c.approved + c.rejected + c.interview_scheduled : 0;
  const approvedPlus = c ? c.approved + c.interview_scheduled : 0;
  const scored = c ? Object.values(c).reduce((a, b) => a + b, 0) : 0;
  const funnel: Slice[] = [
    { label: "Resumes", value: resumes.data?.total ?? 0 },
    { label: "Scored", value: scored },
    { label: "Ever shortlisted", value: shortlistedPlus },
    { label: "Approved", value: approvedPlus },
  ];
  const fields: Slice[] = (categories.data ?? []).filter((x) => x.count > 0)
    .map((x) => ({ label: x.category ?? "Other", value: x.count })).sort((a, b) => b.value - a.value);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { key: d.toDateString(), label: d.toLocaleDateString(undefined, { weekday: "short" }), value: 0 };
  });
  for (const item of runs.data?.items ?? []) {
    const slot = days.find((d) => d.key === new Date(item.at).toDateString());
    if (slot) slot.value += 1;
  }

  return (
    <>
      <div className="home-tiles">
        <Tile label="Resumes" value={resumes.data?.total} to="/resumes" icon={<Upload />} />
        <Tile label="Open jobs" value={jobs.data?.total} to="/jobs" icon={<FilePlus2 />} delay={60} />
        <Tile label="Shortlisted" value={c ? c.shortlisted : undefined} to="/shortlists" icon={<ListChecks />} delay={120} />
        <Tile label="Need your review" value={review.data?.length} to="/resumes" icon={<ClipboardCheck />} delay={180} />
      </div>
      <div className="home-actions">
        <Action to="/resumes" icon={<Upload />} label="Upload resumes" primary />
        <Action to="/jobs/new" icon={<FilePlus2 />} label="New job description" />
        <Action to="/shortlists" icon={<ListChecks />} label="Start matching" />
      </div>
      {quota.data?.paused && (
        <Alert tone="warn">Today’s free search limit is used up. New resumes are still read; they are fully searchable after {quota.data.resumes_at}.</Alert>
      )}
      <div className="chart-grid">
        <AgentsPanel quota={quota.data} />
        <ChartCard title="Resumes by field" hint="Click a field to open the list" delay={80}>
          {categories.isLoading ? <Skeleton h={190} /> : fields.length === 0
            ? <p className="muted">No resumes yet. Upload some to see the split.</p>
            : (
              <div className="donut-layout">
                <DonutChart data={fields} centerLabel="resumes" />
                <BarList data={fields.slice(0, 6)} onSelect={(label) => navigate(`/resumes?category=${encodeURIComponent(label)}`)} />
              </div>
            )}
        </ChartCard>
        <ChartCard title="Hiring funnel" hint="Share that carries on at each step" delay={160}>
          {counts.isLoading ? <Skeleton h={190} /> : <Funnel steps={funnel} />}
        </ChartCard>
        <ChartCard title="Matching runs" hint="Last 7 days" delay={240} wide>
          {runs.isLoading ? <Skeleton h={140} /> : <ColumnChart data={days} />}
        </ChartCard>
      </div>
    </>
  );
}

function ManagerHome() {
  const shared = useQuery({ queryKey: ["review", "all"], queryFn: () => api.sharedWithMe({}) });
  const count = (fn: (s: string, scheduled: boolean) => boolean) =>
    shared.data ? shared.data.filter((e) => fn(e.status, Boolean(e.interview_scheduled_at))).length : undefined;
  const toReview = count((s) => s === "shortlisted");
  const approved = count((s) => s === "approved");
  const rejected = count((s) => s === "rejected");
  const scheduled = count((_, sc) => sc);
  const split: Slice[] = [
    { label: "To review", value: toReview ?? 0, color: "#F59E0B" },
    { label: "Approved", value: approved ?? 0, color: "#16A34A" },
    { label: "Rejected", value: rejected ?? 0, color: "#EF4444" },
  ].filter((s) => s.value > 0);
  return (
    <>
      <div className="home-tiles">
        <Tile label="To review" value={toReview} to="/review" icon={<ClipboardCheck />} />
        <Tile label="Approved" value={approved} to="/review" icon={<ListChecks />} delay={60} />
        <Tile label="Interviews scheduled" value={scheduled} to="/review" icon={<ScrollText />} delay={120} />
        <Tile label="Rejected" value={rejected} to="/review" icon={<FilePlus2 />} delay={180} />
      </div>
      <div className="home-actions">
        <Action to="/review" icon={<ClipboardCheck />} label="Review candidates" primary />
        <Action to="/jobs/new" icon={<FilePlus2 />} label="New job description" />
        <Action to="/jobs" icon={<ListChecks />} label="See jobs" />
      </div>
      <div className="chart-grid single">
        <ChartCard title="Your decisions" hint="Candidates shared with you" delay={80}>
          {shared.isLoading ? <Skeleton h={190} /> : split.length === 0
            ? <p className="muted">Nobody has been shared with you yet. Shortlists from recruiters appear here.</p>
            : <div className="donut-layout"><DonutChart data={split} centerLabel="candidates" /><BarList data={split} /></div>}
        </ChartCard>
      </div>
    </>
  );
}

function AdminHome() {
  const team = useQuery({
    queryKey: ["team"],
    queryFn: async () => (await Promise.all((["admin", "recruiter", "hiring_manager"] as const).map((r) => api.directory(r)))).flat(),
  });
  const count = (fn: (role: string, status: string, blocked: boolean) => boolean) =>
    team.data ? team.data.filter((m) => fn(m.role, m.status, Boolean(m.blocked))).length : undefined;
  const split: Slice[] = [
    { label: "Active", value: count((_, s, b) => s === "active" && !b) ?? 0, color: "#16A34A" },
    { label: "Not signed in yet", value: count((_, s, b) => s === "pending" && !b) ?? 0, color: "#0EA5E9" },
    { label: "Invite not accepted", value: count((_, s) => s === "invite_sent") ?? 0, color: "#F59E0B" },
    { label: "Blocked", value: count((_, __, b) => b) ?? 0, color: "#EF4444" },
  ].filter((s) => s.value > 0);
  return (
    <>
      <div className="home-tiles">
        <Tile label="Recruiters" value={count((r, s) => r === "recruiter" && s !== "invite_sent")} to="/team" icon={<Upload />} />
        <Tile label="Hiring managers" value={count((r, s) => r === "hiring_manager" && s !== "invite_sent")} to="/team" icon={<ClipboardCheck />} delay={60} />
        <Tile label="Invites not accepted" value={count((_, s) => s === "invite_sent")} to="/team" icon={<UserPlus />} delay={120} />
        <Tile label="Not signed in yet" value={count((_, s) => s === "pending")} to="/team" icon={<ListChecks />} delay={180} />
      </div>
      <div className="home-actions">
        <Action to="/team" icon={<UserPlus />} label="Invite someone" primary />
        <Action to="/logs" icon={<ScrollText />} label="Activity log" />
      </div>
      <div className="chart-grid single">
        <ChartCard title="Team status" hint="Everyone on TalentIQ" delay={80}>
          {team.isLoading ? <Skeleton h={190} /> : <div className="donut-layout"><DonutChart data={split} centerLabel="people" /><BarList data={split} /></div>}
        </ChartCard>
      </div>
    </>
  );
}
