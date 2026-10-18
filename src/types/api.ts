// Shapes of the core service's API responses (see talent-iq-core/src/schema).

export type Role = "admin" | "hiring_manager" | "recruiter";
export type JobStatus = "open" | "closed";
export type CandidateStatus = "sourced" | "shortlisted" | "approved" | "rejected" | "interview_scheduled";
export type Stage =
  | "created" | "collecting" | "reading" | "scoring" | "shortlisted" | "exported"
  | "partly_completed" | "failed";

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface Job {
  id: string;
  jd_id: string;
  title: string;
  category: string | null;
  industry: string | null;
  experience_years: number | null;
  education: string | null;
  location: string | null;
  work_mode: string | null;
  status: JobStatus;
  skills: string[] | null;
  nice_to_have_skills: string[] | null;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
}

export interface JobDraft {
  title: string | null;
  category: string | null;
  industry: string | null;
  experience_years: number | null;
  education: string | null;
  location: string | null;
  work_mode: string | null;
  skills: string[];
  nice_to_have_skills: string[];
}

export interface JobExtractResponse {
  document_id: string;
  draft: JobDraft;
  existing_job_id: string | null;
  warnings: string[];
}

export interface JobInput {
  title: string;
  category: string | null;
  industry: string | null;
  experience_years: number | null;
  education: string | null;
  location: string | null;
  work_mode: string | null;
  status?: JobStatus;
  skills: string[];
  nice_to_have_skills: string[];
  jd_id?: string | null;
}

export interface Candidate {
  id: string;
  name: string | null;
  email: string | null;
  contact: string | null;
  location: string | null;
  current_title: string | null;
  category: string | null;
  status: CandidateStatus | null;
  total_years_experience: string | number | null;
  current_resume_id: string;
  skills: string[];
  source_site: string | null;
  created_at: string;
  /** Status per job; empty = "New" (not matched to any job yet). */
  job_statuses: { job_id: string; job_title: string; status: CandidateStatus; total_score: number | null }[];
}

export interface CandidateDetail extends Candidate {
  education: { degree: string; institution: string | null; year: string | null }[] | null;
  roles_and_years: { title: string; company: string | null; years: number | null }[] | null;
  extraction_model: string | null;
  file_name: string | null;
}

export interface UploadResponse {
  batch_id: string | null;
  accepted: { document_id: string; filename: string }[];
  rejected: { filename: string; reason: string }[];
}

export interface PipelineEvent {
  at: string;
  stage: Stage | null;
  action: string | null;
  detail: string | null;
}

export interface BatchStatus {
  batch_id: string;
  stage: Stage;
  finished: boolean;
  total: number | null;
  saved: number | null;
  failed: number | null;
  seconds: number | null;
  embeddings_pending: number | null;
  embeddings_note: string | null;
  failures: { filename: string; reason: string }[];
  events: PipelineEvent[];
}

export interface Weights {
  skill_pct: number;
  role_pct: number;
  exp_pct: number;
  edu_pct: number;
}

export interface ShortlistFilters {
  category?: string | null;
  location?: string | null;
  min_experience?: number | null;
  max_experience?: number | null;
  education?: string | null;
  must_have_skills?: string[];
}

export interface SkillMatch {
  jd_skill: string;
  level: number;
  matched: string | null;
}

export interface Explanation {
  cosine?: { skills: number | null; role: number | null };
  skills?: { required: SkillMatch[]; nice: SkillMatch[]; required_avg: number | null; nice_avg: number | null };
  role?: { level: number; matched_role: string | null };
  experience?: { candidate_years: number | null; required_years: number | null; score: number; note: string };
  education?: { required: string | null; score: number; note: string };
  summary?: string | null;
  strengths?: string[];
  gaps?: string[];
  stale?: boolean;
}

export interface BreakdownPart {
  score: number;
  weight: number;
  points: number;
}

export interface ShortlistEntry {
  id: string;
  job_id: string;
  job_title: string | null;
  candidate_id: string;
  resume_id: string | null;
  name: string | null;
  email: string | null;
  contact: string | null;
  location: string | null;
  current_title: string | null;
  category: string | null;
  total_years_experience: number | null;
  skills: string[];
  status: CandidateStatus;
  rank: number | null;
  total_score: number | null;
  scores: { skills: number | null; role: number | null; experience: number | null; education: number | null };
  breakdown: Record<"skills" | "role" | "experience" | "education", BreakdownPart> | null;
  explanation: Explanation | null;
  notes_by_recruiter: string | null;
  shared_by: string | null;
  shared_to: string | null;
  created_at: string;
}

export interface ShortlistList {
  items: ShortlistEntry[];
  total: number;
  weights: Weights;
}

export interface RunStatus {
  run_id: string;
  job_id: string | null;
  stage: Stage;
  finished: boolean;
  pool: number | null;
  scored: number | null;
  from_cache: number | null;
  shortlisted: number | null;
  failed: number | null;
  seconds: number | null;
  events: PipelineEvent[];
}

export interface ParsedFilter {
  original_text: string;
  corrected_text: string;
  filters: ShortlistFilters;
  top_k: number | null;
}

export interface LogEntry {
  id: string;
  at: string;
  user_id: string | null;
  job_id: string | null;
  stage: Stage | null;
  category: string | null;
  action: string | null;
  input_data: string | null;
  output_data: string | null;
  duration_ms: number | null;
}

export interface ReviewEvent {
  at: string;
  action: string;
  user_id: string | null;
  detail: Record<string, unknown> | string | null;
}

export interface DirectoryUser {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  status: "invite_sent" | "accepted" | "active";
}

export interface SourceInfo {
  type: "huggingface" | "kaggle" | "github" | "stackexchange" | "url";
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  configured: boolean;
  needs: string | null;
  limits: string;
  terms: string;
  example: Record<string, unknown>;
}

export interface EmbeddingQuota {
  daily_limit: number;
  used_today: number;
  remaining_today: number;
  paused: boolean;
  resumes_at: string;
  resumes_waiting: number;
}
