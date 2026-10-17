import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../services/authService";
import AuthLayout from "./AuthLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await forgotPassword({
        email: email.trim(),
      });

      setMessage(response.message || "We've sent a code to your email.");
      navigate("/reset-password", { state: { email: email.trim() } });
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "We couldn't send the code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Forgot your password?</h1>
      <p className="auth-sub">Enter your email and we'll send you a code to set a new one.</p>

      {message && <div className="alert success" role="status">{message}</div>}
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

        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? "Sending code…" : "Send me a code"}
        </button>
      </form>

      <p className="auth-note">
        Remembered it? <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
