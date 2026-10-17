import {
  createContext, useCallback, useContext, useEffect, useRef, useState, type KeyboardEvent, type ReactNode,
} from "react";
import { AlertCircle, CheckCircle2, Circle, Info, Inbox, Loader2, UploadCloud, X, XCircle } from "lucide-react";
import { describeAction, formatTime, friendlyDetails, labelize, STAGE_TONE, STATUS_TONE } from "../lib/format";
import type { CandidateStatus, PipelineEvent, Stage } from "../types/api";

// ---------- layout bits ----------

export function PageHeader({ title, subtitle, actions, crumb }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; crumb?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {crumb && <div className="breadcrumb">{crumb}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return <div className="loading"><span className="spinner" /> {label}</div>;
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon ?? <Inbox />}
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "error" | "warn" | "success"; children: ReactNode }) {
  const Icon = tone === "error" ? XCircle : tone === "success" ? CheckCircle2 : tone === "warn" ? AlertCircle : Info;
  return <div className={`alert ${tone}`} role={tone === "error" ? "alert" : "status"}><Icon /><div>{children}</div></div>;
}

// ---------- badges and scores ----------

export function StatusBadge({ status }: { status: CandidateStatus | null | undefined }) {
  if (!status) return <span className="badge">—</span>;
  return <span className={`badge ${STATUS_TONE[status]}`}>{labelize(status)}</span>;
}

export function StageBadge({ stage }: { stage: Stage | null | undefined }) {
  if (!stage) return <span className="muted">—</span>;
  return <span className={`badge ${STAGE_TONE[stage]}`}>{labelize(stage)}</span>;
}

function tone(value: number) {
  return value >= 75 ? "high" : value >= 50 ? "mid" : "low";
}

export function ScoreBar({ value, max = 100 }: { value: number | null | undefined; max?: number }) {
  if (value === null || value === undefined) return <span className="muted">—</span>;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="score">
      <div className="score-track"><div className={`score-fill ${tone(pct)}`} style={{ width: `${pct}%` }} /></div>
      <span className="score-value">{Math.round(value * 10) / 10}</span>
    </div>
  );
}

export function ScoreRing({ value }: { value: number | null | undefined }) {
  const v = value ?? 0;
  return <div className="score-ring" style={{ ["--p" as string]: v }}><span>{Math.round(v)}</span></div>;
}

// ---------- overlays ----------

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}

export function Modal({ title, onClose, children, footer, wide }: {
  title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" style={wide ? { width: "min(760px, calc(100vw - 32px))" } : undefined}>
        <div className="modal-header"><h2>{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ title, onClose, children, footer }: {
  title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  useEscape(onClose);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="modal-header"><h2>{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </aside>
    </div>
  );
}

// ---------- toasts ----------

type Toast = { id: number; tone: "info" | "success" | "error"; text: string };
const ToastContext = createContext<(text: string, tone?: Toast["tone"]) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.text}</div>)}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

// ---------- inputs ----------

export function TagInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const items = raw.split(",").map((s) => s.trim()).filter(Boolean);
    const next = [...value];
    for (const item of items) if (!next.some((v) => v.toLowerCase() === item.toLowerCase())) next.push(item);
    onChange(next);
    setDraft("");
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (draft.trim()) add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }
  return (
    <div className="tag-input">
      {value.map((tag) => (
        <span key={tag} className="tag">
          {tag}
          <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}><X size={12} /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
             onBlur={() => draft.trim() && add(draft)} placeholder={value.length ? "" : placeholder} />
    </div>
  );
}

export function FileDrop({ accept, multiple, onFiles, hint }: {
  accept: string; multiple?: boolean; onFiles: (files: File[]) => void; hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`dropzone ${over ? "over" : ""}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onFiles(Array.from(e.dataTransfer.files)); }}
      role="button" tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
    >
      <UploadCloud />
      <strong>Drop {multiple ? "files" : "a file"} here or click to browse</strong>
      {hint && <div className="muted small" style={{ marginTop: 4 }}>{hint}</div>}
      <input ref={input} type="file" accept={accept} multiple={multiple} hidden
             onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
    </div>
  );
}

export function Pagination({ total, limit, offset, onChange }: {
  total: number; limit: number; offset: number; onChange: (offset: number) => void;
}) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="pagination">
      <span>{offset + 1}–{Math.min(offset + limit, total)} of {total}</span>
      <div className="row">
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onChange(offset - limit)}>Previous</button>
        <span>Page {page} of {pages}</span>
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onChange(offset + limit)}>Next</button>
      </div>
    </div>
  );
}

// ---------- pipeline progress ----------

const FAIL_STAGES: Stage[] = ["failed", "partly_completed"];

/** The stage chain with the reached stages ticked, plus an optional event list. */
export function StageTimeline({ stages, current, finished, events }: {
  stages: Stage[]; current: Stage; finished: boolean; events?: PipelineEvent[];
}) {
  const failed = FAIL_STAGES.includes(current);
  const reached = Math.max(stages.indexOf(current), failed ? stages.length - 2 : -1);
  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="stages">
        {stages.map((stage, i) => {
          const done = i < reached || (i === reached && finished && !failed);
          const isCurrent = i === reached && !done;
          return (
            <div key={stage} className="row" style={{ gap: 0 }}>
              {i > 0 && <span className="stage-line" />}
              <span className={`stage ${done ? "done" : isCurrent ? "current" : ""}`}>
                <span className="dot">{done ? <CheckCircle2 /> : isCurrent && !finished ? <Loader2 className="spin-icon" /> : <Circle />}</span>
                {labelize(stage)}
              </span>
            </div>
          );
        })}
        {failed && (
          <div className="row" style={{ gap: 0 }}>
            <span className="stage-line" />
            <span className="stage failed"><span className="dot"><XCircle /></span>{labelize(current)}</span>
          </div>
        )}
      </div>
      {events && events.length > 0 && (
        <div className="events">
          {events.map((e, i) => (
            <div key={i} className="event">
              <time>{formatTime(e.at)}</time>
              <div>
                <strong>{e.stage ? labelize(e.stage) : describeAction(e.action)}</strong>
                {e.detail && friendlyDetails(e.detail) && <span className="muted"> — {friendlyDetails(e.detail)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
