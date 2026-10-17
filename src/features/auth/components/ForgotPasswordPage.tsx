
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { forgotPassword } from "../services/authService";

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

      setMessage(response.message || "OTP request submitted successfully.");
      navigate("/reset-password", { state: { email: email.trim() } });
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "Unable to request OTP. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-container">
      <section className="auth-card">
        <h1>Forgot Password</h1>
        <p>Enter your registered email to request a password reset OTP.</p>

        {message && <p role="status">{message}</p>}
        {error && <p role="alert">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Requesting OTP..." : "Send OTP"}
          </button>
        </form>

        <p>
          Remember your password? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
