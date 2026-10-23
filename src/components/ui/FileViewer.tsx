import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";
import { apiClient } from "../../lib/axios";
import { errorMessage } from "../../lib/axios";
import { Skeleton } from "./motion";

export const VIEW_FILE_EVENT = "talentiq:view-file";

export interface ViewFileRequest { url: string; title?: string }

/** Fetches a file from the API as a blob and gives a temporary URL for an iframe or image. */
function useFileBlob(url: string | null) {
  const [src, setSrc] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!url) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setSrc(null); setBlob(null); setError("");
    apiClient.get(url, { responseType: "blob" })
      .then((res) => {
        if (cancelled) return;
        const data = res.data as Blob;
        objectUrl = URL.createObjectURL(data);
        setBlob(data);
        setSrc(objectUrl);
      })
      .catch((err) => !cancelled && setError(errorMessage(err)));
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return { src, blob, error };
}

function FileBody({ src, blob, error, title }: { src: string | null; blob: Blob | null; error: string; title: string }) {
  if (error) return <div className="viewer-state"><strong>Couldn't open this file</strong><span className="muted">{error}</span></div>;
  if (!src) return <div className="viewer-state"><Skeleton h={14} w="60%" /><Skeleton h={14} w="80%" /><Skeleton h={14} w="70%" /><Skeleton h={320} /></div>;
  return (blob?.type ?? "").startsWith("image/")
    ? <img className="viewer-image" src={src} alt={title} />
    : <iframe className="viewer-frame" src={src} title={title} />;
}

/** A resume or JD shown inline in the page (used in tabs inside panels). */
export function InlineFile({ url, title = "Document", height = 560 }: { url: string; title?: string; height?: number }) {
  const { src, blob, error } = useFileBlob(url);
  return <div className="inline-file" style={{ height }}><FileBody src={src} blob={blob} error={error} title={title} /></div>;
}

/** Shows a resume or job description inside the page (PDF, Word preview, image) instead of a new tab.
 *  Mounted once in the app providers; `openFile(url)` in services/api.ts opens it. */
export function FileViewerHost() {
  const [request, setRequest] = useState<ViewFileRequest | null>(null);
  const { src, blob, error } = useFileBlob(request?.url ?? null);

  useEffect(() => {
    const open = (e: Event) => setRequest((e as CustomEvent<ViewFileRequest>).detail);
    window.addEventListener(VIEW_FILE_EVENT, open);
    return () => window.removeEventListener(VIEW_FILE_EVENT, open);
  }, []);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setRequest(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  if (!request) return null;
  const title = request.title ?? "Document";

  function download() {
    if (!src) return;
    const a = document.createElement("a");
    a.href = src;
    a.download = title;
    a.click();
  }

  return (
    <div className="overlay viewer-overlay" onMouseDown={(e) => e.target === e.currentTarget && setRequest(null)}>
      <div className="viewer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="viewer-bar">
          <span className="viewer-title"><FileText size={16} /> {title}</span>
          <span className="row">
            <button className="btn btn-sm" onClick={download} disabled={!src}>Download</button>
            <button className="btn btn-ghost btn-icon" onClick={() => setRequest(null)} aria-label="Close"><X /></button>
          </span>
        </div>
        <div className="viewer-body"><FileBody src={src} blob={blob} error={error} title={title} /></div>
      </div>
    </div>
  );
}
