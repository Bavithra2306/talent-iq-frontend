import { useState, type FormEvent } from "react";
import { TagInput } from "../../../components/ui";
import type { JobInput, JobStatus } from "../../../types/api";

export const CATEGORIES = [
  "IT", "Medical", "Finance", "Engineering", "Education", "Sales & Marketing", "HR", "Legal",
  "Hospitality", "Manufacturing", "Design", "Operations", "Other",
];

export const EMPTY_JOB: JobInput = {
  title: "", role_name: null, category: null, industry: null, experience_years: null, education: null,
  location: null, work_mode: null, skills: [], nice_to_have_skills: [],
};

export default function JobForm({ initial, onSubmit, submitLabel, busy, showStatus, onCancel }: {
  initial: JobInput;
  onSubmit: (job: JobInput) => void;
  submitLabel: string;
  busy?: boolean;
  showStatus?: boolean;
  onCancel?: () => void;
}) {
  const [job, setJob] = useState<JobInput>(initial);
  const set = <K extends keyof JobInput>(key: K, value: JobInput[K]) => setJob((j) => ({ ...j, [key]: value }));
  const text = (v: string) => (v.trim() === "" ? null : v);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({ ...job, title: job.title.trim() });
  }

  return (
    <form onSubmit={submit} className="stack">
      <div className="form-grid">
        <div className="field full">
          <label htmlFor="title">Job title *</label>
          <input id="title" className="input" required value={job.title} onChange={(e) => set("title", e.target.value)}
                 placeholder="e.g. Senior Python Backend Developer" />
        </div>
        <div className="field">
          <label htmlFor="role">Role</label>
          <input id="role" className="input" value={job.role_name ?? ""} maxLength={80}
                 onChange={(e) => set("role_name", e.target.value || null)} placeholder="e.g. SDE II, Team Lead" />
        </div>
        <div className="field">
          <label htmlFor="category">Category</label>
          <input id="category" className="input" list="categories" value={job.category ?? ""}
                 onChange={(e) => set("category", text(e.target.value))} placeholder="IT, Medical, Finance…" />
          <datalist id="categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div className="field">
          <label htmlFor="industry">Industry</label>
          <input id="industry" className="input" value={job.industry ?? ""} onChange={(e) => set("industry", text(e.target.value))}
                 placeholder="e.g. Healthcare software" />
        </div>
        <div className="field">
          <label htmlFor="experience">Minimum experience (years)</label>
          <input id="experience" className="input" type="number" min={0} max={50} value={job.experience_years ?? ""}
                 onChange={(e) => set("experience_years", e.target.value === "" ? null : Number(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="education">Education</label>
          <input id="education" className="input" value={job.education ?? ""} onChange={(e) => set("education", text(e.target.value))}
                 placeholder="e.g. B.E / B.Tech in Computer Science" />
        </div>
        <div className="field">
          <label htmlFor="location">Location</label>
          <input id="location" className="input" value={job.location ?? ""} onChange={(e) => set("location", text(e.target.value))}
                 placeholder="e.g. Chennai" />
        </div>
        <div className="field">
          <label htmlFor="mode">Work mode</label>
          <select id="mode" className="select" value={job.work_mode ?? ""} onChange={(e) => set("work_mode", text(e.target.value))}>
            <option value="">Not specified</option>
            <option value="onsite">Onsite</option>
            <option value="hybrid">Hybrid</option>
            <option value="remote">Remote</option>
          </select>
        </div>
        {showStatus && (
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" className="select" value={job.status ?? "open"} onChange={(e) => set("status", e.target.value as JobStatus)}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        )}
        <div className="field full">
          <span className="label">Required skills</span>
          <TagInput value={job.skills} onChange={(v) => set("skills", v)} placeholder="Type a skill and press Enter" />
          <span className="hint">Candidates are checked against each of these. Add at least one.</span>
        </div>
        <div className="field full">
          <span className="label">Nice-to-have skills</span>
          <TagInput value={job.nice_to_have_skills} onChange={(v) => set("nice_to_have_skills", v)} placeholder="Optional" />
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn btn-primary" disabled={busy || !job.title.trim()}>
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
