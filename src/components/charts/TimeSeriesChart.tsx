"use client";

import { useMemo } from "react";
import type { ChartSpec, TimeSeriesSpec } from "@/lib/econ/panel";
import { CurveChart } from "./CurveChart";

/** More points than this add nothing a screen can show, and cost a frame each. */
const MAX_POINTS = 160;

/**
 * Time paths, drawn by the same SVG chart as the curve diagrams.
 *
 * It used to be Recharts, which re-rendered about 1,500 elements per update and
 * made a slider drag on AD-AS or the ZLB model visibly stutter (20–40ms per
 * frame). The paths are thinned to at most MAX_POINTS for drawing only; the data
 * table and the exports still read the full series from the panel.
 */
export function TimeSeriesChart({
  spec,
  height = 300,
  colors,
  tools,
}: {
  spec: TimeSeriesSpec;
  height?: number;
  colors?: Record<string, string>;
  tools?: React.ReactNode;
}) {
  const chart: ChartSpec = useMemo(
    () => ({
      xLabel: spec.xLabel,
      yLabel: spec.yLabel,
      series: spec.series.map((s) => {
        if (s.points.length <= MAX_POINTS) return s;
        const step = (s.points.length - 1) / (MAX_POINTS - 1);
        return { ...s, points: Array.from({ length: MAX_POINTS }, (_, k) => s.points[Math.round(k * step)]) };
      }),
    }),
    [spec],
  );
  return <CurveChart spec={chart} height={height} colors={colors} tools={tools} readout />;
}
