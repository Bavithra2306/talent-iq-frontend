import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, Clock, Mail, MapPin, Pencil, Phone, Save, ShieldCheck, User, X } from "lucide-react";
import type { ReactNode } from "react";
import { ROLE_LABEL, useSession } from "../../../app/session";
import { Alert, AnimatedNumber, PageHeader, Reveal, useToast } from "../../../components/ui";
import { updateProfile } from "../../auth/services/authService";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime, initials } from "../../../utils/format";

const PHONE = /^[+0-9][0-9 ()-]{6,19}$/;

function validate(form: { name: string; contact: string; location: string }): Partial<Record<keyof typeof form, string>> {
  const errors: Partial<Record<keyof typeof form, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Enter your full name (at least 2 characters).";
  if (form.contact.trim() && !PHONE.test(form.contact.trim())) errors.contact = "Use digits, spaces, + or -, e.g. +91 98765 43210.";
  return errors;
}

function Row({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="profile-row">
      <span className="profile-row-icon">{icon}</span>
      <span><span className="muted small">{label}</span><strong>{value}</strong></span>
    </div>
  );
}

/** Everyone can update their own name, phone number and location. Details are shown read-only;
 *  "Edit details" unlocks them, and saving locks them again. */
export default function ProfilePage() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState({ name: user.name ?? "", contact: user.contact ?? "", location: user.location ?? "" });
  const errors = validate(form);
  const changed = form.name !== (user.name ?? "") || form.contact !== (user.contact ?? "") || form.location !== (user.location ?? "");

  const filled = [user.name, user.contact, user.location].filter((v) => v && v.trim()).length + 1; // +1: email is always there
  const complete = Math.round((filled / 4) * 100);

  const save = useMutation({
    mutationFn: () => updateProfile({
      name: form.name.trim() || null,
      contact: form.contact.trim() || null,
      location: form.location.trim() || null,
    }),
    onSuccess: (updated) => {
      setUser(updated);
      setForm({ name: updated.name ?? "", contact: updated.contact ?? "", location: updated.location ?? "" });
      setEditing(false);
      setTouched(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
      toast("Profile saved.", "success");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length === 0) save.mutate();
  }
  function cancel() {
    setForm({ name: user.name ?? "", contact: user.contact ?? "", location: user.location ?? "" });
    setEditing(false);
    setTouched(false);
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Your email and role are managed by your admin." />
      <div className="profile-grid">
        <Reveal>
          <div className="card profile-hero">
            <div className="profile-ring" style={{ ["--p" as string]: complete }}>
              <div className="avatar profile-avatar">{initials(user.name, user.email[0]?.toUpperCase())}</div>
            </div>
            <div className="profile-hero-text">
              <h2>{user.name || "Name not set"}</h2>
              <span className="muted">{user.email}</span>
              <div className="row" style={{ marginTop: 8 }}>
                <span className="badge brand plain">{ROLE_LABEL[user.role]}</span>
                <span className={`badge plain ${user.is_active ? "green" : "red"}`}>{user.is_active ? "Active" : "Disabled"}</span>
              </div>
            </div>
            <div className="profile-complete">
              <strong><AnimatedNumber value={complete} suffix="%" /></strong>
              <span className="muted small">{complete === 100 ? "Profile complete" : "Profile complete: add your phone and location"}</span>
            </div>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <form className="card card-pad stack" onSubmit={submit} noValidate>
            <div className="spread">
              <h2>Your details</h2>
              {saved && <span className="saved-pill"><CheckCircle2 size={15} /> Saved</span>}
              {!editing && <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}><Pencil /> Edit details</button>}
            </div>

            {!editing ? (
              <div className="profile-rows">
                <Row icon={<User size={16} />} label="Full name" value={user.name || "Not set"} />
                <Row icon={<Mail size={16} />} label="Email" value={user.email} />
                <Row icon={<Phone size={16} />} label="Phone number" value={user.contact || "Not set"} />
                <Row icon={<MapPin size={16} />} label="Location" value={user.location || "Not set"} />
              </div>
            ) : (
              <>
                <div className="field"><label htmlFor="name">Full name</label>
                  <input id="name" className={`input ${touched && errors.name ? "invalid" : ""}`} maxLength={100} autoFocus value={form.name}
                         onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Raman" />
                  {touched && errors.name && <span className="field-error">{errors.name}</span>}</div>
                <div className="field"><label htmlFor="phone">Phone number</label>
                  <input id="phone" className={`input ${touched && errors.contact ? "invalid" : ""}`} type="tel" maxLength={20} value={form.contact}
                         onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="e.g. +91 98765 43210" />
                  {touched && errors.contact && <span className="field-error">{errors.contact}</span>}</div>
                <div className="field"><label htmlFor="location">Location</label>
                  <input id="location" className="input" maxLength={100} value={form.location}
                         onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Chennai" /></div>
                {save.isError && <Alert tone="error">{errorMessage(save.error)}</Alert>}
                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button type="button" className="btn" onClick={cancel}><X /> Cancel</button>
                  <button className="btn btn-primary" disabled={!changed || save.isPending}><Save /> {save.isPending ? "Saving…" : "Save changes"}</button>
                </div>
              </>
            )}
          </form>
        </Reveal>

        <Reveal delay={160}>
          <div className="card card-pad stack">
            <h2>Account</h2>
            <div className="profile-rows">
              <Row icon={<ShieldCheck size={16} />} label="Role" value={ROLE_LABEL[user.role]} />
              <Row icon={<CalendarDays size={16} />} label="Member since" value={formatDateTime(user.created_at)} />
              <Row icon={<Clock size={16} />} label="Last sign-in" value={formatDateTime(user.last_login_at)} />
            </div>
            <p className="small muted">To change your password, sign out and use “Forgot password?” on the sign-in page.</p>
          </div>
        </Reveal>
      </div>
    </>
  );
}
