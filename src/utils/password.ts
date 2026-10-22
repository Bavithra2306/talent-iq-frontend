/** The rule for new passwords; the auth service checks the same rule. */
export const PASSWORD_RULES = [
  { label: "At least 8 characters", ok: (p: string) => p.length >= 8 },
  { label: "At least one symbol, e.g. ! @ # $ %", ok: (p: string) => /[^A-Za-z0-9\s]/.test(p) },
  { label: "No spaces at the start or end", ok: (p: string) => p.length > 0 && p === p.trim() },
];

/** First broken rule as a sentence, or "" when the password is acceptable. */
export function passwordError(password: string, confirm?: string): string {
  const broken = PASSWORD_RULES.find((r) => !r.ok(password));
  if (broken) return `Password needs: ${broken.label.toLowerCase()}.`;
  if (confirm !== undefined && password !== confirm) return "The two passwords don't match.";
  return "";
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
