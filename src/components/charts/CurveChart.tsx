"use client";

import type { ChartSpec, Point } from "@/lib/econ/panel";
import { fmtNum } from "@/lib/format";

export const SERIES_COLORS = ["#2563eb", "#dc2626", "#059669", "#d97706", "#7c3aed", "#0891b2"];

const W = 560;

function finite(points: Point[]): Point[] {
  return points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

function domain(values: number[], pad = 0.08): [number, number] {
  const v = values.filter(Number.isFinite);
  if (!v.length) return [0, 1];
  let lo = Math.min(...v);
  let hi = Math.max(...v);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const d = (hi - lo) * pad;
  return [lo - d, hi + d];
}

/** A lightweight SVG chart for economic curve diagrams (curve shifts, phase diagrams, IS-LM). */
export function CurveChart({ spec, height = 300 }: { spec: ChartSpec; height?: number }) {
  const H = height;
  const pad = { l: 56, r: 18, t: 16, b: 44 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const all = [...spec.series.flatMap((s) => finite(s.points)), ...(spec.markers ?? [])];
  const [x0, x1] = domain(all.map((p) => p.x));
  const [y0, y1] = domain(all.map((p) => p.y));
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * iw;
  const sy = (y: number) => pad.t + ih - ((y - y0) / (y1 - y0)) * ih;

  const ticks = (lo: number, hi: number, n = 5) => {
    const out: number[] = [];
    for (let i = 0; i <= n; i++) out.push(lo + ((hi - lo) * i) / n);
    return out;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${spec.yLabel} versus ${spec.xLabel}`}>
      <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="none" stroke="currentColor" strokeOpacity={0.2} />
      {ticks(x0, x1).map((t, i) => (
        <g key={`x${i}`}>
          <line x1={sx(t)} y1={pad.t} x2={sx(t)} y2={pad.t + ih} stroke="currentColor" strokeOpacity={0.08} />
          <text x={sx(t)} y={H - pad.b + 16} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.6}>
            {fmtNum(t, 1)}
          </text>
        </g>
      ))}
      {ticks(y0, y1).map((t, i) => (
        <g key={`y${i}`}>
          <line x1={pad.l} y1={sy(t)} x2={pad.l + iw} y2={sy(t)} stroke="currentColor" strokeOpacity={0.08} />
          <text x={pad.l - 8} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.6}>
            {fmtNum(t, 1)}
          </text>
        </g>
      ))}

      {spec.series.map((s, i) => {
        const pts = finite(s.points);
        if (pts.length < 2) return null;
        const d = pts.map((p, j) => `${j === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
        return (
          <path
            key={s.label}
            d={d}
            fill="none"
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "6 5" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {(spec.markers ?? []).map((m) =>
        Number.isFinite(m.x) && Number.isFinite(m.y) ? (
          <g key={m.label + m.x}>
            <circle cx={sx(m.x)} cy={sy(m.y)} r={4.5} fill="#111827" stroke="#fff" strokeWidth={1.5} />
            <text x={sx(m.x) + 8} y={sy(m.y) - 6} fontSize={11} fontWeight={600} fill="currentColor">
              {m.label}
            </text>
          </g>
        ) : null,
      )}

      <text x={pad.l + iw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.75}>
        {spec.xLabel}
      </text>
      <text x={14} y={pad.t + ih / 2} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.75} transform={`rotate(-90 14 ${pad.t + ih / 2})`}>
        {spec.yLabel}
      </text>
    </svg>
  );
}

export function Legend({ labels }: { labels: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
      {labels.map((l) => (
        <span key={l.label} className="inline-flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 rounded" style={{ background: l.color }} />
          {l.label}
        </span>
      ))}
    </div>
  );
}
