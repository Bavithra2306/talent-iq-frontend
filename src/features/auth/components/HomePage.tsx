
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logout } from "../services/authService";

export default function HomePage() {
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    try {
      await logout();
    } catch (err: any) {
      // Don't silently pretend logout succeeded if the
      // backend couldn't revoke the session.
      setError(
        err.response?.data?.detail ||
          "Logout failed. Please try again.",
      );
      setLoggingOut(false);
      return;
    }

    navigate("/login", { replace: true });
  }

  return (
    <main className="dashboard-page">
      <h1>Welcome to TalentIQ</h1>
      <p>You have successfully logged in.</p>

      {error && <p role="alert">{error}</p>}

      <button onClick={handleLogout} disabled={loggingOut}>
        {loggingOut ? "Logging out..." : "Logout"}
      </button>
    </main>
  );
}
