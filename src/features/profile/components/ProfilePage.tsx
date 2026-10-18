import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { ROLE_LABEL, useSession } from "../../../app/session";
import { Alert, PageHeader, useToast } from "../../../components/ui";
import { updateProfile } from "../../auth/services/authService";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime, initials } from "../../../utils/format";

/** Everyone can update their own name, phone number and location. */
export default function ProfilePage() {
  const { user, setUser } = useSession();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name ?? "", contact: user.contact ?? "", location: user.location ?? "" });
  const changed = form.name !== (user.name ?? "") || form.contact !== (user.contact ?? "") || form.location !== (user.location ?? "");

  const save = useMutation({
    mutationFn: () => updateProfile({
      name: form.name.trim() || null,
      contact: form.contact.trim() || null,
      location: form.location.trim() || null,
    }),
    onSuccess: (updated) => {
      setUser(updated);
      setForm({ name: updated.name ?? "", contact: updated.contact ?? "", location: updated.location ?? "" });
      toast("Profile saved.", "success");
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }

  return (
    <>
      <PageHeader title="My profile" subtitle="Keep your details up to date. Your email and role are managed by your admin." />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <form className="card card-pad stack" onSubmit={submit}>
          <h2>Your details</h2>
          <div className="field"><label htmlFor="name">Full name</label>
            <input id="name" className="input" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Raman" /></div>
          <div className="field"><label htmlFor="phone">Phone number</label>
            <input id="phone" className="input" type="tel" maxLength={20} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="e.g. +91 98765 43210" /></div>
          <div className="field"><label htmlFor="location">Location</label>
            <input id="location" className="input" maxLength={100} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Chennai" /></div>
          {save.isError && <Alert tone="error">{errorMessage(save.error)}</Alert>}
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" disabled={!changed || save.isPending}><Save /> {save.isPending ? "Saving…" : "Save changes"}</button>
          </div>
        </form>

        <div className="card card-pad stack">
          <div className="row" style={{ gap: 14 }}>
            <div className="avatar" style={{ width: 56, height: 56, fontSize: 20 }}>{initials(user.name, user.email[0]?.toUpperCase())}</div>
            <div>
              <strong style={{ fontSize: 16 }}>{user.name || "Name not set"}</strong>
              <div className="muted">{user.email}</div>
            </div>
          </div>
          <dl className="kv">
            <dt>Role</dt><dd><span className="badge brand plain">{ROLE_LABEL[user.role]}</span></dd>
            <dt>Account</dt><dd>{user.is_active ? "Active" : "Disabled"}</dd>
            <dt>Member since</dt><dd>{formatDateTime(user.created_at)}</dd>
            <dt>Last sign-in</dt><dd>{formatDateTime(user.last_login_at)}</dd>
          </dl>
          <p className="small muted">To change your password, sign out and use “Forgot password?” on the sign-in page.</p>
        </div>
      </div>
    </>
  );
}
