
import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { adminLogin, login } from "../services/authService";
import AuthLayout from "../../../layouts/AuthLayout";

/** Sign-in page. With `admin`, it is the admin sign-in (only admins are accepted there). */
export default function LoginPage({ admin = false }: { admin?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const successMessage = location.state?.message as string | undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const signIn = admin ? adminLogin : login;
      await signIn({
        email: email.trim(),
        password,
      });

      // Login succeeded. Authentication cookies are handled by the browser.
      navigate("/", { replace: true });
    } catch (err: any) {
      const status = err.response?.status;

      if (status === 403) {
        setError(err.response?.data?.detail || "This sign-in page isn't for your account.");
      } else if (status === 401 || status === 400) {
        setError("That email and password don't match. Please try again.");
      } else {
        setError(
          err.response?.data?.detail ||
            "We couldn't sign you in right now. Please try again.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      {admin && <span className="badge brand plain" style={{ justifySelf: "start" }}>Admin</span>}
      <h1>{admin ? "Admin sign in" : "Welcome back"}</h1>
      <p className="auth-sub">{admin ? "Manage your team and see all activity." : "Sign in to continue to TalentIQ."}</p>

      {successMessage && <div className="alert success" role="status">{successMessage}</div>}
      {error && <div className="alert error" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="input"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@company.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="field">
          <div className="spread">
            <label htmlFor="password">Password</label>
            <Link to="/forgot-password" className="small">Forgot password?</Link>
          </div>
          <div className="password-field">
            <input
              id="password"
              className="input"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
            <button type="button" className="visibility-button" aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {admin ? (
        <p className="auth-note">Recruiter or hiring manager? <Link to="/login">Sign in here</Link></p>
      ) : (
        <p className="auth-note">New here? Ask your admin to send you an invitation. · <Link to="/internal">Admin sign in</Link></p>
      )}
    </AuthLayout>
  );
}
