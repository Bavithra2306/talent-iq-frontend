import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getCurrentUser, logout as logoutRequest, type CurrentUser } from "../features/auth/services/authService";
import { api } from "../lib/api";
import type { Role } from "../types/api";

export interface SessionUser extends CurrentUser {
  role: Role;
}

interface SessionValue {
  user: SessionUser;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>.");
  return value;
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  hiring_manager: "Hiring manager",
  recruiter: "Recruiter",
};

/** Loads the signed-in user (name from auth, role from core). Expired access tokens are
 *  refreshed by the axios interceptor; with no valid session the user goes to /login. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "anonymous" | "error">("loading");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [profile, me] = await Promise.all([getCurrentUser(), api.me()]);
        if (mounted) {
          setUser({ ...profile, role: me.role });
          setState("ready");
        }
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (mounted) setState(status === 401 || status === 403 ? "anonymous" : "error");
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    try {
      await logoutRequest();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  if (state === "loading") {
    return <div className="loading" style={{ minHeight: "100vh" }}><span className="spinner" /> Checking your session…</div>;
  }
  if (state === "anonymous" || !user) {
    if (state === "error") {
      return (
        <div className="loading" style={{ minHeight: "100vh", flexDirection: "column" }}>
          <p>We couldn't verify your session. Check that the services are running.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      );
    }
    return <Navigate to="/login" replace />;
  }
  return <SessionContext.Provider value={{ user, logout }}>{children}</SessionContext.Provider>;
}

/** Shows children only to the given roles; others are sent to the dashboard. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useSession();
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
