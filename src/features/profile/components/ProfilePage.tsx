import { useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Clock, Lock, Mail, MapPin, Moon, Phone, Save, ShieldCheck, Sun, User } from "lucide-react";
import { ROLE_LABEL, useSession } from "../../../app/session";
import { Alert, PageHeader, useToast } from "../../../components/ui";
import { updateProfile } from "../../auth/services/authService";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime, initials } from "../../../utils/format";
import RecentActivity from "./RecentActivity";
import { useTheme } from "../../../app/theme";

const PHONE = /^[+0-9][0-9 ()-]{6,19}$/;

function validate(form: { name: string; contact: string; location: string }): Partial<Record<keyof typeof form, string>> {
  const errors: Partial<Record<keyof typeof form, string>> = {};
  if (form.name.trim().length < 2) errors.name = "Enter your full name (at least 2 characters).";
  if (!PHONE.test(form.contact.trim())) errors.contact = "Use digits, spaces, + or -, e.g. +91 98765 43210.";
  if (!form.location.trim()) errors.location = "Enter your location.";
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

/** Fill in your name, phone and location once. After they are saved they are locked (read-only);
 *  email and role are managed by the admin. */
export default function ProfilePage() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const [theme, setTheme] = useTheme();
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState({ name: user.name ?? "", contact: user.contact ?? "", location: user.location ?? "" });
  const errors = validate(form);
  const locked = Boolean(user.name?.trim());

  const save = useMutation({
    mutationFn: () => updateProfile({ name: form.name.trim(), contact: form.contact.trim(), location: form.location.trim() }),
    onSuccess: (updated) => {
      setUser(updated);
      toast("Profile saved. These details are now locked.", "success");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length === 0) save.mutate();
  }

  return (
    <>
      <div className="profile-center">
      <div className="profile-compact">
        <PageHeader title="My profile" subtitle="Your email and role are managed by your admin." />
        <div className="card card-pad">
          <div className="profile-top">
            <div className="avatar">{initials(user.name, user.email[0]?.toUpperCase())}</div>
            <div>
              <h2>{user.name || "Name not set"}</h2>
              <span className="muted small">{user.email}</span>
              <div className="row" style={{ marginTop: 4 }}>
                <span className="badge brand plain">{ROLE_LABEL[user.role]}</span>
                <span className={`badge plain ${user.is_active ? "green" : "red"}`}>{user.is_active ? "Active" : "Disabled"}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card card-pad appearance">
          <h2 style={{ fontSize: 15 }}>Appearance</h2>
          <div className="segmented" role="group" aria-label="Theme">
            <button className={theme === "light" ? "active" : ""} aria-pressed={theme === "light"} onClick={() => setTheme("light")}><Sun /> Light</button>
            <button className={theme === "dark" ? "active" : ""} aria-pressed={theme === "dark"} onClick={() => setTheme("dark")}><Moon /> Dark</button>
          </div>
        </div>

        <form className="card card-pad stack" onSubmit={submit} noValidate>
          <div className="spread">
            <h2 style={{ fontSize: 15 }}>Your details</h2>
            {locked && <span className="lock-note"><Lock size={13} /> Locked</span>}
          </div>
          {locked ? (
            <div className="profile-rows">
              <Row icon={<User size={15} />} label="Full name" value={user.name} />
              <Row icon={<Phone size={15} />} label="Phone number" value={user.contact || "Not set"} />
              <Row icon={<MapPin size={15} />} label="Location" value={user.location || "Not set"} />
              <p className="small muted" style={{ margin: 0 }}>These details cannot be changed after saving. Ask your admin if something is wrong.</p>
            </div>
          ) : (
            <>
              <div className="field"><label htmlFor="name">Full name</label>
                <input id="name" className={`input ${touched && errors.name ? "invalid" : ""}`} maxLength={100} value={form.name}
                       onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Raman" />
                {touched && errors.name && <span className="field-error">{errors.name}</span>}</div>
              <div className="field"><label htmlFor="phone">Phone number</label>
                <input id="phone" className={`input ${touched && errors.contact ? "invalid" : ""}`} type="tel" maxLength={20} value={form.contact}
                       onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="e.g. +91 98765 43210" />
                {touched && errors.contact && <span className="field-error">{errors.contact}</span>}</div>
              <div className="field"><label htmlFor="location">Location</label>
                <input id="location" className={`input ${touched && errors.location ? "invalid" : ""}`} maxLength={100} value={form.location}
                       onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Chennai" />
                {touched && errors.location && <span className="field-error">{errors.location}</span>}</div>
              {save.isError && <Alert tone="error">{errorMessage(save.error)}</Alert>}
              <p className="small muted" style={{ margin: 0 }}>You can only save these once. Check them before saving.</p>
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-primary btn-sm" disabled={save.isPending}><Save /> {save.isPending ? "Saving…" : "Save details"}</button>
              </div>
            </>
          )}
        </form>

        <div className="card card-pad stack">
          <h2 style={{ fontSize: 15 }}>Account</h2>
          <div className="profile-rows">
            <Row icon={<Mail size={15} />} label="Email" value={user.email} />
            <Row icon={<ShieldCheck size={15} />} label="Role" value={ROLE_LABEL[user.role]} />
            <Row icon={<CalendarDays size={15} />} label="Member since" value={formatDateTime(user.created_at)} />
            <Row icon={<Clock size={15} />} label="Last sign-in" value={formatDateTime(user.last_login_at)} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>To change your password, sign out and use “Forgot password?” on the sign-in page.</p>
        </div>
        {user.role !== "hiring_manager" && <RecentActivity />}
      </div>
      
      </div>
    </>
  );
}
