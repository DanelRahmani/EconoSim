"use client";

import type { Panel } from "@/lib/econ/panel";
import { fmtNum } from "@/lib/format";
import { CurveChart, Legend, SERIES_COLORS } from "./charts/CurveChart";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";
import { Calculation } from "./math/Calculation";
import { AnimatedNumber } from "./ui/AnimatedNumber";

/** A small up/down chip showing a figure against its baseline value. */
function Delta({ value, previous }: { value: number; previous: number }) {
  const diff = value - previous;
  if (!Number.isFinite(diff) || Math.abs(diff) < 1e-9) {
    return <span className="font-mono text-[0.625rem] text-muted">—</span>;
  }
  const up = diff > 0;
  const pct = Math.abs(previous) > 1e-9 ? (diff / Math.abs(previous)) * 100 : null;
  return (
    <span
      title={`baseline ${fmtNum(previous, 4)}`}
      className={`font-mono text-[0.625rem] ${up ? "text-gain" : "text-accent"}`}
    >
      {up ? "▲" : "▼"} {pct !== null ? `${Math.abs(pct).toFixed(1)}%` : fmtNum(Math.abs(diff), 2)}
    </span>
  );
}

/** Renders one model output panel: charts, scalars, notes and the maths. */
export function PanelCard({ panel, index = 0 }: { panel: Panel; index?: number }) {
  const legend =
    panel.chart && panel.chart.series.length > 1
      ? panel.chart.series.map((s, i) => ({ label: s.label, color: SERIES_COLORS[i % SERIES_COLORS.length] }))
      : panel.timeseries && panel.timeseries.series.length > 1
        ? panel.timeseries.series.map((s, i) => ({ label: s.label, color: SERIES_COLORS[i % SERIES_COLORS.length] }))
        : [];

  return (
    <section
      className="card card-hover reveal p-5"
      style={index ? { animationDelay: `${index * 80}ms` } : undefined}
    >
      <h3 className="text-base font-semibold tracking-tight text-ink">{panel.title}</h3>
      {panel.description && <p className="mt-1 text-sm text-muted">{panel.description}</p>}

      {panel.chart && (
        <div className="mt-4">
          <CurveChart spec={panel.chart} />
        </div>
      )}
      {!panel.chart && panel.timeseries && (
        <div className="mt-4">
          <TimeSeriesChart spec={panel.timeseries} />
        </div>
      )}

      {legend.length > 0 && (
        <div className="mt-3">
          <Legend labels={legend} />
        </div>
      )}

      {panel.scalars && panel.scalars.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {panel.scalars.map((s) => (
            <div
              key={s.label}
              title={s.hint}
              className="rounded-lg border border-hairline bg-surface2/60 px-3 py-2 transition-colors hover:border-accent/40"
            >
              <dt className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">{s.label}</dt>
              <dd className="mt-0.5 flex items-baseline gap-1.5 font-mono text-sm text-ink">
                <AnimatedNumber value={s.value} />
                {s.previous !== undefined && <Delta value={s.value} previous={s.previous} />}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {panel.notes && panel.notes.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-xs text-muted">
          {panel.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      <Calculation steps={panel.trace} />
    </section>
  );
}
