
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { login } from "../services/authService";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const successMessage = location.state?.message as string | undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await login({
        email: email.trim(),
        password,
      });

      // Login succeeded. Authentication cookies are handled by the browser.
      navigate("/", { replace: true });
    } catch (err: any) {
      const status = err.response?.status;

      if (status === 401 || status === 400) {
        setError("Email or password is incorrect.");
      } else {
        setError(
          err.response?.data?.detail ||
            "Unable to log in right now. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1>Welcome to TalentIQ</h1>
        <p>Sign in to your account</p>

        {successMessage && (
          <p role="status">{successMessage}</p>
        )}

        {error && (
          <p role="alert">{error}</p>
        )}

        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          autoComplete="email"
          required
        />

        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />

        <div className="forgot-password-link">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>
      </form>
    </main>
  );
}
