"use client";

import { useEffect, useRef, useState } from "react";
import { seriesToTable, type Panel, type TableSpec } from "@/lib/econ/panel";
import { describeChange, fmtScalar } from "@/lib/format";
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
                className="border border-hairline px-2 py-1.5 text-center font-mono text-[0.75rem]  text-muted"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((r, rowIndex) => (
            <tr key={`${rowIndex}-${r.label}`}>
              <th
                scope="row"
                className="border border-hairline px-2 py-2 text-left font-mono text-[0.75rem]  text-muted"
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
                  {cell.parts
                    ? cell.parts.map((part, k) => (
                        <span
                          key={k}
                          className={part.underline ? "underline decoration-accent decoration-2 underline-offset-4" : undefined}
                        >
                          {part.text}
                        </span>
                      ))
                    : cell.text}
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

/**
 * Bodoni's hyphen is a hairline about as wide as a space, so "IS-LM" read as
 * "IS LM" in a heading. Hyphens are set in the sans face, which has a visible one.
 */
export function SolidHyphens({ text }: { text: string }) {
  const parts = text.split("-");
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span className="font-sans font-medium">-</span>}
          {part}
        </span>
      ))}
    </>
  );
}

/** A small up/down chip showing a figure against its baseline value. */
function Delta({ value, previous, percent = false }: { value: number; previous: number; percent?: boolean }) {
  const change = describeChange(value, previous, percent);
  if (!change) return <span className="font-mono text-[0.6875rem] text-muted">=</span>;
  return (
    <span
      title={`without shock / baseline: ${fmtScalar(previous, percent)}`}
      className={`fade-in shrink-0 font-mono text-[0.6875rem] ${change.up ? "text-gain" : "text-accent"}`}
    >
      {change.up ? "▲" : "▼"} {change.text}
    </span>
  );
}

/**
 * One line under the chart saying what moved: "Output Y 200 → 233.3 ▲16.7%".
 * The figure cards say the same further down, but this puts the answer next to
 * the picture, where the eye already is when a slider moves.
 */
function ChangeSummary({ panel }: { panel: Panel }) {
  const moved = (panel.scalars ?? []).filter(
    (s) => s.previous !== undefined && Math.abs(s.value - s.previous) > 1e-9 * Math.max(1, Math.abs(s.previous)),
  );
  const shown = moved.slice(0, 4);
  // While a slider drags, the figures are re-eased every frame. Screen readers get
  // the sentence once the values settle, not thirty times a second.
  const sentence = shown
    .map((s) => `${s.label} ${fmtScalar(s.previous!, s.percent, 3)} to ${fmtScalar(s.value, s.percent, 3)}`)
    .join(", ");
  const [spoken, setSpoken] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSpoken(sentence), 600);
    return () => clearTimeout(timer);
  }, [sentence]);
  if (!moved.length) return <p className="sr-only" aria-live="polite">{spoken}</p>;
  return (
    <>
      <p className="sr-only" aria-live="polite">
        {spoken}
      </p>
      <div className="fade-in mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-accent/5 px-3 py-2 font-mono text-[0.75rem] text-ink">
        {shown.map((s) => (
          <span key={s.label} className="inline-flex items-baseline gap-1.5">
            <span className="text-muted">{s.label}</span>
            <span>
              {fmtScalar(s.previous!, s.percent, 3)} → {fmtScalar(s.value, s.percent, 3)}
            </span>
            <Delta value={s.value} previous={s.previous!} percent={s.percent} />
          </span>
        ))}
        {moved.length > shown.length && <span className="text-muted">+{moved.length - shown.length} more below</span>}
      </div>
    </>
  );
}

/** Renders one model output panel: charts, scalars, notes and the maths. */
export function PanelCard({
  panel,
  index = 0,
  chartControls,
  exportName,
  flat = false,
}: {
  panel: Panel;
  /** Drop the card frame, for a panel shown inside another card. */
  flat?: boolean;
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
  // A curve and its baseline twin share a group, and so a colour.
  const colors: Record<string, string> = {};
  const groups: string[] = [];
  source.forEach((s) => {
    const g = s.group ?? s.label;
    if (!groups.includes(g)) groups.push(g);
    colors[s.label] = SERIES_COLORS[groups.indexOf(g) % SERIES_COLORS.length];
  });
  const legend = source.length > 1 ? source.map((s) => ({ label: s.label, color: colors[s.label] })) : [];
  const visible = <T extends { label: string }>(series: T[]) => series.filter((s) => !hidden.includes(s.label));

  const chart = panel.chart ? { ...panel.chart, series: visible(panel.chart.series) } : undefined;
  const timeseries = panel.timeseries ? { ...panel.timeseries, series: visible(panel.timeseries.series) } : undefined;
  // The text alternative keeps every series, including any hidden from the legend:
  // hiding a line is a reading choice, not a reason to drop it from the data.
  const dataTable = panel.chart || panel.timeseries ? seriesToTable(panel.chart ?? panel.timeseries!) : undefined;

  return (
    <section
      className={flat ? "border-t border-hairline pt-4" : "card reveal p-5"}
      style={index && !flat ? { animationDelay: `${Math.min(index, 4) * 40}ms` } : undefined}
    >
      <h3 className="font-display text-lg font-semibold tracking-[-0.01em] text-ink">
        <SolidHyphens text={panel.title} />
      </h3>
      {panel.description && <p className="mt-1 text-sm leading-relaxed text-muted">{panel.description}</p>}

      {chartControls && <div className="mt-3">{chartControls}</div>}

      {(chart || timeseries) && (
        <div className="mt-3" ref={chartRef}>
          {chart ? <CurveChart spec={chart} colors={colors} /> : timeseries && <TimeSeriesChart spec={timeseries} colors={colors} />}
        </div>
      )}

      <ChangeSummary panel={panel} />

      {panel.table && <DataTable spec={panel.table} />}

      {dataTable && (
        <details className="disclosure mt-3">
          <summary className="cursor-pointer font-mono text-[0.75rem]  text-muted transition-colors hover:text-ink">
            Data table
          </summary>
          <DataTable spec={dataTable} />
        </details>
      )}

      {legend.length > 0 && (
        <div className="mt-3">
          <Legend labels={legend} hidden={hidden} onToggle={toggle} />
        </div>
      )}
      {legend.length > 0 && hidden.length >= legend.length && (
        <p className="mt-2 text-[0.6875rem] text-muted">
          Every line is hidden. Click a legend entry to bring it back.
        </p>
      )}

      {panel.scalars && panel.scalars.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {panel.scalars.map((s) => (
            <div
              key={s.label}
              className="min-w-0 rounded-lg border border-hairline bg-surface2/60 px-3 py-2.5 transition-colors hover:border-accent/40"
            >
              <dt className="flex flex-wrap items-center gap-x-1 break-words font-mono text-[0.75rem] leading-tight  text-muted">
                <span>{s.label}</span>
                {s.hint && <InfoNote help={s.hint} label={s.label} />}
              </dt>
              <dd className="mt-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 font-mono text-[0.9375rem] leading-tight text-ink">
                <AnimatedNumber value={s.value} percent={s.percent} />
                {s.previous !== undefined && <Delta value={s.value} previous={s.previous} percent={s.percent} />}
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
