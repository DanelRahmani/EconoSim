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
