import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, FileText, MinusCircle } from "lucide-react";
import { useToast } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatYears } from "../../../utils/format";

/** Resumes read by the AI but missing a required field. The recruiter looks at each one and decides:
 *  keep it in the ready list, or set it aside as unprocessable. Nothing is changed or deleted. */
export default function NeedsDecision({ origin }: { origin: "uploaded" | "sourced" }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const list = useQuery({
    queryKey: ["candidates", "needs-review", origin],
    queryFn: () => api.listCandidates({ readiness: "needs_review", origin, limit: 100, sort: "date_added", order: "desc" }),
  });
  const place = useMutation({
    mutationFn: ({ id, readiness }: { id: string; readiness: "ready" | "unprocessable" }) => api.setReadiness(id, readiness),
    onSuccess: (_r, { readiness }) => {
      for (const key of ["candidates", "readiness-counts", "categories", "all-shortlists", "quota"]) void queryClient.invalidateQueries({ queryKey: [key] });
      toast(readiness === "ready" ? "Moved to the ready list." : "Moved to not ready.", "success");
    },
    onError: (err) => toast(errorMessage(err), "error"),
  });
  const items = list.data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <div className="card needs-decision" style={{ marginBottom: 12 }}>
      <div className="card-header">
        <div>
          <h2>Waiting for your decision <span className="badge amber plain">{items.length}</span></h2>
          <p>These {origin === "sourced" ? "sourced " : ""}resumes are missing something required. Look at each one, then choose where it belongs.</p>
        </div>
      </div>
      <div className="decision-list">
        {items.map((c) => (
          <div key={c.id} className="decision-row">
            <div className="decision-who">
              <strong>{c.name ?? "Name not found"}</strong>
              <span className="muted small">{[c.current_title, formatYears(c.total_years_experience)].filter((x) => x && x !== "—").join(" · ") || "No details found"}</span>
              <span className="decision-reason">{c.readiness_reason ?? "A required field is missing"}</span>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
              <button className="btn btn-sm" onClick={() => openFile(`/api/v1/candidates/${c.id}/resume`, c.name ?? "Resume")}><FileText /> View</button>
              <button className="btn btn-sm btn-success" disabled={place.isPending} onClick={() => place.mutate({ id: c.id, readiness: "ready" })}><Check /> Keep in resumes</button>
              <button className="btn btn-sm" disabled={place.isPending} onClick={() => place.mutate({ id: c.id, readiness: "unprocessable" })}><MinusCircle /> Not ready</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
