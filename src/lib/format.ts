import type { CandidateStatus, Stage } from "../types/api";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  // The API returns UTC timestamps; some (audit logs) have no zone marker.
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return date.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatTime(value: string): string {
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatYears(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return `${Number.isInteger(n) ? n : n.toFixed(1)} yrs`;
}

export function labelize(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const ACTION_LABEL: Record<string, string> = {
  parsing_completed: "File read",
  parsing_failed: "Couldn't read a file",
  extraction_completed: "Details extracted",
  extraction_failed: "Couldn't use a file",
  scraping_started: "Sourcing started",
  scraping_completed: "Source finished",
  scraping_partially_completed: "Source partly finished",
  scraping_failed: "Source found nothing",
  scoring_started: "Scoring started",
  scoring_finished: "Scoring finished",
  scoring_failed: "Scoring failed",
  shortlisting_created: "Shortlist ready",
  candidate_added_to_shortlist: "Added to shortlist",
  candidate_removed_from_shortlist: "Removed from shortlist",
  notes_updated: "Note updated",
  shortlist_shared: "Shared with hiring manager",
  candidate_approved: "Approved",
  candidate_rejected: "Rejected",
  interview_scheduled: "Interview scheduled",
  shortlist_returned: "Decisions sent to recruiter",
  shortlist_export_started: "Export started",
  shortlist_export_completed: "Downloaded",
  shortlist_export_failed: "Export failed",
};

/** Plain-language name for a logged action or step. */
export function describeAction(value: string | null | undefined): string {
  if (!value) return "—";
  return ACTION_LABEL[value] ?? labelize(value);
}

export const STATUS_TONE: Record<CandidateStatus, string> = {
  sourced: "",
  shortlisted: "blue",
  approved: "green",
  rejected: "red",
  interview_scheduled: "purple",
};

export const STAGE_TONE: Record<Stage, string> = {
  created: "",
  collecting: "blue",
  reading: "blue",
  scoring: "amber",
  shortlisted: "green",
  exported: "purple",
  partly_completed: "amber",
  failed: "red",
};

const AREA_LABEL: Record<string, string> = {
  extraction: "Reading files",
  scraping: "Sourcing",
  scoring: "Scoring",
  shortlisting: "Shortlisting",
  exporting: "Export",
  auth: "Sign-in",
};

/** Plain-language name for a log area (category). */
export function describeArea(value: string | null | undefined): string {
  if (!value) return "Job created";
  return AREA_LABEL[value] ?? labelize(value);
}

const DETAIL_LABEL: Record<string, string | null> = {
  files: "files", total: "total", saved: "saved", failed: "failed", skipped: "skipped",
  pool: "checked", matching: "matched the filters", scored: "scored", from_cache: "scored before",
  to_score: "to score", shortlisted: "shortlisted", embeddings_pending: "waiting to be added to search",
  embeddings: "search", pending: "waiting", resumes_at: "resumes at", source: "source", sources: "sources",
  errors: "problems", examples: "e.g.", rows: "rows", title: "job", top_k: "to shortlist", filters: "filters",
  hiring_manager: "hiring manager", shared: "shared", comment: "comment", notes: "note", note: "",
  approved: "approved", rejected: "rejected", interview_scheduled: "interviews", format: "format",
  scope: "which candidates", document_type: "file looks like", chars: "characters read", scanned: "scanned",
  // internal details nobody needs to read
  batch_id: null, run_id: null, finished: null, bytes: null, document_id: null, entry_id: null,
  candidate_id: null, hiring_manager_id: null, recruiters: null, step: null, input: null,
};

function detailValue(value: unknown): string {
  if (Array.isArray(value)) return value.map(detailValue).join(", ");
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== "" && !(Array.isArray(v) && !v.length))
      .map(([k, v]) => `${labelize(k)} ${detailValue(v)}`)
      .join(", ");
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

/** Turn logged details ({"pool": 4, "scored": 4} or "pool=4, scored=4") into a readable line. */
export function friendlyDetails(details: Record<string, unknown> | string | null | undefined): string {
  if (!details) return "";
  let obj: Record<string, unknown>;
  if (typeof details === "string") {
    try {
      const parsed = JSON.parse(details);
      if (!parsed || typeof parsed !== "object") return String(parsed);
      obj = parsed as Record<string, unknown>;
    } catch {
      if (!/^[a-z_]+=/.test(details)) return details;
      obj = Object.fromEntries(details.split(/, (?=[a-z_]+=)/).map((pair) => {
        const [k, ...rest] = pair.split("=");
        return [k, rest.join("=")];
      }));
    }
  } else {
    obj = details;
  }
  return Object.entries(obj)
    .filter(([k, v]) => DETAIL_LABEL[k] !== null && v !== null && v !== "" && v !== "[]" && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => {
      const label = DETAIL_LABEL[k] ?? labelize(k).toLowerCase();
      const value = detailValue(v);
      if (k === "seconds") return `took ${value}s`;
      if (!label) return value;
      // Counts read "4 scored"; everything else reads "source: github".
      return /^\d+(\.\d+)?$/.test(value) ? `${value} ${label}` : `${label}: ${value}`;
    })
    .join(" · ");
}
