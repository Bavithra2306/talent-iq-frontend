import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resetPassword } from "../services/authService";
import AuthLayout from "../../../layouts/AuthLayout";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const [email, setEmail] = useState(
    location.state?.email ?? "",
  );
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }

    setLoading(true);

    try {
      const response = await resetPassword({
        email: email.trim(),
        otp: otp.trim(),
        new_password: newPassword,
      });

      setMessage(response.message || "Your password has been changed.");
      navigate("/login", {
        state: { message: response.message || "Your password has been changed. You can sign in now." },
      });
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
          "We couldn't change your password. Check the code and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Set a new password</h1>
      <p className="auth-sub">Enter the code we emailed you and choose a new password.</p>

      {message && <div className="alert success" role="status">{message}</div>}
      {error && <div className="alert error" role="alert">{error}</div>}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" value={email}
                 onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </div>

        <div className="field">
          <label htmlFor="otp">Code from the email</label>
          <input id="otp" className="input" type="text" value={otp} onChange={(event) => setOtp(event.target.value)}
                 placeholder="e.g. 123456" autoComplete="one-time-code" inputMode="numeric" required />
        </div>

        <div className="field">
          <label htmlFor="newPassword">New password</label>
          <input id="newPassword" className="input" type="password" value={newPassword}
                 onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters"
                 autoComplete="new-password" required />
        </div>

        <div className="field">
          <label htmlFor="confirmPassword">Type it again</label>
          <input id="confirmPassword" className="input" type="password" value={confirmPassword}
                 onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required />
        </div>

        <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>

      <p className="auth-note">
        <Link to="/login">Back to sign in</Link>
      </p>
    </AuthLayout>
  );
}
