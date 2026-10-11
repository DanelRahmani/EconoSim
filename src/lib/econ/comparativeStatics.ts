/**
 * Comparative statics — the classic "G↑ ⇒ Y↑, r↑, I↓" grid.
 *
 * The model is re-run twice with one parameter nudged down and up by a small ε,
 * and every figure the model already reports is tabulated against its base
 * value. Nothing new is derived here: the rows are the model's own scalars, so
 * this table cannot disagree with the panels above it.
 *
 * Only the *direction* is ever claimed, so ε is deliberately small (1% of the
 * current value). It is a local derivative read off two real runs rather than a
 * symbolic one, which is why the table keeps both middle columns and the trace
 * keeps the subtraction: the reader can check the arrow instead of trusting it.
 */

import { fmtNum } from "../format";
import { defaultEconomy } from "./defaults";
import { linspace } from "./math";
import type { Panel, TableCell, TableSpec } from "./panel";
import { runModel, type RunOptions } from "./registry";
import { Tracer } from "./trace";
import { validateEconomy, type Economy, type SweepParam } from "./types";

/**
 * The numeric parameters an economy has, derived from the defaults so the list
 * cannot drift from the `Economy` shape. The permalink guard reads this, which
 * is what stops a hand-edited link naming something unsweepable.
 */
export const SWEEPABLE: (keyof Economy)[] = Object.entries(defaultEconomy())
  .filter(([, value]) => typeof value === "number")
  .map(([key]) => key as keyof Economy);

export interface SweepArgs {
  modelId: string;
  /** Model name for the prose, e.g. "IS-LM". */
  modelLabel: string;
  economy: Economy;
  options: RunOptions;
  param: SweepParam;
  /** Parameter name for the prose and the column headers, e.g. "Government G". */
  paramLabel?: string;
}

/** One figure of the model, followed across the three runs. */
interface Row {
  label: string;
  panel: string;
  base?: number;
  low?: number;
  high?: number;
}

const ARROW = { up: "▲", down: "▼", same: "=", missing: "—" } as const;

/** Sign of the change from `base` to `moved`, with a relative tolerance. */
function arrow(base: number | undefined, moved: number | undefined): string {
  if (base === undefined || moved === undefined) return ARROW.missing;
  const difference = moved - base;
  if (Math.abs(difference) <= 1e-9 * Math.max(1, Math.abs(base))) return ARROW.same;
  return difference > 0 ? ARROW.up : ARROW.down;
}

/**
 * Build the comparative-statics panel for one model and one parameter.
 * Returns null when there is nothing to sweep.
 */
export function sweepPanel(args: SweepArgs): Panel | null {
  const { modelId, modelLabel, economy, options, param } = args;
  if (param === "none") return null;
  const value = economy[param];
  if (typeof value !== "number" || !Number.isFinite(value)) return null;

  const name = args.paramLabel ?? String(param);
  const step = Math.abs(value) > 1e-9 ? Math.abs(value) * 0.01 : 0.01;
  const lowValue = value - step;
  const highValue = value + step;

  // A nudge that trips a range guard is dropped rather than clamped to the
  // bound: clamping would report a direction for a step that never happened.
  const baseIssues = new Set(validateEconomy(economy).map((issue) => issue.message));
  const skipped: string[] = [];

  const runAt = (candidate: number, side: "lower" | "higher"): Panel[] | undefined => {
    const economyAt = { ...economy, [param]: candidate } as Economy;
    const fresh = validateEconomy(economyAt)
      .map((issue) => issue.message)
      .filter((message) => !baseIssues.has(message));
    if (fresh.length) {
      skipped.push(`${name} cannot move ${side} by ε from here — ${fresh[0]}.`);
      return undefined;
    }
    try {
      return runModel(modelId, economyAt, options);
    } catch {
      skipped.push(`The model could not be computed with ${name} ${side} by ε.`);
      return undefined;
    }
  };

  const base = safeRun(modelId, economy, options);
  const low = runAt(lowValue, "lower");
  const high = runAt(highValue, "higher");

  // Collect by panel id *and* figure name: the model is the same in all three
  // runs, so the keys line up, and every figure it reports at *any* value is
  // kept — a collapse date that only exists once reserves are short is exactly
  // the sort of thing this table should show appearing.
  const rows = new Map<string, Row>();
  const collect = (panels: Panel[] | undefined, field: "base" | "low" | "high") => {
    for (const panel of panels ?? []) {
      for (const scalar of panel.scalars ?? []) {
        const key = `${panel.id}::${scalar.label}`;
        const row = rows.get(key) ?? { label: scalar.label, panel: panel.title };
        row[field] = scalar.value;
        rows.set(key, row);
      }
    }
  };
  collect(base, "base");
  collect(low, "low");
  collect(high, "high");

  if (rows.size === 0) return null;

  const repeated = new Set(
    [...rows.values()]
      .map((row) => row.label)
      .filter((label, _, all) => all.filter((other) => other === label).length > 1),
  );

  const table: TableSpec = {
    columns: [`${name} − ε`, "Base", `${name} + ε`, "Direction"],
    rows: [...rows.values()].map((row) => ({
      label: repeated.has(row.label) ? `${row.panel} — ${row.label}` : row.label,
      cells: [
        cell(row.low),
        cell(row.base),
        cell(row.high),
        { text: arrow(row.base, row.high), emphasis: arrow(row.base, row.high) !== ARROW.same },
      ],
    })),
    caption:
      `ε = ${fmtNum(step, 4)} — 1% of ${name}. Each column is the same model re-run with that one ` +
      `parameter moved, so every cell is a real figure rather than a derivative. The direction ` +
      `column is the sign of the ${name} + ε column against the base.`,
  };

  const notes = [
    "Only the direction is the claim. ε is small, so this is the local answer — a figure that falls at +1% can still turn round for a large enough change.",
  ];
  if ([...rows.values()].some((row) => row.base === undefined || row.low === undefined || row.high === undefined)) {
    notes.push(
      "A — means the model does not report that figure at that parameter value at all, rather than that it is zero.",
    );
  }
  notes.push(...skipped, `${modelLabel} is re-run three times for this panel, on the current economy.`);

  const tracer = new Tracer();
  tracer.step(`${name} step ε`, step, undefined, undefined, "1% of the current value, applied to either side");
  if (low) tracer.step(`${name} − ε`, lowValue, undefined, undefined, "The lower value the model was re-run at");
  if (high) tracer.step(`${name} + ε`, highValue, undefined, undefined, "The higher value the model was re-run at");
  for (const row of rows.values()) {
    if (row.base !== undefined && row.high !== undefined && row.high !== row.base) {
      tracer.step(
        `Δ ${row.label}`,
        row.high - row.base,
        undefined,
        undefined,
        `${row.label} at ${name} + ε, less its value at the base`,
      );
    }
  }

  return {
    id: `sweep-${String(param)}`,
    title: `Comparative statics — ${name}`,
    description:
      `What moves in ${modelLabel} when ${name} rises by a hair, and what does not. ` +
      `Read the arrows as “${name}↑ ⇒ …”.`,
    table,
    notes,
    trace: tracer.steps,
  };
}

/** Run the model, or undefined if the parameters leave it uncomputable. */
function safeRun(modelId: string, economy: Economy, options: RunOptions): Panel[] | undefined {
  try {
    return runModel(modelId, economy, options);
  } catch {
    return undefined;
  }
}

/** Every figure a model reports, by name. The first panel to report a name wins. */
function figuresOf(panels: Panel[] | undefined): Map<string, number> {
  const out = new Map<string, number>();
  for (const panel of panels ?? []) {
    for (const scalar of panel.scalars ?? []) if (!out.has(scalar.label)) out.set(scalar.label, scalar.value);
  }
  return out;
}

export interface SweepAxisArgs {
  modelId: string;
  /** Model name for the prose, e.g. "Solow-Swan". */
  modelLabel: string;
  economy: Economy;
  options: RunOptions;
  param: SweepParam;
  /** Parameter name for the axis label and the prose. */
  paramLabel?: string;
  /** The slider's own range, so the sweep covers what the UI can reach. */
  range: [number, number];
  /** Which figure to plot; the model's first reported figure when absent or unknown. */
  figure?: string;
  /** How many values to sample. Odd, so the current value is usually on the grid. */
  samples?: number;
}

/**
 * A figure plotted against one parameter, sampled across that parameter's range.
 *
 * This is the "which saving rate maximises steady-state consumption" question:
 * one endogenous variable on the y-axis, a parameter on the x-axis, and the
 * turning point marked. It complements the comparative-statics table, which
 * gives the *direction* of every figure at ±ε; this gives the *shape* of one.
 *
 * The sweep only samples a grid, so the marked high point is the highest
 * *sampled* value and the note says so rather than implying an exact optimum.
 */
export function sweepAxisPanel(args: SweepAxisArgs): Panel | null {
  const { modelId, modelLabel, economy, options, param } = args;
  if (param === "none") return null;
  const baseValue = economy[param];
  if (typeof baseValue !== "number" || !Number.isFinite(baseValue)) return null;

  const [lo, hi] = args.range;
  if (!(hi > lo)) return null;

  const name = args.paramLabel ?? String(param);
  const baseIssues = new Set(validateEconomy(economy).map((issue) => issue.message));
  const baseFigures = figuresOf(safeRun(modelId, economy, options));
  if (baseFigures.size === 0) return null;

  const figure = args.figure && baseFigures.has(args.figure) ? args.figure : [...baseFigures.keys()][0];
  const samples = Math.max(5, args.samples ?? 41);

  const points: { x: number; y: number }[] = [];
  let skipped = 0;
  for (const value of linspace(lo, hi, samples)) {
    const candidate = { ...economy, [param]: value } as Economy;
    const fresh = validateEconomy(candidate)
      .map((issue) => issue.message)
      .filter((message) => !baseIssues.has(message));
    const reported = fresh.length ? undefined : figuresOf(safeRun(modelId, candidate, options)).get(figure);
    if (reported === undefined || !Number.isFinite(reported)) {
      skipped += 1;
      continue;
    }
    points.push({ x: value, y: reported });
  }
  if (points.length < 2) return null;

  const ends = [points[0].y, points[points.length - 1].y];
  const highest = points.reduce((best, point) => (point.y > best.y ? point : best));
  const turning = highest.x > points[0].x && highest.x < points[points.length - 1].x && highest.y > Math.max(...ends);
  const current = baseFigures.get(figure);

  const markers = [
    ...(current === undefined ? [] : [{ x: baseValue, y: current, label: "current" }]),
    ...(turning ? [{ x: highest.x, y: highest.y, label: "highest" }] : []),
  ];

  const tracer = new Tracer();
  tracer.step(`${name} sampled from`, lo, undefined, undefined, "The lower end of this parameter's slider");
  tracer.step(`${name} sampled to`, hi, undefined, undefined, "The upper end of the slider");
  if (skipped) {
    tracer.step("Values not computable", skipped, undefined, undefined, "Left out rather than drawn as a gap");
  }
  tracer.step(`Highest ${figure} in the sweep`, highest.y);
  if (turning) {
    tracer.step(
      `${name} at that high point`,
      highest.x,
      undefined,
      undefined,
      `The answer to "which ${name} gives the most ${figure}" — to the nearest sampled value`,
    );
  }

  return {
    id: `sweep-axis-${String(param)}`,
    title: `${figure} against ${name}`,
    description:
      `One figure of ${modelLabel}, re-run across the whole range of ${name} with everything else held fixed. ` +
      (turning
        ? `The curve turns: it peaks inside the range, which is the answer to "which ${name} gives the most ${figure}".`
        : `The curve is monotone over this range, so no interior turning point exists here.`),
    chart: {
      xLabel: name,
      yLabel: figure,
      series: [{ label: figure, points }],
      markers: markers.length ? markers : undefined,
    },
    scalars: [
      { label: `Highest ${figure}`, value: highest.y },
      ...(turning ? [{ label: `${name} there`, value: highest.x, hint: "The nearest sampled value, not an exact optimum" }] : []),
      ...(current === undefined ? [] : [{ label: `At the current ${name}`, value: current }]),
    ],
    notes: [
      "Everything except this parameter is held fixed, so this is the shape of the model's own response rather than a forecast.",
      `Sampled at ${samples} values, so read the turning point as the nearest sample${skipped ? `, and note ${skipped} left out as not computable` : ""}.`,
    ],
    trace: tracer.steps,
  };
}

/** A cell showing a figure, or a dash when the model does not report it. */
function cell(value: number | undefined): TableCell {
  return { text: value === undefined ? ARROW.missing : fmtNum(value, 4) };
}
