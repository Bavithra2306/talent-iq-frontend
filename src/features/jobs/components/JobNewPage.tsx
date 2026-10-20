import { useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, PenLine, Sparkles } from "lucide-react";
import { Alert, FileDrop, PageHeader, useToast } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { MAX_JD_MB } from "../../../config/constants";
import type { JobExtractResponse, JobInput } from "../../../types/api";
import JobForm, { EMPTY_JOB } from "./JobForm";

export default function JobNewPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"upload" | "form">("upload");
  const [tooBig, setTooBig] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<JobExtractResponse | null>(null);

  const extract = useMutation({ mutationFn: (file: File) => api.extractJd(file), onSuccess: setExtracted });
  const create = useMutation({
    mutationFn: async (job: JobInput) => {
      try {
        return await api.createJob(job);
      } catch (err) {
        // Same title and category as an existing job: ask before saving a second one.
        const data = axios.isAxiosError(err) ? (err.response?.data as { code?: string; detail?: string } | undefined) : undefined;
        if (data?.code === "duplicate_job" && window.confirm(data.detail ?? "A job with this name already exists. Save anyway?")) {
          return await api.createJob(job, true);
        }
        throw err;
      }
    },
    onSuccess: (job) => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast("Job saved.", "success");
      navigate(`/jobs/${job.id}`);
    },
  });

  const draftAsInput: JobInput | null = extracted && {
    ...EMPTY_JOB,
    ...extracted.draft,
    title: extracted.draft.title ?? "",
    jd_id: extracted.document_id,
  };

  return (
    <>
      <PageHeader title="New job" crumb={<Link to="/jobs">Jobs</Link>}
                  subtitle="Upload a job description or type the job in." />
      <div className="tabs">
        <button className={`tab ${mode === "upload" ? "active" : ""}`} onClick={() => setMode("upload")}>
          <FileText size={15} style={{ verticalAlign: -2 }} /> Upload job description
        </button>
        <button className={`tab ${mode === "form" ? "active" : ""}`} onClick={() => setMode("form")}>
          <PenLine size={15} style={{ verticalAlign: -2 }} /> Type it in
        </button>
      </div>

      {create.isError && <div style={{ marginBottom: 16 }}><Alert tone="error">{errorMessage(create.error)}</Alert></div>}

      {mode === "upload" && !extracted && (
        <div className="card card-pad stack">
          <FileDrop onFiles={(files) => {
            const file = files[0];
            if (!file) return;
            if (file.size > MAX_JD_MB * 1024 * 1024) { setTooBig(file.name); return; }
            setTooBig(null);
            extract.mutate(file);
          }}
                    hint="PDF, Word, scanned PDF or a photo (JPG, PNG). Up to 10 MB." />
          {tooBig && <Alert tone="error">{tooBig} is larger than {MAX_JD_MB} MB. Please choose a smaller file.</Alert>}
          {extract.isPending && <Alert><span className="spinner" /> Reading the job description and filling in the fields… (5–30 s)</Alert>}
          {extract.isError && <Alert tone="error">{errorMessage(extract.error)}</Alert>}
        </div>
      )}

      {mode === "upload" && extracted && draftAsInput && (
        <div className="card">
          <div className="card-header">
            <div>
              <h2><Sparkles size={17} style={{ verticalAlign: -2, color: "var(--brand-600)" }} /> Review the extracted fields</h2>
              <p>Check these details, correct anything that is wrong, then save.</p>
            </div>
            <button className="btn btn-sm" onClick={() => setExtracted(null)}>Upload another</button>
          </div>
          <div className="card-body stack">
            {extracted.warnings.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
            {extracted.existing_job_id ? (
              <Alert tone="warn">
                This job description was uploaded before and is already used by a job, so it can't be saved again.{" "}
                <Link to={`/jobs/${extracted.existing_job_id}`}>Open that job</Link>.
              </Alert>
            ) : (
              <JobForm key={extracted.document_id} initial={draftAsInput} submitLabel="Save job"
                       busy={create.isPending} onSubmit={(job) => create.mutate({ ...job, jd_id: extracted.document_id })} />
            )}
          </div>
        </div>
      )}

      {mode === "form" && (
        <div className="card">
          <div className="card-header"><div><h2>Job details</h2><p>A PDF of the job description is made from these fields.</p></div></div>
          <div className="card-body">
            <JobForm initial={EMPTY_JOB} submitLabel="Create job" busy={create.isPending}
                     onSubmit={(job) => create.mutate({ ...job, jd_id: null })} />
          </div>
        </div>
      )}
    </>
  );
}
