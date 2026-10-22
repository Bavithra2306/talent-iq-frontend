
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Splash } from "../../../components/Logo";
import {
  getCurrentUser,
  refreshAccessToken,
  type CurrentUser,
} from "../services/authService";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({
  children,
}: ProtectedRouteProps) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        const currentUser = await getCurrentUser();

        if (mounted) setUser(currentUser);
      } catch (err: any) {
        if (err.response?.status === 401) {
          try {
            await refreshAccessToken();
            const currentUser = await getCurrentUser();

            if (mounted) setUser(currentUser);
          } catch {
            if (mounted) setUser(null);
          }
        } else {
          if (mounted) {
            setError(
              "Unable to verify your session. Please try again.",
            );
          }
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <Splash message="Checking your session…" />;
  }

  if (error) {
    return (
      <main>
        <p role="alert">{error}</p>
        <button onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
