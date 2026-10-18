import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { MailPlus, RefreshCw } from "lucide-react";
import { ROLE_LABEL } from "../../app/session";
import { Loading, PageHeader, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import { errorMessage } from "../../lib/axios";
import { initials } from "../../lib/format";
import type { Role } from "../../types/api";

/** Admin: invite recruiters and hiring managers, see who is on the team. */
export default function TeamPage() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"recruiter" | "hiring_manager">("recruiter");
  const members = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const lists = await Promise.all((["admin", "recruiter", "hiring_manager"] as Role[]).map((r) => api.directory(r)));
      return lists.flat();
    },
  });
  const invite = useMutation({
    mutationFn: (args: { email: string; role: "recruiter" | "hiring_manager" }) => api.invite(args.email, args.role),
    onSuccess: (res) => { setEmail(""); toast(res.message, "success"); void members.refetch(); },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    invite.mutate({ email: email.trim(), role });
  }

  return (
    <>
      <PageHeader title="Team" subtitle="Invite people by email. They set their own password from the link in the email." />
      <div className="grid grid-2" style={{ alignItems: "start" }}>
        <form className="card card-pad stack" onSubmit={submit}>
          <h2>Invite someone</h2>
          <div className="field"><label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" /></div>
          <div className="field"><label htmlFor="role">Role</label>
            <select id="role" className="select" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="recruiter">Recruiter — finds and shortlists candidates</option>
              <option value="hiring_manager">Hiring manager — reviews shared candidates</option>
            </select></div>
          <p className="small muted">Inviting someone who hasn't accepted yet sends them a fresh link.</p>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btn-primary" disabled={invite.isPending}><MailPlus /> {invite.isPending ? "Sending…" : "Send invitation"}</button>
          </div>
        </form>
        <div className="card">
          <div className="card-header"><h2>People</h2><span className="muted">{members.data?.length ?? 0}</span></div>
          {members.isLoading && <Loading />}
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {members.data?.map((m) => (
                  <tr key={m.id}>
                    <td style={{ width: 44 }}><div className="avatar">{initials(m.name, m.email[0]?.toUpperCase())}</div></td>
                    <td><div className="cell-title">{m.name ?? "—"}</div><div className="cell-sub">{m.email}</div></td>
                    <td><span className="badge brand plain">{ROLE_LABEL[m.role]}</span></td>
                    <td style={{ textAlign: "right" }}>
                      {m.status === "invite_sent" ? (
                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <span className="badge amber">Invite not accepted</span>
                          {m.role !== "admin" && (
                            <button className="btn btn-sm" disabled={invite.isPending}
                                    onClick={() => invite.mutate({ email: m.email, role: m.role as "recruiter" | "hiring_manager" })}>
                              <RefreshCw /> Resend
                            </button>
                          )}
                        </div>
                      ) : <span className="badge green">Active</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
