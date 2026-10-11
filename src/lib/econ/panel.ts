import { fmtNum } from "../format";
import type { CalcStep } from "./trace";

export interface Point {
  x: number;
  y: number;
}

export interface LineSpec {
  label: string;
  points: Point[];
  /** Render as a dashed reference line (e.g. a baseline curve before a shock). */
  dashed?: boolean;
}

export interface MarkerSpec {
  x: number;
  y: number;
  label: string;
}

export interface ChartSpec {
  xLabel: string;
  yLabel: string;
  series: LineSpec[];
  markers?: MarkerSpec[];
}

export interface SeriesSpec {
  label: string;
  points: Point[];
  /** Render as a dashed reference line (e.g. a steady state or a baseline). */
  dashed?: boolean;
}

export interface TimeSeriesSpec {
  xLabel: string;
  yLabel: string;
  series: SeriesSpec[];
}

export interface Scalar {
  label: string;
  value: number;
  unit?: string;
  hint?: string;
  /** The same figure under the pinned baseline, when comparing. */
  previous?: number;
}

/** One cell of a panel table. */
export interface TableCell {
  text: string;
  /** Underline the cell — in a game matrix, this is a best response. */
  underline?: boolean;
  /** Tint the cell — a Nash equilibrium, or a figure being singled out. */
  emphasis?: boolean;
}

/**
 * A small table. Used by the 2×2 game matrix (best responses and Nash cells)
 * and by the market-structure comparison.
 */
export interface TableSpec {
  columns: string[];
  rows: { label: string; cells: TableCell[] }[];
  caption?: string;
}

/**
 * A self-contained unit of output. Every model returns a list of these, and
 * the UI renders them generically — charts, scalars, notes and the maths.
 */
export interface Panel {
  id: string;
  title: string;
  description?: string;
  chart?: ChartSpec;
  timeseries?: TimeSeriesSpec;
  table?: TableSpec;
  scalars?: Scalar[];
  notes?: string[];
  trace: CalcStep[];
}

/**
 * A chart's series as a table — the text alternative to the picture.
 *
 * When every series shares one x grid (the usual case: the models build their
 * curves with a shared `linspace`), the x values become the row labels and each
 * series a column. When they do not, the long form is used instead rather than
 * aligning points that were never meant to line up.
 */
export function seriesToTable(spec: ChartSpec | TimeSeriesSpec): TableSpec | undefined {
  const series = spec.series;
  if (!series.length) return undefined;
  const xLabel = spec.xLabel;
  const yLabel = "yLabel" in spec ? spec.yLabel : "";

  // Markers are information the picture carries and the plotted rows do not — the
  // current position, a steady state, the golden rule — so they go in the caption.
  const markers = "markers" in spec ? (spec.markers ?? []) : [];
  const marked = markers.length
    ? ` Marked: ${markers.map((m) => `${m.label} at (${fmtNum(m.x, 4)}, ${fmtNum(m.y, 4)})`).join("; ")}.`
    : "";

  const first = series[0].points;
  const sharesGrid = series.every(
    (line) =>
      line.points.length === first.length &&
      line.points.every((point, i) => Math.abs(point.x - first[i].x) <= 1e-9),
  );

  if (sharesGrid) {
    return {
      columns: series.map((line) => line.label),
      rows: first.map((point, i) => ({
        label: fmtNum(point.x, 4),
        cells: series.map((line) => ({ text: fmtNum(line.points[i].y, 4) })),
      })),
      caption: `${yLabel} against ${xLabel}, as plotted.${marked}`,
    };
  }

  return {
    columns: [xLabel, yLabel],
    rows: series.flatMap((line) =>
      line.points.map((point) => ({
        label: line.label,
        cells: [{ text: fmtNum(point.x, 4) }, { text: fmtNum(point.y, 4) }],
      })),
    ),
    caption: `Every point of every series, as plotted.${marked}`,
  };
}
