import type { Panel } from "./panel";

/**
 * Merge a baseline run into the current run so panels can show both states at
 * once: baseline curves/trajectories are added as extra (dashed) series, and
 * each scalar carries its baseline value for a delta readout.
 */
export function mergePanels(current: Panel[], baseline: Panel[]): Panel[] {
  return current.map((p) => {
    const b = baseline.find((x) => x.id === p.id);
    if (!b) return p;

    const chart =
      p.chart && b.chart
        ? {
            ...p.chart,
            series: [
              ...p.chart.series,
              ...b.chart.series.map((s) => ({ ...s, label: `${s.label} · base`, dashed: true })),
            ],
          }
        : p.chart;

    const timeseries =
      p.timeseries && b.timeseries
        ? {
            ...p.timeseries,
            series: [
              ...p.timeseries.series,
              ...b.timeseries.series.map((s) => ({ ...s, label: `${s.label} · base` })),
            ],
          }
        : p.timeseries;

    const scalars = p.scalars?.map((s) => {
      const prev = b.scalars?.find((x) => x.label === s.label);
      return prev ? { ...s, previous: prev.value } : s;
    });

    return { ...p, chart, timeseries, scalars };
  });
}
