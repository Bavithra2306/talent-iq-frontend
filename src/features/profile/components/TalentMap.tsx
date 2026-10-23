import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../services/api";

/** Rough outline of India as [longitude, latitude]; the map is drawn as a grid of dots inside it. */
const INDIA: [number, number][] = [
  [74.0, 34.8], [75.5, 36.9], [77.8, 35.5], [79.0, 34.3], [78.8, 32.5], [80.2, 30.9], [81.0, 30.2], [80.1, 28.8], [81.8, 27.9],
  [84.0, 27.3], [86.0, 26.6], [88.1, 26.4], [88.0, 27.5], [89.0, 27.3], [89.8, 26.8], [92.0, 26.9], [94.5, 27.6], [96.2, 28.3],
  [97.3, 28.0], [95.5, 26.5], [94.6, 25.0], [93.3, 23.5], [92.3, 22.2], [92.5, 24.0], [91.5, 25.2], [89.8, 25.3], [89.0, 26.2],
  [88.8, 24.5], [88.7, 22.0], [87.0, 21.5], [86.5, 20.3], [85.0, 19.5], [83.2, 17.6], [82.2, 16.5], [81.1, 15.8], [80.6, 13.5],
  [80.2, 11.5], [79.2, 10.3], [78.2, 8.9], [77.5, 8.1], [76.4, 8.9], [75.8, 11.2], [74.6, 12.9], [74.2, 14.8], [73.4, 16.8],
  [72.8, 19.0], [72.8, 21.0], [72.5, 21.9], [70.8, 20.8], [69.0, 22.2], [68.3, 23.7], [70.2, 24.2], [71.0, 24.5], [70.0, 26.0],
  [70.5, 27.8], [72.0, 28.8], [74.3, 31.0], [74.6, 32.5], [73.8, 34.0],
];

const CITIES: Record<string, [number, number, string]> = {
  chennai: [80.27, 13.08, "Chennai"], mumbai: [72.88, 19.07, "Mumbai"], kochi: [76.27, 9.93, "Kochi"], hyderabad: [78.48, 17.38, "Hyderabad"],
  coimbatore: [76.96, 11.0, "Coimbatore"], bengaluru: [77.59, 12.97, "Bengaluru"], mysuru: [76.64, 12.3, "Mysuru"], pune: [73.86, 18.52, "Pune"],
  madurai: [78.12, 9.92, "Madurai"], noida: [77.39, 28.54, "Noida"], trichy: [78.69, 10.79, "Trichy"], gurugram: [77.03, 28.46, "Gurugram"],
  delhi: [77.21, 28.61, "Delhi"], kolkata: [88.36, 22.57, "Kolkata"], ahmedabad: [72.57, 23.03, "Ahmedabad"], jaipur: [75.79, 26.91, "Jaipur"],
  lucknow: [80.95, 26.85, "Lucknow"], chandigarh: [76.78, 30.73, "Chandigarh"], nagpur: [79.09, 21.15, "Nagpur"], thiruvananthapuram: [76.94, 8.52, "Thiruvananthapuram"],
  visakhapatnam: [83.22, 17.69, "Visakhapatnam"], bhubaneswar: [85.82, 20.3, "Bhubaneswar"], indore: [75.86, 22.72, "Indore"], surat: [72.83, 21.17, "Surat"],
  vellore: [79.13, 12.92, "Vellore"], salem: [78.15, 11.66, "Salem"], tirunelveli: [77.69, 8.73, "Tirunelveli"], mangaluru: [74.85, 12.91, "Mangaluru"],
};
const ALIASES: Record<string, string> = {
  bangalore: "bengaluru", gurgaon: "gurugram", bombay: "mumbai", trivandrum: "thiruvananthapuram", mysore: "mysuru", tiruchirappalli: "trichy",
  trichirappalli: "trichy", cochin: "kochi", vizag: "visakhapatnam", calcutta: "kolkata", madras: "chennai", mangalore: "mangaluru", "new delhi": "delhi",
};

const SCALE = 10;
const W = 300;
const H = 330;
const project = (lon: number, lat: number): [number, number] => [(lon - 68) * SCALE, (37.5 - lat) * SCALE];
const POLY = INDIA.map(([lon, lat]) => project(lon, lat));

function inside(x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i];
    const [xj, yj] = POLY[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function cityKey(raw: string): string | null {
  const name = raw.split(",")[0].trim().toLowerCase();
  const key = ALIASES[name] ?? name;
  return CITIES[key] ? key : null;
}

/** Where the recruiter's candidates live: a dotted map of India with a pulsing dot on every city. */
export default function TalentMap() {
  const data = useQuery({ queryKey: ["candidate-locations"], queryFn: api.locations });
  const dots = useMemo(() => {
    const out: [number, number][] = [];
    for (let y = 4; y < H; y += 6) for (let x = 4; x < W; x += 6) if (inside(x, y)) out.push([x, y]);
    return out;
  }, []);
  const cities = useMemo(() => {
    const totals = new Map<string, number>();
    let elsewhere = 0;
    for (const row of data.data ?? []) {
      const key = row.location ? cityKey(row.location) : null;
      if (key) totals.set(key, (totals.get(key) ?? 0) + row.count); else elsewhere += row.count;
    }
    const list = [...totals.entries()].map(([key, count]) => ({ key, count, name: CITIES[key][2], at: project(CITIES[key][0], CITIES[key][1]) }))
      .sort((a, b) => b.count - a.count);
    return { list, elsewhere, max: list[0]?.count ?? 1 };
  }, [data.data]);

  return (
    <div className="card talent-map">
      <div className="talent-map-head">
        <h2>Where your candidates are</h2>
        <span className="muted small">Bigger dots mean more resumes in that city.</span>
      </div>
      <div className="talent-map-body">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Map of India with your candidates' cities">
          {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.5} className="map-dot" />)}
          {cities.list.map((c, i) => {
            const r = 3 + 6 * Math.sqrt(c.count / cities.max);
            return (
              <g key={c.key} transform={`translate(${c.at[0]} ${c.at[1]})`} className="map-city">
                <circle r={r} className="map-ping" style={{ animationDelay: `${(i % 6) * 0.35}s` }} />
                <circle r={Math.max(2.5, r * 0.55)} className="map-core"><title>{c.name}: {c.count}</title></circle>
              </g>
            );
          })}
        </svg>
        <ol className="map-legend">
          {cities.list.slice(0, 6).map((c) => (
            <li key={c.key}><span className="map-swatch" /><span>{c.name}</span><strong>{c.count}</strong></li>
          ))}
          {cities.elsewhere > 0 && <li className="muted"><span className="map-swatch off" /><span>Elsewhere or remote</span><strong>{cities.elsewhere}</strong></li>}
          {data.isSuccess && cities.list.length === 0 && <li className="muted">No locations yet. Upload resumes to see them here.</li>}
        </ol>
      </div>
    </div>
  );
}
