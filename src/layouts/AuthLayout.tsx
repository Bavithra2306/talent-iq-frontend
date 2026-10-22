import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

/** Shared frame for the sign-in pages: blue brand panel + white form panel. */
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

export default function AuthLayout({ children, admin }: { children: ReactNode; admin?: boolean }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-logo"><span className="brand-logo">T</span><span>Talent<b>IQ</b></span></div>
        <div>
          <h2>{admin ? "Your hiring team, in one place." : "Find the right people, faster."}</h2>
          <ul>
            {(admin ? ADMIN_POINTS : POINTS).map((p) => <li key={p}><CheckCircle2 size={18} /> {p}</li>)}
          </ul>
        </div>
        <p className="auth-foot">© TalentIQ</p>
      </aside>
      <main className="auth-main">
        <div className="auth-panel">{children}</div>
      </main>
    </div>
  );
}
