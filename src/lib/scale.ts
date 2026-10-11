import type { Point } from "./econ/panel";

/**
 * Axis domains and zoom windows for the charts.
 *
 * Kept out of the component rather than inlined, for one reason: the rules below
 * are checkable, and an axis that misstates its range is a wrong answer rather
 * than a cosmetic flaw. Everything a student reads off these charts is read off
 * an axis.
 */

/** Breathing room beyond the data at each end, as a fraction of the span. */
const DEFAULT_PAD = 0.08;

/**
 * A `[min, max]` range covering `values`, with a little room at both ends.
 *
 * Data that is entirely non-negative is never padded below zero. A quantity —
 * capital, output, units of a good — has no negative region, and drawing one puts
 * the origin off the left or bottom edge where the eye lands first: the
 * Cobb-Douglas chart was opening its x-axis at −63 because its data ran 1 to 800,
 * and the phase diagram likewise at −0.9.
 *
 * Two cases deliberately keep their old behaviour. Data that genuinely crosses
 * zero is padded both ways, since the sign change is the thing being shown. And a
 * range that starts well above zero keeps its zoom instead of being stretched
 * down to the origin, which would flatten an interest-rate axis to a straight line.
 *
 * A flat series is the third case, and the only one that can put a negative
 * figure on a quantity axis: a line that does not vary needs a window to be
 * visible at all, so it gets a symmetric one. That only bites when a whole panel
 * is flat — a flat series drawn *alongside* a varying one is clamped with the
 * rest, which is the usual shape (the AK model's dashed "No growth" baseline).
 */
export function axisDomain(values: number[], pad = DEFAULT_PAD): [number, number] {
  const finite = values.filter(Number.isFinite);
  if (!finite.length) return [0, 1];

  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) {
    // A single value, or a flat series: it needs a window to sit in.
    lo -= 1;
    hi += 1;
  }

  const room = (hi - lo) * pad;
  return [lo >= 0 ? Math.max(0, lo - room) : lo - room, hi + room];
}

/** A range on one axis, as `[min, max]`. */
export type Window = [number, number];

/** The smallest window worth honouring, as a fraction of the full range. */
const MIN_FRACTION = 1e-3;

/**
 * Fit a window inside `full`, or null when that would collapse it.
 *
 * A collapsed window is the interesting failure: it happens when a zoom is left
 * over from a different model, or when a drag selects no width at all, and the
 * honest answer is to show everything rather than an empty frame.
 */
export function clampWindow(win: Window, full: Window): Window | null {
  const lo = Math.max(full[0], Math.min(win[0], win[1]));
  const hi = Math.min(full[1], Math.max(win[0], win[1]));
  if (!(hi - lo >= (full[1] - full[0]) * MIN_FRACTION)) return null;
  return [lo, hi];
}

/**
 * Zoom a window about its centre: a factor below 1 zooms in, above 1 zooms out.
 *
 * Zooming out past the data gives back the whole range. Zooming in past the
 * minimum keeps the current window rather than falling back to the full range,
 * which would make a tenth press of "+" jump all the way back out.
 */
export function zoomWindow(win: Window, full: Window, factor: number): Window {
  const centre = (win[0] + win[1]) / 2;
  const half = ((win[1] - win[0]) * factor) / 2;
  return clampWindow([centre - half, centre + half], full) ?? win;
}

/**
 * The points inside a window, plus the nearest point on either side.
 *
 * The neighbours matter: without them a zoomed curve stops short of the frame
 * and the picture appears to end in mid-air.
 */
export function pointsInWindow(points: Point[], win: Window): Point[] {
  const ordered = points
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.x - b.x);
  const kept: Point[] = [];
  let before: Point | undefined;
  let after: Point | undefined;
  for (const point of ordered) {
    if (point.x < win[0]) {
      before = point;
      continue;
    }
    if (point.x <= win[1]) {
      kept.push(point);
      continue;
    }
    after = point;
    break;
  }
  if (!kept.length) return [];
  if (before) kept.unshift(before);
  if (after) kept.push(after);
  return kept;
}
