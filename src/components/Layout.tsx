import { NavLink, Outlet } from "react-router-dom";
import {
  Briefcase, ClipboardCheck, Globe, LayoutDashboard, ListChecks, LogOut, ScrollText, UserPlus, Users,
} from "lucide-react";
import type { ComponentType } from "react";
import { ROLE_LABEL, useSession } from "../app/session";
import { initials } from "../lib/format";
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
      { to: "/candidates", label: "Candidates", icon: Users, roles: ["recruiter"] },
      { to: "/sourcing", label: "Sourcing", icon: Globe, roles: ["recruiter"] },
      { to: "/shortlists", label: "Shortlists", icon: ListChecks, roles: ["recruiter"] },
      { to: "/review", label: "Review", icon: ClipboardCheck, roles: ["hiring_manager"] },
    ],
  },
  {
    section: "Admin",
    items: [
      { to: "/team", label: "Team", icon: UserPlus, roles: ["admin"] },
      { to: "/logs", label: "Activity log", icon: ScrollText, roles: ["admin", "recruiter", "hiring_manager"] },
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
            <div className="avatar">{initials(user.name, user.email[0]?.toUpperCase())}</div>
            <div className="who">
              <strong title={user.email}>{user.name || user.email}</strong>
              <span>{ROLE_LABEL[user.role]}</span>
            </div>
            <button className="btn btn-ghost btn-icon" style={{ color: "#ddd6fe", marginLeft: "auto" }}
                    onClick={() => void logout()} title="Log out" aria-label="Log out"><LogOut /></button>
          </div>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  );
}
