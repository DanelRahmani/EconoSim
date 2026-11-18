"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeSeriesSpec } from "@/lib/econ/panel";
import { SERIES_COLORS } from "./CurveChart";

const AXIS_TICK = { fontSize: 11, fill: "var(--muted)" } as const;

/**
 * Axis ticks come from the chart library's own tick algorithm, so they arrive as
 * values like 10.000000000000002. Round to 3 decimals and drop trailing zeros —
 * a tick should read "10", not a wall of digits.
 */
const formatTick = (value: unknown): string => {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return String(Math.round(n * 1000) / 1000);
};

/** Recharts-based time-series plot (used for trajectory/path panels). */
export function TimeSeriesChart({
  spec,
  height = 300,
  colors,
}: {
  spec: TimeSeriesSpec;
  height?: number;
  colors?: Record<string, string>;
}) {
  // Merge the series into rows keyed on x so Recharts can plot them together.
  const byX = new Map<number, Record<string, number>>();
  spec.series.forEach((s) => {
    for (const p of s.points) {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
      const row = byX.get(p.x) ?? { x: p.x };
      row[s.label] = p.y;
      byX.set(p.x, row);
    }
  });
  const data = [...byX.values()].sort((a, b) => a.x - b.x);
  // Paths that converge end on top of one another, and so would their names. Work
  // out each end label's height from the data (the plot spans the data's range),
  // then push apart any pair closer than one line of text. Computed from the data,
  // not during drawing, so it is the same on every animation frame.
  const plotHeight = height - 32;
  const values = data.flatMap((row) => Object.entries(row).filter(([k]) => k !== "x").map(([, v]) => v));
  const vMin = Math.min(...values);
  const vMax = Math.max(...values);
  const toPx = (v: number) => (vMax > vMin ? ((vMax - v) / (vMax - vMin)) * plotHeight : plotHeight / 2);
  const ends = spec.series
    .map((s) => {
      const last = [...s.points].reverse().find((p) => Number.isFinite(p.y));
      return last ? { label: s.label, px: toPx(last.y) } : null;
    })
    .filter((e): e is { label: string; px: number } => !!e)
    .sort((a, b) => a.px - b.px);
  const labelShift: Record<string, number> = {};
  let prev = -Infinity;
  for (const e of ends) {
    const at = Math.max(e.px, prev + 13);
    labelShift[e.label] = at - e.px;
    prev = at;
  }
  /** The last row in which a series has a value: where its end label goes. */
  const lastIndex = (label: string) => {
    for (let i = data.length - 1; i >= 0; i--) if (data[i][label] !== undefined) return i;
    return -1;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 24, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
        <XAxis
          dataKey="x"
          type="number"
          domain={["dataMin", "dataMax"]}
          tick={AXIS_TICK}
          stroke="var(--hairline)"
          tickFormatter={formatTick}
          label={{ value: spec.xLabel, position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--muted)" }}
        />
        <YAxis
          tick={AXIS_TICK}
          stroke="var(--hairline)"
          width={58}
          tickFormatter={formatTick}
          label={{ value: spec.yLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: "var(--muted)" }}
        />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: 10,
            color: "var(--ink)",
          }}
          labelStyle={{ color: "var(--muted)" }}
          labelFormatter={(label) => (typeof label === "number" ? label.toFixed(3) : String(label))}
          // Round the readout: hovering should not dump a 15-digit float on you.
          formatter={(value) => {
            const n = typeof value === "number" ? value : Number(value);
            return Number.isFinite(n) ? n.toFixed(3) : String(value);
          }}
        />
        {/* No Recharts legend here — the panel renders one interactive legend. */}
        {[...spec.series]
          // Baselines underneath, so a path is never hidden by its own ghost.
          .sort((a, b) => Number(!!b.ghost) - Number(!!a.ghost))
          .map((s, i) => (
          <Line
            key={s.label}
            type="monotone"
            dataKey={s.label}
            name={s.label}
            dot={false}
            strokeWidth={s.ghost ? 1.75 : 2.25}
            strokeOpacity={s.ghost ? 0.55 : 1}
            strokeDasharray={s.ghost ? "5 5" : s.dashed ? "5 4" : undefined}
            stroke={colors?.[s.label] ?? SERIES_COLORS[i % SERIES_COLORS.length]}
            // Name each path at its right-hand end, so the reader need not match
            // colours against the legend.
            label={(props: { index?: number; x?: number | string; y?: number | string }) =>
              props.index === lastIndex(s.label) && s.label.length <= 26 ? (
                <text
                  key={`end-${s.label}`}
                  x={Number(props.x) - 4}
                  y={Number(props.y) - 7 + (labelShift[s.label] ?? 0)}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={600}
                  fill={colors?.[s.label] ?? SERIES_COLORS[i % SERIES_COLORS.length]}
                  opacity={s.ghost ? 0.75 : 1}
                  paintOrder="stroke"
                  stroke="var(--surface)"
                  strokeWidth={3}
                >
                  {s.label}
                </text>
              ) : (
                <g key={`none-${s.label}-${props.index}`} />
              )
            }
            isAnimationActive
            animationDuration={400}
            animationEasing="ease-out"
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
