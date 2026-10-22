import { Check, X } from "lucide-react";
import { PASSWORD_RULES } from "../../../utils/password";

/** Live checklist under a new-password field: each rule turns green when met. */
export default function PasswordRules({ password, confirm }: { password: string; confirm?: string }) {
  const rows = [
    ...PASSWORD_RULES.map((r) => ({ label: r.label, ok: r.ok(password) })),
    ...(confirm !== undefined ? [{ label: "Both passwords match", ok: password.length > 0 && password === confirm }] : []),
  ];
  return (
    <ul className="password-rules" aria-live="polite">
      {rows.map((r) => (
        <li key={r.label} className={r.ok ? "ok" : ""}>
          {r.ok ? <Check size={14} /> : <X size={14} />} {r.label}
        </li>
      ))}
    </ul>
  );
}
