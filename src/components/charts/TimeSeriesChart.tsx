"use client";

import {
  CartesianGrid,
  Legend as RLegend,
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

/** Recharts-based time-series plot (used for trajectory/path panels). */
export function TimeSeriesChart({ spec, height = 300 }: { spec: TimeSeriesSpec; height?: number }) {
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
          label={{ value: spec.xLabel, position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--muted)" }}
        />
        <YAxis
          tick={AXIS_TICK}
          stroke="var(--hairline)"
          width={58}
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
        <RLegend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
        {spec.series.map((s, i) => (
          <Line
            key={s.label}
            type="monotone"
            dataKey={s.label}
            name={s.label}
            dot={false}
            strokeWidth={2}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
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
