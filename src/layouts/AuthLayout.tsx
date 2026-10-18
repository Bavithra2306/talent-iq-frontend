import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";

/** Shared frame for the sign-in pages: purple brand panel + white form panel. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <aside className="auth-brand">
        <div className="auth-logo"><span className="brand-logo">T</span><span>Talent<b>IQ</b></span></div>
        <div>
          <h2>Find the right people, faster.</h2>
          <ul>
            <li><CheckCircle2 size={18} /> Read hundreds of resumes in minutes</li>
            <li><CheckCircle2 size={18} /> See who fits each job — and why</li>
            <li><CheckCircle2 size={18} /> Share shortlists with hiring managers in one click</li>
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
