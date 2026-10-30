import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, FileText, Search } from "lucide-react";
import { Alert, Empty, Loading, Modal, Pagination, StatusBadge } from "../../../components/ui";
import { api, openFile } from "../../../services/api";
import { errorMessage } from "../../../lib/axios";
import { formatDateTime, formatYears, labelize } from "../../../utils/format";
import type { Candidate, SourceInfo } from "../../../types/api";
import { CATEGORIES } from "../../jobs/components/JobForm";
import { SITE_LABEL } from "../sourceLabels";
import { CandidateFacts } from "./SourcedResumes";

const LIMIT = 15;
const siteLabel = (site: string | null) => (site ? SITE_LABEL[site] ?? labelize(site) : "Unknown");

/** Every resume found by any sourcing run, with the site it came from. Filter by source on one line;
 *  a row opens what was read from the resume in a centre panel. */
export default function SourcedLibrary({ sources }: { sources: SourceInfo[] }) {
  const [view, setView] = useState({ source_site: "", search: "", category: "", sort: "date_added", order: "desc" });
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const update = (patch: Partial<typeof view>) => { setView({ ...view, ...patch }); setOffset(0); }; // a new filter starts from page one

  const sites = sources.map((s) => s.type);
  // How many sourced resumes each site gave (search and category apply too).
  const counts = useQuery({
    queryKey: ["candidates", "sourced-counts", sites.join(","), view.search, view.category],
    queryFn: async () => Object.fromEntries(await Promise.all(sites.map(async (site) =>
      [site, (await api.listCandidates({ origin: "sourced", source_site: site, search: view.search, category: view.category, limit: 1 })).total] as const))),
    enabled: sites.length > 0,
  });
  const list = useQuery({
    queryKey: ["candidates", "sourced", view, offset],
    queryFn: () => api.listCandidates({ origin: "sourced", ...view, limit: LIMIT, offset }),
    placeholderData: (previous) => previous,
  });
  const detail = useQuery({ queryKey: ["candidate", openId], queryFn: () => api.getCandidate(openId!), enabled: Boolean(openId) });

  const all = counts.data ? Object.values(counts.data).reduce((a, b) => a + b, 0) : null;
  const shownSites = sites.filter((site) => (counts.data?.[site] ?? 0) > 0 || view.source_site === site);
  const tab = (value: string, label: string, count: number | null | undefined) => (
    <button key={value || "all"} role="tab" aria-selected={view.source_site === value} className={view.source_site === value ? "active" : ""}
            onClick={() => update({ source_site: value })}>
      {label}<span className="tab-count">{count ?? "…"}</span>
    </button>
  );
  const openResume = (c: Pick<Candidate, "id" | "name">) => openFile(`/api/v1/candidates/${c.id}/resume`, c.name ?? "Resume");

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-header">
        <div><h2><Database size={18} style={{ verticalAlign: -3 }} /> Sourced resumes</h2>
          <p>Every resume found by sourcing and where it came from. Click a resume to see what was read from it.</p></div>
      </div>
      <div className="toolbar slim logs-toolbar job-candidates-toolbar">
        <div className="segmented" role="tablist" aria-label="Source">
          {tab("", "All", all)}
          {shownSites.map((site) => tab(site, siteLabel(site), counts.data?.[site]))}
        </div>
        <div className="row grow" style={{ position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 10, color: "var(--ink-400)" }} />
          <input className="input grow" style={{ paddingLeft: 32 }} placeholder="Search name, email or title" value={view.search}
                 onChange={(e) => update({ search: e.target.value })} />
        </div>
        <select className="select" value={view.category} onChange={(e) => update({ category: e.target.value })} aria-label="Category">
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="select" value={`${view.sort}:${view.order}`} aria-label="Sort"
                onChange={(e) => { const [s, o] = e.target.value.split(":"); update({ sort: s, order: o }); }}>
          <option value="date_added:desc">Newest</option>
          <option value="name:asc">Name A–Z</option>
          <option value="experience:desc">Most experience</option>
        </select>
      </div>

      {list.isLoading && <Loading />}
      {list.isError && <div className="card-body"><Alert tone="error">{errorMessage(list.error)}</Alert></div>}
      {list.data?.items.length === 0 && (
        view.source_site || view.search || view.category
          ? <Empty title="No sourced resumes with these filters" icon={<Search />}>Try another source or clear the search.</Empty>
          : <Empty title="No sourced resumes yet" icon={<Database />}>Tick a source above and press Start.</Empty>
      )}
      {list.data && list.data.items.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Candidate</th><th>Source</th><th>Category</th><th>Experience</th><th>Status</th><th>Added</th><th>Resume</th></tr></thead>
            <tbody>
              {list.data.items.map((c) => (
                <tr key={c.id} className="clickable" onClick={() => setOpenId(c.id)}>
                  <td><div className="cell-title">{c.name ?? "Name not found"}</div><div className="cell-sub">{c.current_title ?? "—"}</div></td>
                  <td><span className="badge plain">{siteLabel(c.source_site)}</span></td>
                  <td className="muted">{c.category ?? "—"}</td>
                  <td className="muted">{formatYears(c.total_years_experience)}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="muted">{formatDateTime(c.created_at)}</td>
                  <td onClick={(ev) => ev.stopPropagation()}>
                    <button className="btn btn-sm" onClick={() => openResume(c)}><FileText /> View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {list.data && <Pagination total={list.data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}

      {openId && (
        <Modal title={detail.data?.name ?? "Sourced resume"} onClose={() => setOpenId(null)} wide>
          {detail.isLoading && <Loading rows={3} />}
          {detail.isError && <Alert tone="error">{errorMessage(detail.error)}</Alert>}
          {detail.data && (
            <>
              <div className="row">
                <span className="badge plain">From {siteLabel(detail.data.source_site)}</span>
                {detail.data.category && <span className="badge brand plain">{detail.data.category}</span>}
                <span className="muted small">{[detail.data.current_title, formatYears(detail.data.total_years_experience), detail.data.location].filter((x) => x && x !== "—").join(" · ")}</span>
              </div>
              <CandidateFacts c={detail.data} />
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
