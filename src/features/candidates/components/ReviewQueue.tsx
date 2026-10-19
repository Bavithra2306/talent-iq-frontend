import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, Trash2 } from "lucide-react";
import { Alert, useToast } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime, labelize } from "../../../utils/format";

/** Files judged "not a resume". The recruiter opens each one and decides.
 *  `origin` shows uploaded files (Candidates page) or sourced ones (Sourcing page). */
export default function ReviewQueue({ origin }: { origin: "upload" | "sourcing" }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const files = useQuery({ queryKey: ["resume-review"], queryFn: api.reviewFiles });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["resume-review"] });
    void queryClient.invalidateQueries({ queryKey: ["candidates"] });
    void queryClient.invalidateQueries({ queryKey: ["categories"] });
  };
  const accept = useMutation({
    mutationFn: api.acceptReviewFile,
    onSuccess: (r) => { toast(r.message, "success"); refresh(); },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const remove = useMutation({
    mutationFn: api.deleteReviewFile,
    onSuccess: () => { toast("File deleted.", "success"); refresh(); },
    onError: (err) => toast(errorMessage(err), "error"),
  });

  const items = (files.data ?? []).filter((f) => (origin === "sourcing") === Boolean(f.source_site));
  if (!items.length) return null;
  const busy = accept.isPending || remove.isPending;
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <div><h2>Needs your review <span className="badge amber">{items.length}</span></h2>
          <p>These {origin === "sourcing" ? "sourced files" : "files"} don't look like resumes. Open each one: keep it as a resume, or delete it.</p></div>
      </div>
      {files.isError && <div className="card-body"><Alert tone="error">{errorMessage(files.error)}</Alert></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>File</th>{origin === "sourcing" && <th>Source</th>}<th>Why</th><th>Added</th><th style={{ textAlign: "right" }}>Decide</th></tr></thead>
          <tbody>
            {items.map((f) => (
              <tr key={f.document_id}>
                <td><div className="cell-title">{f.filename}</div></td>
                {origin === "sourcing" && <td className="muted">{labelize(f.source_site ?? "")}</td>}
                <td className="muted">{(f.reason ?? "Not a resume").replace(" Waiting for your review.", "")}</td>
                <td className="muted">{formatDateTime(f.uploaded_at)}</td>
                <td>
                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button className="btn btn-sm" onClick={() => void openFile(`/api/v1/resumes/review/${f.document_id}/file`)}><FileText /> View</button>
                    <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => accept.mutate(f.document_id)}><Check /> It's a resume</button>
                    <button className="btn btn-sm btn-danger" disabled={busy}
                            onClick={() => { if (window.confirm(`Delete ${f.filename}? This can't be undone.`)) remove.mutate(f.document_id); }}>
                      <Trash2 /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
