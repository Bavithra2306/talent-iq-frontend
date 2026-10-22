import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { CheckCircle2 } from "lucide-react";
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

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37 + 8) % 98}%`,
  size: 3 + ((i * 5) % 5),
  duration: 12 + ((i * 3) % 10),
  delay: -((i * 2.3) % 16),
}));

// A drifting field of blank resume sheets across the whole page. Each one is read, then a tick appears
// ("matched"). No text, so nothing to read wrongly, and it fits every role.
const SHEETS = Array.from({ length: 14 }, (_, i) => ({
  left: `${(i * 29 + 4) % 94}%`,
  width: 74 + ((i * 17) % 40),
  duration: 26 + ((i * 7) % 18),
  delay: -((i * 5.3) % 40),
  depth: [8, 16, 26][i % 3],
  tilt: ((i * 13) % 17) - 8,
  lines: 3 + (i % 3),
}));

function DocField() {
  return (
    <div className="doc-field" aria-hidden="true">
      {SHEETS.map((d, i) => (
        <div key={i} className="doc-depth" style={{ left: d.left, ["--k" as string]: d.depth } as CSSProperties}>
          <div className="doc-sheet" style={{ width: d.width, animationDuration: `${d.duration}s`, animationDelay: `${d.delay}s`, ["--tilt" as string]: `${d.tilt}deg` } as CSSProperties}>
            <span className="doc-head"><i className="doc-avatar" /><i className="doc-bar short" /></span>
            {Array.from({ length: d.lines }, (_, n) => <i key={n} className="doc-bar" style={{ width: `${92 - n * 14}%` }} />)}
            <span className="doc-tick" style={{ animationDelay: `${d.delay + 6}s`, animationDuration: `${d.duration}s` }}><CheckCircle2 size={16} /></span>
          </div>
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
      <DocField />
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
