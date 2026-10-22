import { useNavigate } from "react-router-dom";
import { Briefcase, FileText, GraduationCap, MapPin, Play, Rocket, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { openFile } from "../../../services/api";
import type { Job } from "../../../types/api";

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="fact">
      <span className="fact-icon">{icon}</span>
      <span><span className="muted small">{label}</span><strong>{value}</strong></span>
    </div>
  );
}

/** The important fields of a job description, shown when the recruiter picks it, before matching starts. */
export default function JobSummary({ job }: { job: Job }) {
  const navigate = useNavigate();
  const noSkills = !job.skills?.length;
  return (
    <div className="jd-summary">
      <div className="spread jd-summary-head">
        <div>
          <h3>{job.title}{job.role_name && job.role_name !== job.title && <span className="badge brand plain" style={{ marginLeft: 8 }}>{job.role_name}</span>}</h3>
          <span className="muted small">{[job.category, job.industry].filter(Boolean).join(" · ") || "No category"}</span>
        </div>
        <div className="row">
          <button className="btn" onClick={() => openFile(`/api/v1/jobs/${job.id}/view`, job.title)}><FileText /> View JD</button>
          <button className="btn btn-primary" disabled={noSkills} onClick={() => navigate(`/jobs/${job.id}/shortlist`, { state: { autostart: true } })}>
            <Play /> Start matching
          </button>
          <button className="btn" onClick={() => navigate(`/jobs/${job.id}/shortlist`)}><Rocket /> Open results</button>
        </div>
      </div>
      <div className="facts">
        <Fact icon={<Wallet size={16} />} label="Experience" value={job.experience_years != null ? `${job.experience_years}+ years` : "Not stated"} />
        <Fact icon={<GraduationCap size={16} />} label="Education" value={job.education ?? "Not stated"} />
        <Fact icon={<MapPin size={16} />} label="Location" value={[job.location, job.work_mode].filter(Boolean).join(" · ") || "Not stated"} />
        <Fact icon={<Briefcase size={16} />} label="Industry" value={job.industry ?? "Not stated"} />
      </div>
      <div className="jd-skills">
        <div><span className="label">Required skills</span>
          <div className="chips">{(job.skills ?? []).map((s) => <span key={s} className="tag">{s}</span>)}
            {noSkills && <span className="muted small">None yet. Add required skills to the job before matching.</span>}</div></div>
        {Boolean(job.nice_to_have_skills?.length) && (
          <div><span className="label">Nice to have</span>
            <div className="chips">{job.nice_to_have_skills!.map((s) => <span key={s} className="tag gray">{s}</span>)}</div></div>
        )}
      </div>
    </div>
  );
}
