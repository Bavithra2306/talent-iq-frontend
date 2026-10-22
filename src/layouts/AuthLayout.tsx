import type { CSSProperties, ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

/** Shared frame for the sign-in pages: animated blue brand panel + white form panel. */
const POINTS = [
  "Read hundreds of resumes in minutes",
  "See who fits each job — and why",
  "Share shortlists with hiring managers in one click",
];
const ADMIN_POINTS = [
  "Invite recruiters and hiring managers",
  "Control who can sign in",
  "Follow every hiring step in the activity log",
];

// A tiny story in motion: one job is compared with candidates and each gets a match score.
// Everything here is made-up demo content, not real candidates.
const MATCHES = [
  { initials: "AM", name: "Alex Morgan", meta: "7 yrs · Java, Spring", score: 94 },
  { initials: "SR", name: "Sam Rivera", meta: "5 yrs · Java, SQL", score: 88 },
  { initials: "JL", name: "Jordan Lee", meta: "4 yrs · Java", score: 81 },
];
const PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 37 + 8) % 96}%`,
  size: 3 + ((i * 5) % 5),
  duration: 11 + ((i * 3) % 9),
  delay: -((i * 2.3) % 14),
}));

function MatchScene() {
  return (
    <div className="auth-scene" aria-hidden="true">
      <div className="scene-job">
        <span className="scene-tag">Job</span>
        <strong>Java Developer</strong>
        <span className="scene-skills"><i>Java</i><i>Spring Boot</i><i>SQL</i></span>
      </div>
      <div className="scene-flow"><span className="scene-dot" /></div>
      <div className="scene-cards">
        {MATCHES.map((m, i) => (
          <div key={m.name} className="scene-card" style={{ ["--i" as string]: i, ["--score" as string]: m.score } as CSSProperties}>
            <span className="scene-avatar">{m.initials}</span>
            <span className="scene-who"><b>{m.name}</b><small>{m.meta}</small></span>
            <span className="scene-ring"><span className="scene-num" /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AuthLayout({ children, admin }: { children: ReactNode; admin?: boolean }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-bg" aria-hidden="true">
          <span className="auth-orb orb-a" /><span className="auth-orb orb-b" /><span className="auth-orb orb-c" />
          {PARTICLES.map((p, i) => (
            <span key={i} className="auth-particle" style={{ left: p.left, width: p.size, height: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
          ))}
        </div>
        <div className="auth-logo"><span className="brand-logo">T</span><span>Talent<b>IQ</b></span></div>
        <div className="auth-copy">
          <h2>{admin ? "Your hiring team, in one place." : "Find the right people, faster."}</h2>
          <ul>
            {(admin ? ADMIN_POINTS : POINTS).map((p) => <li key={p}><CheckCircle2 size={18} /> {p}</li>)}
          </ul>
        </div>
        <MatchScene />
        <p className="auth-foot">© TalentIQ</p>
      </aside>
      <main className="auth-main">
        <div className="auth-panel">{children}</div>
      </main>
    </div>
  );
}
