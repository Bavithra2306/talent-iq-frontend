import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { useSession } from "../../../app/session";
import { Alert, Loading, PageHeader, useToast } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime } from "../../../utils/format";
import type { JobInput, Weights } from "../../../types/api";
import JobCandidates from "./JobCandidates";
import JobDecisions from "./JobDecisions";
import JobMatching, { MatchProgress } from "./JobMatching";
import { useMatching } from "../useMatching";
import JobForm, { EMPTY_JOB } from "./JobForm";

export default function JobDetailPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [previewWeights, setPreviewWeights] = useState<Weights | null>(null); // unsaved weights shown live in the candidates table
  const job = useQuery({ queryKey: ["job", id], queryFn: () => api.getJob(id) });
  const matching = useMatching(id);

  const navigate = useNavigate();
  const remove = useMutation({
    mutationFn: () => api.deleteJob(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      void queryClient.invalidateQueries({ queryKey: ["shortlist"] });
      toast("Job deleted.", "success");
      navigate("/jobs");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const save = useMutation({
    mutationFn: (body: JobInput) => api.updateJob(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(["job", id], updated);
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      setEditing(false);
      toast("Job updated.", "success");
    },
  });

  if (job.isLoading) return <Loading />;
  if (job.isError || !job.data) return <Alert tone="error">{errorMessage(job.error, "Job not found.")}</Alert>;
  const j = job.data;

  return (
    <>
      <PageHeader
        crumb={<Link to="/jobs">Jobs</Link>}
        title={<>{j.title} <span className={`badge ${j.status === "open" ? "green" : ""}`} style={{ verticalAlign: 4 }}>{j.status}</span></>}
        subtitle={[j.category, j.location, j.work_mode].filter(Boolean).join(" · ") || undefined}
        actions={
          <>
            <button className="btn" onClick={() => void openFile(`/api/v1/jobs/${id}/view`)}>View job description</button>
            {!editing && <button className="btn" onClick={() => setEditing(true)}><Pencil /> Edit</button>}
            {!editing && (
              <button className="btn btn-danger" disabled={remove.isPending}
                      onClick={() => { if (window.confirm(`Delete the job "${j.title}"? It disappears from the app, including its matches and shortlist.`)) remove.mutate(); }}>
                <Trash2 /> Delete
              </button>
            )}
            {user.role === "recruiter" && (
              <button className="btn btn-primary" disabled={matching.running || !j.skills?.length}
                      title={j.skills?.length ? "Score the resumes for this job" : "Add required skills to the job first"}
                      onClick={() => { matching.start(); document.getElementById("matching")?.scrollIntoView({ behavior: "smooth" }); }}>
                <ListChecks /> {matching.running ? "Matching…" : "Start matching"}
              </button>
            )}
          </>
        }
      />

      {editing ? (
        <div className="card">
          <div className="card-header"><h2>Edit job</h2></div>
          <div className="card-body stack">
            {save.isError && <Alert tone="error">{errorMessage(save.error)}</Alert>}
            <JobForm
              initial={{ ...EMPTY_JOB, ...j, skills: j.skills ?? [], nice_to_have_skills: j.nice_to_have_skills ?? [] }}
              submitLabel="Save changes" showStatus busy={save.isPending}
              onSubmit={(body) => save.mutate(body)} onCancel={() => setEditing(false)}
            />
          </div>
        </div>
      ) : (
        <div className={user.role === "recruiter" ? "jd-top" : undefined}>
        <div className="card jd-compact">
          <dl className="jd-facts">
            {([
              ["Role", j.role_name], ["Category", j.category], ["Industry", j.industry],
              ["Experience", j.experience_years !== null ? `${j.experience_years}+ years` : null],
              ["Education", j.education], ["Location", j.location], ["Work mode", j.work_mode], ["Created", formatDateTime(j.created_at)],
            ] as const).map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>
            ))}
          </dl>
          <div className="jd-skills">
            <span className="jd-skills-label">Required skills</span>
            <div className="chips">{(j.skills ?? []).map((s) => <span key={s} className="tag">{s}</span>)}</div>
            {!j.skills?.length && <span className="muted small">None yet — add skills so candidates can be checked.</span>}
          </div>
          <div className="jd-skills">
            <span className="jd-skills-label">Nice-to-have</span>
            <div className="chips">{(j.nice_to_have_skills ?? []).map((s) => <span key={s} className="tag gray">{s}</span>)}</div>
            {!j.nice_to_have_skills?.length && <span className="muted small">None.</span>}
          </div>
        </div>
        {user.role === "recruiter" && <JobMatching job={j} onPreview={setPreviewWeights} />}
        </div>
      )}

      {!editing && user.role === "hiring_manager" && id && <JobDecisions jobId={id} />}

      {!editing && user.role === "recruiter" && id && (
        <div id="matching">
          <MatchProgress job={j} matching={matching} />
          <JobCandidates jobId={id} previewWeights={previewWeights} />
        </div>
      )}
    </>
  );
}
