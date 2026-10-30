import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Alert, Loading, Modal, useToast } from "../../../components/ui";
import { api } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { describeAction, formatDateTime } from "../../../utils/format";

/** Send the shortlisted candidates not shared yet to a hiring manager. */
export function ShareModal({ jobId, count, onClose, onShared }: { jobId: string; count: number; onClose: () => void; onShared: () => void }) {
  const toast = useToast();
  const managers = useQuery({ queryKey: ["directory", "hiring_manager"], queryFn: () => api.directory("hiring_manager") });
  const [managerId, setManagerId] = useState("");
  const [note, setNote] = useState("");
  const share = useMutation({
    mutationFn: () => api.share(jobId, managerId, note),
    onSuccess: (r) => {
      toast(`Shared ${r.shared} candidate(s)${r.skipped.length ? `, ${r.skipped.length} skipped` : ""}.`, "success");
      onShared();
      onClose();
    },
  });
  return (
    <Modal title="Share with a hiring manager" onClose={onClose}
           footer={<><button className="btn" onClick={onClose}>Cancel</button>
             <button className="btn btn-primary" disabled={!managerId || share.isPending} onClick={() => share.mutate()}><Send /> Share {count} candidate(s)</button></>}>
      <p className="muted">The {count} shortlisted candidate(s) not shared yet go to the hiring manager with their scores, reasons and your notes.</p>
      {managers.isLoading && <Loading />}
      {managers.data?.length === 0 && <Alert tone="warn">There are no active hiring managers yet. An admin can invite one from Team.</Alert>}
      {managers.data && managers.data.length > 0 && (
        <div className="field"><label htmlFor="hm">Hiring manager</label>
          <select id="hm" className="select" value={managerId} onChange={(e) => setManagerId(e.target.value)}>
            <option value="">Choose…</option>
            {managers.data.map((m) => <option key={m.id} value={m.id}>{m.name ? `${m.name} (${m.email})` : m.email}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label htmlFor="note">Message (optional)</label>
        <textarea id="note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Please review by Friday" /></div>
      {share.isError && <Alert tone="error">{errorMessage(share.error)}</Alert>}
    </Modal>
  );
}

/** What hiring managers decided for this job, newest first. */
export function HistoryModal({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const events = useQuery({ queryKey: ["review-history", jobId], queryFn: () => api.reviewHistory(jobId) });
  return (
    <Modal title="Review history" onClose={onClose} wide>
      {events.isLoading && <Loading />}
      {events.data?.length === 0 && <p className="muted">No reviews yet.</p>}
      <div className="events">
        {events.data?.map((e, i) => {
          const d = typeof e.detail === "object" && e.detail ? e.detail : {};
          const extra = ["comment", "note", "notes"].map((k) => d[k]).find(Boolean);
          return (
            <div key={i} className="event" style={{ gridTemplateColumns: "120px 1fr" }}>
              <time>{formatDateTime(e.at)}</time>
              <div><strong>{describeAction(e.action)}</strong>{extra ? <span className="muted"> — “{String(extra)}”</span> : null}</div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
