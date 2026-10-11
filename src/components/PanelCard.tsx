"use client";

import { useRef, useState } from "react";
import type { Panel, TableSpec } from "@/lib/econ/panel";
import { fmtNum } from "@/lib/format";
import { CurveChart, Legend, SERIES_COLORS } from "./charts/CurveChart";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";
import { Calculation } from "./math/Calculation";
import { PanelExport } from "./Export";
import { AnimatedNumber } from "./ui/AnimatedNumber";
import { InfoNote } from "./ui/InfoNote";

/** A plain table — used for the game matrix and the market-structure comparison. */
function DataTable({ spec }: { spec: TableSpec }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-hairline px-2 py-1.5" />
            {spec.columns.map((c) => (
              <th
                key={c}
                scope="col"
                className="border border-hairline px-2 py-1.5 text-center font-mono text-[0.6875rem] uppercase tracking-wider text-muted"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r) => (
            <tr key={r.label}>
              <th
                scope="row"
                className="border border-hairline px-2 py-2 text-left font-mono text-[0.6875rem] uppercase tracking-wider text-muted"
              >
                {r.label}
              </th>
              {r.cells.map((cell, j) => (
                <td
                  key={j}
                  className={`border border-hairline px-2 py-2 text-center font-mono text-[0.8125rem] ${
                    cell.emphasis ? "bg-accent/10 text-accent" : "text-ink"
                  } ${cell.underline ? "underline decoration-accent decoration-2 underline-offset-4" : ""}`}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {spec.caption && <p className="mt-2 text-[0.6875rem] leading-snug text-muted">{spec.caption}</p>}
    </div>
  );
}

/** A small up/down chip showing a figure against its baseline value. */
function Delta({ value, previous }: { value: number; previous: number }) {
  const diff = value - previous;
  if (!Number.isFinite(diff) || Math.abs(diff) < 1e-9) {
    return <span className="font-mono text-[0.6875rem] text-muted">—</span>;
  }
  const up = diff > 0;
  const pct = Math.abs(previous) > 1e-9 ? (diff / Math.abs(previous)) * 100 : null;
  return (
    <span
      title={`without shock / baseline: ${fmtNum(previous, 4)}`}
      className={`shrink-0 font-mono text-[0.6875rem] ${up ? "text-gain" : "text-accent"}`}
    >
      {up ? "▲" : "▼"} {pct !== null ? `${Math.abs(pct).toFixed(1)}%` : fmtNum(Math.abs(diff), 2)}
    </span>
  );
}

/** Renders one model output panel: charts, scalars, notes and the maths. */
export function PanelCard({
  panel,
  index = 0,
  chartControls,
  exportName,
}: {
  panel: Panel;
  index?: number;
  /** Rendered directly above the chart — e.g. the time-window control. */
  chartControls?: React.ReactNode;
  /** Stem for this panel's exported files, e.g. "solow-phase-diagram". */
  exportName?: string;
}) {
  // Lines can be switched off from the legend.
  const [hidden, setHidden] = useState<string[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const toggle = (label: string) =>
    setHidden((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const source = panel.chart ? panel.chart.series : (panel.timeseries?.series ?? []);
  // Colours are keyed by label off the *full* list, so hiding a line never
  // shifts the colours of the remaining ones.
  const colors: Record<string, string> = {};
  source.forEach((s, i) => {
    colors[s.label] = SERIES_COLORS[i % SERIES_COLORS.length];
  });
  const legend = source.length > 1 ? source.map((s) => ({ label: s.label, color: colors[s.label] })) : [];
  const visible = <T extends { label: string }>(series: T[]) => series.filter((s) => !hidden.includes(s.label));

  const chart = panel.chart ? { ...panel.chart, series: visible(panel.chart.series) } : undefined;
  const timeseries = panel.timeseries ? { ...panel.timeseries, series: visible(panel.timeseries.series) } : undefined;

  return (
    <section className="card card-hover reveal p-5" style={index ? { animationDelay: `${index * 80}ms` } : undefined}>
      <h3 className="text-base font-semibold tracking-tight text-ink">{panel.title}</h3>
      {panel.description && <p className="mt-1 text-sm leading-relaxed text-muted">{panel.description}</p>}

      {chartControls && <div className="mt-3">{chartControls}</div>}

      {(chart || timeseries) && (
        <div className="mt-3" ref={chartRef}>
          {chart ? <CurveChart spec={chart} colors={colors} /> : timeseries && <TimeSeriesChart spec={timeseries} colors={colors} />}
        </div>
      )}

      {panel.table && <DataTable spec={panel.table} />}

      {legend.length > 0 && (
        <div className="mt-3">
          <Legend labels={legend} hidden={hidden} onToggle={toggle} />
        </div>
      )}
      {legend.length > 0 && hidden.length >= legend.length && (
        <p className="mt-2 text-[0.6875rem] text-muted">
          Every line is hidden — click a legend entry to bring it back.
        </p>
      )}

      {panel.scalars && panel.scalars.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {panel.scalars.map((s) => (
            <div
              key={s.label}
              className="min-w-0 rounded-lg border border-hairline bg-surface2/60 px-3 py-2.5 transition-colors hover:border-accent/40"
            >
              <dt className="flex flex-wrap items-center gap-x-1 break-words font-mono text-[0.6875rem] uppercase leading-tight tracking-wider text-muted">
                <span>{s.label}</span>
                {s.hint && <InfoNote help={s.hint} label={s.label} />}
              </dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-mono text-[0.9375rem] leading-tight text-ink">
                <AnimatedNumber value={s.value} />
                {s.previous !== undefined && <Delta value={s.value} previous={s.previous} />}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {panel.notes && panel.notes.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
          {panel.notes.map((n, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span>{n}</span>
            </li>
          ))}
        </ul>
      )}

      <Calculation steps={panel.trace} />

      {exportName && <PanelExport panel={panel} name={exportName} chartRef={chartRef} />}
    </section>
  );
}
