/**
 * Export. Turn a panel — or a whole model view — into a CSV.
 *
 * The point is evidence rather than analysis: the app's whole claim is that it
 * shows the calculation it ran, and a student handing work in needs that
 * working in a file they can open, not a screenshot. So the trace goes in too,
 * after the figures it produced.
 *
 * The output is what a spreadsheet expects: one block per kind of content, a
 * header row on each, every field quoted. Values are written at full precision
 * — the figures are the evidence, so they are not rounded for display.
 */

import type { Panel } from "./panel";

/**
 * Excel needs the byte-order mark to read a UTF-8 file as UTF-8, and half the
 * labels here are Greek.
 */
const BOM = "\uFEFF";

/** Quote a CSV field, doubling any quotes inside it. */
function field(text: string): string {
  return `"${text.replace(/"/g, '""')}"`;
}

/** Full precision, without the float noise `toPrecision` leaves behind. */
function num(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toPrecision(12))) : "";
}

function csvRows(rows: string[][]): string {
  return rows.map((row) => row.map(field).join(",")).join("\r\n");
}

/** Everything one panel has to show, as CSV rows. */
function panelRows(panel: Panel): string[][] {
  const rows: string[][] = [[panel.title]];
  if (panel.description) rows.push([panel.description]);

  if (panel.scalars?.length) {
    rows.push([], ["Figure", "Value"]);
    for (const scalar of panel.scalars) rows.push([scalar.label, num(scalar.value)]);
  }

  if (panel.chart) {
    rows.push([], ["Curve", panel.chart.xLabel, panel.chart.yLabel]);
    for (const line of panel.chart.series) {
      for (const point of line.points) rows.push([line.label, num(point.x), num(point.y)]);
    }
  }

  if (panel.timeseries) {
    rows.push([], [panel.timeseries.xLabel, ...panel.timeseries.series.map((s) => s.label)]);
    // The series of a time path share one time axis, so the first series sets it.
    const steps = Math.max(0, ...panel.timeseries.series.map((s) => s.points.length));
    for (let i = 0; i < steps; i++) {
      rows.push([
        num(panel.timeseries.series[0]?.points[i]?.x ?? NaN),
        ...panel.timeseries.series.map((s) => num(s.points[i]?.y ?? NaN)),
      ]);
    }
  }

  if (panel.table) {
    // The table's row labels are its first column, which `columns` does not count.
    rows.push([], ["", ...panel.table.columns]);
    for (const row of panel.table.rows) rows.push([row.label, ...row.cells.map((c) => c.text)]);
    if (panel.table.caption) rows.push([panel.table.caption]);
  }

  if (panel.trace.length) {
    rows.push([], ["Step", "Value", "Note"]);
    for (const step of panel.trace) rows.push([step.label, num(step.value), step.note ?? ""]);
  }

  return rows;
}

/** One panel as a CSV file's contents. */
export function panelToCsv(panel: Panel): string {
  return BOM + csvRows(panelRows(panel));
}

/** Every panel of the current view in one file, separated by a blank line. */
export function panelsToCsv(panels: Panel[]): string {
  return BOM + panels.map((panel) => csvRows(panelRows(panel))).join("\r\n\r\n");
}

/** A safe file-name stem: no path characters, no spaces, no stray accents. */
export function exportName(...parts: string[]): string {
  const stem = parts
    .join("-")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return stem || "econosim";
}
