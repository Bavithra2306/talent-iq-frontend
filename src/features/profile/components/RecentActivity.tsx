import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";

const DAY = 86_400_000;
const DAYS = 7;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** How busy you were over the last seven days: one bar per day, counted from the activity log. */
export default function RecentActivity() {
  const logs = useQuery({ queryKey: ["logs", "recent-activity"], queryFn: () => api.logs({ limit: 200 }) });
  const days = useMemo(() => {
    const today = new Date();
    const list = Array.from({ length: DAYS }, (_, i) => {
      const d = new Date(today.getTime() - (DAYS - 1 - i) * DAY);
      return { key: dayKey(d), label: d.toLocaleDateString(undefined, { weekday: "short" }), count: 0 };
    });
    for (const entry of logs.data?.items ?? []) {
      const slot = list.find((x) => x.key === dayKey(new Date(entry.at)));
      if (slot) slot.count += 1;
    }
    return list;
  }, [logs.data]);
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="card recent-activity">
      <div className="spread">
        <h2 style={{ fontSize: 13.5 }}>Recent activity</h2>
        <span className="muted small">{logs.isLoading ? "Loading…" : `${total} steps in the last 7 days`}</span>
      </div>
      <div className="activity-bars" role="img" aria-label="Steps per day over the last seven days">
        {days.map((d, i) => (
          <div key={d.key} className="activity-col" title={`${d.label}: ${d.count}`}>
            <b>{d.count || ""}</b>
            <span className={`activity-bar ${d.count ? "" : "zero"}`} style={{ height: `${Math.max(3, (d.count / max) * 84)}px`, animationDelay: `${i * 60}ms` }} />
            <small>{d.label}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
