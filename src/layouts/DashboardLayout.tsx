import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import {
  Briefcase, ClipboardCheck, Globe, LayoutDashboard, ListChecks, LogOut, ScrollText, UserCircle, UserPlus, Users,
  ArrowLeft,
} from "lucide-react";
import type { ComponentType } from "react";
import { ROLE_LABEL, useSession } from "../app/session";
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

export default function Layout() {
  const { user, logout } = useSession();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">T</div>
          <div className="brand-name">Talent<span>IQ</span></div>
        </div>
        <nav className="nav">
          {NAV.map(({ section, items }) => {
            const visible = items.filter((i) => i.roles.includes(user.role));
            if (!visible.length) return null;
            return (
              <div key={section}>
                <div className="nav-section">{section}</div>
                {visible.map(({ to, label, icon: Icon, end }) => (
                  <NavLink key={to} to={to} end={end}><Icon />{label}</NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-chip">
            <Link to="/profile" className="row" style={{ gap: 10, color: "inherit", minWidth: 0, flex: 1, textDecoration: "none" }} title="My profile">
              <div className="avatar">{initials(user.name, user.email[0]?.toUpperCase())}</div>
              <div className="who">
                <strong title={user.email}>{user.name || user.email}</strong>
                <span>{ROLE_LABEL[user.role]}</span>
              </div>
            </Link>
            <button className="btn btn-ghost btn-icon" style={{ color: "#ddd6fe", marginLeft: "auto" }}
                    onClick={() => void logout()} title="Log out" aria-label="Log out"><LogOut /></button>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="topbar"><BackButton /><ProfileMenu /></div>
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
