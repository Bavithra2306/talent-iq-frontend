import { apiClient } from "../lib/axios";
import type {
  BatchStatus, Candidate, CandidateDetail, DirectoryUser, EmbeddingQuota, Job,
  JobExtractResponse, JobInput, LogEntry, Paged, ParsedFilter, ReviewEvent, ReviewFile, Role, RunStatus,
  ShortlistEntry, ShortlistFilters, ShortlistList, SourceInfo, UploadResponse, Weights,
} from "../types/api";

const v1 = "/api/v1";
type Params = Record<string, string | number | boolean | string[] | null | undefined>;

function clean(params: Params): Params {
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "" && v !== null && v !== undefined));
}

/** Download a file response (export, JD, resume) to the user's computer. */
export async function downloadFile(url: string, params: Params = {}, fallbackName = "download") {
  const response = await apiClient.get(url, { params: clean(params), responseType: "blob" });
  const disposition = String(response.headers["content-disposition"] ?? "");
  const match = disposition.match(/filename="?([^"]+)"?/);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(response.data as Blob);
  link.download = match?.[1] ?? fallbackName;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Open a PDF/DOCX from the API in a new tab (resumes, JDs). */
export async function openFile(url: string) {
  const response = await apiClient.get(url, { responseType: "blob" });
  window.open(URL.createObjectURL(response.data as Blob), "_blank", "noopener");
}

export const api = {
  // jobs
  listJobs: async (params: Params) => (await apiClient.get<Paged<Job>>(`${v1}/jobs`, { params: clean(params) })).data,
  getJob: async (id: string) => (await apiClient.get<Job>(`${v1}/jobs/${id}`)).data,
  extractJd: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await apiClient.post<JobExtractResponse>(`${v1}/jobs/extract`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    })).data;
  },
  createJob: async (body: JobInput, confirmDuplicate = false) =>
    (await apiClient.post<Job>(`${v1}/jobs`, body, { params: confirmDuplicate ? { confirm_duplicate: true } : {} })).data,
  deleteJob: async (id: string) => { await apiClient.delete(`${v1}/jobs/${id}`); },
  updateJob: async (id: string, body: Partial<JobInput>) => (await apiClient.patch<Job>(`${v1}/jobs/${id}`, body)).data,

  // resumes / candidates
  uploadResumes: async (files: File[], onProgress?: (pct: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f));
    return (await apiClient.post<UploadResponse>(`${v1}/resumes/upload`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    })).data;
  },
  failedCount: async () => (await apiClient.get<{ count: number }>(`${v1}/resumes/failed`)).data.count,
  retryFailed: async () => (await apiClient.post<UploadResponse>(`${v1}/resumes/retry-failed`)).data,
  reviewFiles: async () => (await apiClient.get<ReviewFile[]>(`${v1}/resumes/review`)).data,
  acceptReviewFile: async (documentId: string) =>
    (await apiClient.post<{ candidate_id: string; name: string | null; message: string }>(`${v1}/resumes/review/${documentId}/accept`)).data,
  deleteReviewFile: async (documentId: string) => { await apiClient.delete(`${v1}/resumes/review/${documentId}`); },
  batchStatus: async (id: string) => (await apiClient.get<BatchStatus>(`${v1}/resumes/batches/${id}`)).data,
  listCandidates: async (params: Params) =>
    (await apiClient.get<Paged<Candidate>>(`${v1}/candidates`, { params: clean(params) })).data,
  categories: async () => (await apiClient.get<{ category: string | null; count: number }[]>(`${v1}/candidates/categories`)).data,
  getCandidate: async (id: string) => (await apiClient.get<CandidateDetail>(`${v1}/candidates/${id}`)).data,
  embeddingQuota: async () => (await apiClient.get<EmbeddingQuota>(`${v1}/system/embedding-quota`)).data,

  // sourcing
  sources: async () => (await apiClient.get<SourceInfo[]>(`${v1}/sourcing/sources`)).data,
  startSourcing: async (sources: Record<string, unknown>[], keyword?: string) =>
    (await apiClient.post<{ batch_id: string }>(`${v1}/sourcing/runs`, { sources, keyword: keyword || null })).data,

  // matching / shortlist
  parseFilter: async (text: string) => (await apiClient.post<ParsedFilter>(`${v1}/shortlists/nl-filter`, { text })).data,
  startMatching: async (jobId: string) =>
    (await apiClient.post<{ run_id: string }>(`${v1}/jobs/${jobId}/match`)).data,
  shortlistTopK: async (jobId: string, topK: number, filters: ShortlistFilters, minScore: number | null) =>
    (await apiClient.post<{ shortlisted: number; matching: number }>(`${v1}/jobs/${jobId}/shortlist/top-k`,
      { top_k: topK, filters, min_score: minScore })).data,
  runStatus: async (id: string) => (await apiClient.get<RunStatus>(`${v1}/shortlists/runs/${id}`)).data,
  shortlist: async (jobId: string, params: Params) =>
    (await apiClient.get<ShortlistList>(`${v1}/jobs/${jobId}/shortlist`, {
      params: clean(params), paramsSerializer: { indexes: null }, // skills=a&skills=b
    })).data,
  allShortlists: async (params: Params) =>
    (await apiClient.get<ShortlistList>(`${v1}/shortlists`, { params: clean(params) })).data,
  saveWeights: async (jobId: string, w: Weights) =>
    (await apiClient.put<ShortlistList>(`${v1}/jobs/${jobId}/weights`, { ...w, total_pct: 100 })).data,
  setNotes: async (entryId: string, notes: string) =>
    (await apiClient.patch<ShortlistEntry>(`${v1}/shortlist-entries/${entryId}/notes`, { notes })).data,
  toggleShortlist: async (entryId: string, shortlisted: boolean) =>
    (await apiClient.post<ShortlistEntry>(`${v1}/shortlist-entries/${entryId}/shortlist`, { shortlisted })).data,
  share: async (jobId: string, hiringManagerId: string, note: string) =>
    (await apiClient.post<{ shared: number; skipped: { entry_id: string; reason: string }[] }>(
      `${v1}/jobs/${jobId}/shortlist/share`, { hiring_manager_id: hiringManagerId, note: note || null })).data,
  reviewHistory: async (jobId: string) => (await apiClient.get<ReviewEvent[]>(`${v1}/jobs/${jobId}/history`)).data,

  // hiring manager review
  sharedWithMe: async (params: Params) => (await apiClient.get<ShortlistEntry[]>(`${v1}/review`, { params: clean(params) })).data,
  decide: async (entryId: string, decision: "approved" | "rejected", comment: string) =>
    (await apiClient.post<ShortlistEntry>(`${v1}/review/${entryId}/decision`, { decision, comment: comment || null })).data,
  scheduleInterviews: async (jobId?: string) =>
    (await apiClient.post<{ scheduled: number }>(`${v1}/review/schedule-interviews`, { job_id: jobId || null })).data,

  // logs
  logs: async (params: Params) => (await apiClient.get<Paged<LogEntry>>(`${v1}/logs`, { params: clean(params) })).data,

  // auth service
  directory: async (role: Role) =>
    (await apiClient.get<DirectoryUser[]>(`${v1}/users/directory`, { params: { role } })).data,
  cancelInvite: async (userId: string) =>
    (await apiClient.delete<{ message: string }>(`${v1}/internal/invitations/${userId}`)).data,
  invite: async (email: string, role: "recruiter" | "hiring_manager") =>
    (await apiClient.post<{ message: string }>(`${v1}/internal/invitations`, { email, role })).data,
};

