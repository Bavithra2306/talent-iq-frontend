import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase, ClipboardCheck, Globe, LayoutDashboard, ListChecks, LogOut, PanelLeftClose, PanelLeftOpen, ScrollText, UserCircle, UserPlus, Users,
  ArrowLeft,
} from "lucide-react";
import type { ComponentType } from "react";
import { ROLE_LABEL, useSession } from "../app/session";
import { LogoMark } from "../components/Logo";
import { initials } from "../utils/format";
import type { Role } from "../types/api";

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType;
  roles: Role[];
  end?: boolean;
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "recruiter", "hiring_manager"], end: true }],
  },
  {
    section: "Hiring",
    items: [
      { to: "/jobs", label: "Jobs", icon: Briefcase, roles: ["recruiter", "hiring_manager"] },
      { to: "/resumes", label: "Resumes", icon: Users, roles: ["recruiter"] },
      { to: "/sourcing", label: "Sourcing", icon: Globe, roles: ["recruiter"] },
      { to: "/shortlists", label: "Shortlists", icon: ListChecks, roles: ["recruiter"] },
      { to: "/review", label: "Review", icon: ClipboardCheck, roles: ["hiring_manager"] },
    ],
  },
  {
    section: "Admin",
    items: [
      { to: "/team", label: "Team", icon: UserPlus, roles: ["admin"] },
      { to: "/logs", label: "Activity log", icon: ScrollText, roles: ["admin", "recruiter"] },
    ],
  },
];

const SIDEBAR_KEY = "talentiq.sidebar";
const readCollapsed = () => { try { return localStorage.getItem(SIDEBAR_KEY) === "collapsed"; } catch { return false; } };

export default function Layout() {
  const { user } = useSession();
  // The sidebar can shrink to an icon rail (more room for the page) and open again; the choice is remembered.
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem(SIDEBAR_KEY, next ? "collapsed" : "open"); } catch { /* storage unavailable */ }
    return next;
  });
  return (
    <div className={`shell ${collapsed ? "collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <NavLink to="/" end className="sidebar-brand" aria-label="TalentIQ home">
            <LogoMark size={34} animated />
            <div className="brand-name">Talent<span>IQ</span></div>
          </NavLink>
          <button className="sidebar-toggle" onClick={toggle} aria-expanded={!collapsed} data-tip={collapsed ? "Expand menu" : "Minimize menu"}
                  aria-label={collapsed ? "Expand the menu" : "Minimize the menu"}>
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>
        <nav className="nav">
          {NAV.map(({ section, items }) => {
            const visible = items.filter((i) => i.roles.includes(user.role));
            if (!visible.length) return null;
            return (
              <div key={section}>
                <div className="nav-section">{section}</div>
                {visible.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end} data-tip={label} aria-label={collapsed ? label : undefined}><Icon /><span className="nav-label">{label}</span></NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-bottom"><ProfileMenu /></div>
      </aside>
      <main className="main">
        <div className="topbar"><BackButton /></div>
        <Outlet />
      </main>
    </div>
  );
}

/** Goes back to the previous screen; when there is none (page opened directly), to the parent page. */
function BackButton() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  if (pathname === "/") return null;
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(pathname.split("/").slice(0, -1).join("/") || "/");
  };
  return (
    <button className="btn btn-ghost btn-sm back-btn" onClick={goBack}><ArrowLeft /> Back</button>
  );
}

function ProfileMenu() {
  const { user, logout } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return (
    <div className="profile-menu" ref={box}>
      <button className="profile-button" onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title="Your profile">
        <span className="avatar">{initials(user.name, user.email[0]?.toUpperCase())}</span>
        <span className="profile-who"><strong>{user.name || user.email}</strong><small>{ROLE_LABEL[user.role]}</small></span>
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head">
            <strong>{user.name || "Your account"}</strong>
            <span>{user.email}</span>
            <span className="badge brand plain" style={{ marginTop: 6 }}>{ROLE_LABEL[user.role]}</span>
          </div>
          <button role="menuitem" onClick={() => { setOpen(false); navigate("/profile"); }}><UserCircle /> My profile</button>
          <button role="menuitem" onClick={() => void logout()}><LogOut /> Sign out</button>
        </div>
      )}
    </div>
  );
}
