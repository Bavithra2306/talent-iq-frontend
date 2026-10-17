
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useAcceptInvitation } from "../queries/authQueries";

export default function AcceptInvitationPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [token] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const invitationToken = params.get("token")?.trim() ?? "";

    // Remove the sensitive token from the visible URL after reading it.
    window.history.replaceState({}, "", window.location.pathname);

    return invitationToken;
  });
  const [validationError, setValidationError] = useState("");

  const invitationMutation = useAcceptInvitation();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");

    if (!token) {
      setValidationError(
        "The invitation link is missing its token. Please use the link from your invitation email.",
      );
      return;
    }

    if (password.length < 8) {
      setValidationError("Your password must contain at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setValidationError("The passwords do not match.");
      return;
    }

    invitationMutation.mutate({
      token,
      password,
      confirm_password: confirmPassword,
    });
  }

  if (invitationMutation.isSuccess) {
    return (
      <main className="invite-page">
        <section className="invite-card invite-result">
          <div className="invite-icon success-icon">
            <ShieldCheck size={30} />
          </div>
          <h1>You're all set!</h1>
          <p>
            {invitationMutation.data.message ||
              "Your password has been set successfully."}
          </p>
          <p className="muted-text">
            You can now continue to the TalentIQ login page.
          </p>
          <a className="primary-button link-button" href="/login">
            Continue to login
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="invite-page">
      <section className="invite-card">
        <div className="brand-mark">T</div>
        <p className="eyebrow">TALENTIQ</p>
        <h1>Set up your account</h1>
        <p className="subtitle">
          Welcome to TalentIQ. Create a password to activate your account
          setup.
        </p>

        <form onSubmit={handleSubmit} className="invite-form">
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              required
            />
            <button
              type="button"
              className="visibility-button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <label htmlFor="confirmPassword">Confirm password</label>
          <div className="password-field">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Enter your password again"
              required
            />
            <button
              type="button"
              className="visibility-button"
              aria-label={
                showConfirmPassword
                  ? "Hide confirm password"
                  : "Show confirm password"
              }
              onClick={() =>
                setShowConfirmPassword((visible) => !visible)
              }
            >
              {showConfirmPassword ? (
                <EyeOff size={18} />
              ) : (
                <Eye size={18} />
              )}
            </button>
          </div>

          {!token && (
             <p className="form-error" role="alert">
                No invitation token found. Please open the invitation link sent to your email.
            </p>
            )}

          {(validationError || invitationMutation.isError) && (
            <p className="form-error" role="alert">
              {validationError ||
                (invitationMutation.error instanceof Error
                  ? invitationMutation.error.message
                  : "We couldn't accept this invitation. Please try again.")}
            </p>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={invitationMutation.isPending}          >
            {invitationMutation.isPending
              ? "Setting up your account..."
              : "Set password"}
          </button>
        </form>

        <p className="security-note">
          <ShieldCheck size={16} />
          Your password is sent securely to the TalentIQ authentication API.
        </p>
      </section>
    </main>
  );
}
