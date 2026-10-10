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
  scalars?: Scalar[];
  notes?: string[];
  trace: CalcStep[];
}
