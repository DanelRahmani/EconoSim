"use client";

import type { ChartSpec, Point } from "@/lib/econ/panel";
import { fmtNum } from "@/lib/format";
import { axisDomain } from "@/lib/scale";

/** Series palette tuned to read on both the cool-white and near-black grounds. */
export const SERIES_COLORS = ["#F43F5E", "#14B8A6", "#8B5CF6", "#F59E0B", "#06B6D4", "#EC4899"];

const W = 560;

function finite(points: Point[]): Point[] {
  return points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/** A lightweight SVG chart for economic curve diagrams (curve shifts, phase diagrams, IS-LM). */
export function CurveChart({
  spec,
  height = 300,
  colors,
}: {
  spec: ChartSpec;
  height?: number;
  /** Optional label → colour map, so colours stay stable when lines are hidden. */
  colors?: Record<string, string>;
}) {
  const H = height;
  const pad = { l: 56, r: 18, t: 16, b: 44 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const all = [...spec.series.flatMap((s) => finite(s.points)), ...(spec.markers ?? [])];
  const [x0, x1] = axisDomain(all.map((p) => p.x));
  const [y0, y1] = axisDomain(all.map((p) => p.y));
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * iw;
  const sy = (y: number) => pad.t + ih - ((y - y0) / (y1 - y0)) * ih;

  const ticks = (lo: number, hi: number, n = 5) => {
    const out: number[] = [];
    for (let i = 0; i <= n; i++) out.push(lo + ((hi - lo) * i) / n);
    return out;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${spec.yLabel} versus ${spec.xLabel}`}>
      <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="none" stroke="var(--hairline)" />
      {ticks(x0, x1).map((t, i) => (
        <g key={`x${i}`}>
          <line x1={sx(t)} y1={pad.t} x2={sx(t)} y2={pad.t + ih} stroke="var(--hairline)" />
          <text x={sx(t)} y={H - pad.b + 16} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {fmtNum(t, 1)}
          </text>
        </g>
      ))}
      {ticks(y0, y1).map((t, i) => (
        <g key={`y${i}`}>
          <line x1={pad.l} y1={sy(t)} x2={pad.l + iw} y2={sy(t)} stroke="var(--hairline)" />
          <text x={pad.l - 8} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
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
            pathLength={s.dashed ? undefined : 1}
            className={s.dashed ? "pop-in" : "chart-line"}
            style={{ animationDelay: `${i * 90}ms`, opacity: s.dashed ? 0.7 : undefined }}
            fill="none"
            stroke={colors?.[s.label] ?? SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={s.dashed ? "6 5" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {(spec.markers ?? []).map((m) =>
        Number.isFinite(m.x) && Number.isFinite(m.y) ? (
          <g key={m.label + m.x}>
            <circle cx={sx(m.x)} cy={sy(m.y)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
            <text x={sx(m.x) + 8} y={sy(m.y) - 6} fontSize={11} fontWeight={600} fill="var(--ink)">
              {m.label}
            </text>
          </g>
        ) : null,
      )}

      <text x={pad.l + iw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
        {spec.xLabel}
      </text>
      <text
        x={14}
        y={pad.t + ih / 2}
        textAnchor="middle"
        fontSize={11}
        fill="var(--muted)"
        transform={`rotate(-90 14 ${pad.t + ih / 2})`}
      >
        {spec.yLabel}
      </text>
    </svg>
  );
}

export function Legend({
  labels,
  hidden,
  onToggle,
}: {
  labels: { label: string; color: string }[];
  hidden?: string[];
  onToggle?: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.75rem] text-muted">
      {labels.map((l) => {
        const off = hidden?.includes(l.label) ?? false;
        const swatch = (
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full transition-opacity"
            style={{ background: off ? "var(--muted)" : l.color, opacity: off ? 0.45 : 1 }}
          />
        );
        if (!onToggle) {
          return (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              {swatch}
              {l.label}
            </span>
          );
        }
        return (
          <button
            key={l.label}
            type="button"
            aria-pressed={!off}
            title={off ? "Show this line" : "Hide this line"}
            onClick={() => onToggle(l.label)}
            className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-70 ${
              off ? "line-through opacity-55" : ""
            }`}
          >
            {swatch}
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
