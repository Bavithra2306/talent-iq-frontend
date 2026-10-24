import type { Weights } from "../../types/api";

/** The four parts of a match score, in the order they are shown everywhere, with their default weights.
 *  The weights a job starts with, and what "Reset" returns to. A recruiter may change them per job. */
export const DEFAULT_WEIGHTS: Weights = { skill_pct: 40, exp_pct: 25, role_pct: 20, edu_pct: 15 };

export const SCORE_PARTS = [
  { part: "skills", weight: "skill_pct", label: "Skill match", short: "Skills", color: "#047857" },
  { part: "experience", weight: "exp_pct", label: "Experience", short: "Experience", color: "#34D399" },
  { part: "role", weight: "role_pct", label: "Role and industry fit", short: "Role fit", color: "#D4A017" },
  { part: "education", weight: "edu_pct", label: "Education", short: "Education", color: "#92400E" },
] as const;
