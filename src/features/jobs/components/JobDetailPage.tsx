import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ListChecks, Pencil } from "lucide-react";
import { useSession } from "../../../app/session";
import { Alert, Loading, PageHeader, useToast } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime } from "../../../utils/format";
import type { JobInput } from "../../../types/api";
import JobForm, { EMPTY_JOB } from "./JobForm";

export default function JobDetailPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const job = useQuery({ queryKey: ["job", id], queryFn: () => api.getJob(id) });

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
            <button className="btn" onClick={() => void openFile(`/api/v1/jobs/${id}/view`)}><Download /> View JD</button>
            {!editing && <button className="btn" onClick={() => setEditing(true)}><Pencil /> Edit</button>}
            {user.role === "recruiter" && (
              <Link className="btn btn-primary" to={`/jobs/${id}/shortlist`}><ListChecks /> Find candidates</Link>
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
        <div className="grid grid-2">
          <div className="card card-pad">
            <h3 style={{ marginBottom: 14 }}>Details</h3>
            <dl className="kv">
              <dt>Category</dt><dd>{j.category ?? "—"}</dd>
              <dt>Industry</dt><dd>{j.industry ?? "—"}</dd>
              <dt>Experience</dt><dd>{j.experience_years !== null ? `${j.experience_years}+ years` : "—"}</dd>
              <dt>Education</dt><dd>{j.education ?? "—"}</dd>
              <dt>Location</dt><dd>{j.location ?? "—"}</dd>
              <dt>Work mode</dt><dd>{j.work_mode ?? "—"}</dd>
              <dt>Created</dt><dd>{formatDateTime(j.created_at)}</dd>
            </dl>
          </div>
          <div className="card card-pad stack">
            <div>
              <h3 style={{ marginBottom: 10 }}>Required skills</h3>
              <div className="chips">{(j.skills ?? []).map((s) => <span key={s} className="tag">{s}</span>)}</div>
              {!j.skills?.length && <p className="muted">None yet — add skills so candidates can be checked.</p>}
            </div>
            <div>
              <h3 style={{ marginBottom: 10 }}>Nice-to-have</h3>
              <div className="chips">{(j.nice_to_have_skills ?? []).map((s) => <span key={s} className="tag gray">{s}</span>)}</div>
              {!j.nice_to_have_skills?.length && <p className="muted">None.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
