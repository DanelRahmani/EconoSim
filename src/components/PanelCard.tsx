"use client";

import type { Panel } from "@/lib/econ/panel";
import { fmtNum } from "@/lib/format";
import { CurveChart, Legend, SERIES_COLORS } from "./charts/CurveChart";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";
import { Calculation } from "./math/Calculation";

/** Renders one model output panel: charts, scalars, notes and the maths. */
export function PanelCard({ panel }: { panel: Panel }) {
  const legend =
    panel.chart && panel.chart.series.length > 1
      ? panel.chart.series.map((s, i) => ({ label: s.label, color: SERIES_COLORS[i % SERIES_COLORS.length] }))
      : panel.timeseries && panel.timeseries.series.length > 1
        ? panel.timeseries.series.map((s, i) => ({ label: s.label, color: SERIES_COLORS[i % SERIES_COLORS.length] }))
        : [];

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-sm">
      <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{panel.title}</h3>
      {panel.description && <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{panel.description}</p>}

      {panel.chart && (
        <div className="mt-3 text-neutral-900 dark:text-neutral-200">
          <CurveChart spec={panel.chart} />
        </div>
      )}
      {!panel.chart && panel.timeseries && (
        <div className="mt-3">
          <TimeSeriesChart spec={panel.timeseries} />
        </div>
      )}

      {legend.length > 0 && (
        <div className="mt-2">
          <Legend labels={legend} />
        </div>
      )}

      {panel.scalars && panel.scalars.length > 0 && (
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {panel.scalars.map((s) => (
            <div key={s.label} className="rounded-lg bg-neutral-50 dark:bg-neutral-900 px-3 py-2">
              <dt className="text-[11px] uppercase tracking-wide text-neutral-500" title={s.hint}>
                {s.label}
              </dt>
              <dd className="font-mono text-sm text-neutral-900 dark:text-neutral-100">{fmtNum(s.value, 4)}</dd>
            </div>
          ))}
        </dl>
      )}

      {panel.notes && panel.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-neutral-600 dark:text-neutral-400">
          {panel.notes.map((n, i) => (
            <li key={i} className="flex gap-1.5">
              <span aria-hidden>•</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      <Calculation steps={panel.trace} />
    </section>
  );
}
