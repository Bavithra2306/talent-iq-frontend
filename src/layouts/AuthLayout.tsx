import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { CheckCircle2, FileCheck2, Send, Star } from "lucide-react";
import { LogoMark } from "../components/Logo";

/** Shared frame for the sign-in pages: a full-page animated background with the form in a centred card. */
const POINTS = [
  "Read hundreds of resumes in minutes",
  "See who fits each job, and why",
  "Share shortlists in one click",
];
const ADMIN_POINTS = [
  "Invite recruiters and hiring managers",
  "Control who can sign in",
  "Follow every step in the activity log",
];

// Made-up demo content that tells the product story: a job is compared with candidates and each gets a score.
const MATCHES = [
  { initials: "AM", name: "Alex Morgan", meta: "7 yrs · Java, Spring", score: 94 },
  { initials: "SR", name: "Sam Rivera", meta: "5 yrs · Java, SQL", score: 88 },
  { initials: "JL", name: "Jordan Lee", meta: "4 yrs · Java", score: 81 },
];
const BADGES = [
  { icon: FileCheck2, title: "Resume read", text: "Name, skills and roles found" },
  { icon: Star, title: "Top match", text: "94% fit for Java Developer" },
  { icon: Send, title: "Shortlist shared", text: "With the hiring manager" },
];
const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37 + 8) % 98}%`,
  size: 3 + ((i * 5) % 5),
  duration: 12 + ((i * 3) % 10),
  delay: -((i * 2.3) % 16),
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

function FloatingBadges() {
  return (
    <div className="float-badges" aria-hidden="true">
      {BADGES.map((b, i) => (
        <div key={b.title} className="float-badge" style={{ ["--i" as string]: i } as CSSProperties}>
          <span className="float-badge-icon"><b.icon size={18} /></span>
          <span><strong>{b.title}</strong><small>{b.text}</small></span>
        </div>
      ))}
    </div>
  );
}

/** Moving the mouse anywhere on the page nudges the glow orbs, particles and floating cards (parallax),
 *  and a soft light follows the pointer. Off for touch screens and "reduce motion". */
function usePointerParallax(shell: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = shell.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || window.matchMedia("(pointer: coarse)").matches) return;
    let frame = 0;
    let x = 0, y = 0, gx = 0, gy = 0;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--mx", x.toFixed(3));
      el.style.setProperty("--my", y.toFixed(3));
      el.style.setProperty("--gx", `${gx}px`);
      el.style.setProperty("--gy", `${gy}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(apply); };
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      gx = e.clientX - r.left;
      gy = e.clientY - r.top;
      x = (gx / r.width) * 2 - 1;
      y = (gy / r.height) * 2 - 1;
      schedule();
    };
    const leave = () => { x = 0; y = 0; schedule(); };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [shell]);
}

export default function AuthLayout({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const shell = useRef<HTMLDivElement>(null);
  usePointerParallax(shell);
  return (
    <div className="auth-shell" ref={shell}>
      <div className="auth-bg" aria-hidden="true">
        <span className="auth-orb orb-a" /><span className="auth-orb orb-b" /><span className="auth-orb orb-c" /><span className="auth-orb orb-d" />
        <div className="auth-particles">
          {PARTICLES.map((p, i) => (
            <span key={i} className="auth-particle" style={{ left: p.left, width: p.size, height: p.size, animationDuration: `${p.duration}s`, animationDelay: `${p.delay}s` }} />
          ))}
        </div>
        <span className="auth-glow" />
      </div>
      <MatchScene />
      <FloatingBadges />
      <main className="auth-center">
        <div className="auth-card">
          <div className="auth-brandrow">
            <LogoMark size={46} animated />
            <span className="auth-wordmark">Talent<b>IQ</b></span>
          </div>
          <p className="auth-tagline">{admin ? "Your hiring team, in one place." : "Find the right people, faster."}</p>
          <div className="auth-panel">{children}</div>
        </div>
        <ul className="auth-points">
          {(admin ? ADMIN_POINTS : POINTS).map((p) => <li key={p}><CheckCircle2 size={16} /> {p}</li>)}
        </ul>
      </main>
    </div>
  );
}
