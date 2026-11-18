import type { LineSpec, MarkerSpec, Panel, Point } from "./panel";

/** What the two states are called on the chart: "AD (shock)" against "AD (base)". */
export interface CompareTags {
  current: string;
  base: string;
}

export const SHOCK_TAGS: CompareTags = { current: "shock", base: "base" };
export const CHANGE_TAGS: CompareTags = { current: "new", base: "base" };

/**
 * Two lines are the same picture when every point of each lies on the other.
 *
 * Point-by-point equality is not enough: a model may sample the same curve on a
 * different grid once the equilibrium moves (AD-AS draws AD over prices around
 * the new equilibrium), and an unchanged AD then showed up as "moved". So each
 * point is measured against the other line's segments, in coordinates scaled to
 * the pair's joint extent, and only the overlapping stretch is compared.
 */
export function sameLine(a: Point[], b: Point[]): boolean {
  const fa = a.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const fb = b.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (fa.length < 2 || fb.length < 2) return fa.length === fb.length && fa.every((p, i) => p.x === fb[i].x && p.y === fb[i].y);
  const all = [...fa, ...fb];
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const sx = Math.max(...xs) - Math.min(...xs) || 1;
  const sy = Math.max(...ys) - Math.min(...ys) || 1;
  const tol = 1e-4;

  // Fast path: the same grid of x values (the usual case, one linspace) is
  // compared point by point. It runs on every slider movement, so the geometric
  // check below is kept for lines that were genuinely resampled.
  if (fa.length === fb.length && fa.every((p, i) => Math.abs(p.x - fb[i].x) <= tol * sx)) {
    return fa.every((p, i) => Math.abs(p.y - fb[i].y) <= tol * sy);
  }
  // Otherwise compare a bounded sample of each line against the other: enough to
  // tell a moved curve from a resampled one, at a fixed cost.
  const sample = (pts: Point[]) => (pts.length <= 40 ? pts : Array.from({ length: 40 }, (_, k) => pts[Math.round((k * (pts.length - 1)) / 39)]));

  const onLine = (p: Point, line: Point[]) => {
    let best = Infinity;
    for (let i = 1; i < line.length; i++) {
      const ax = line[i - 1].x / sx, ay = line[i - 1].y / sy;
      const bx = line[i].x / sx, by = line[i].y / sy;
      const px = p.x / sx, py = p.y / sy;
      const dx = bx - ax, dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
    }
    return best <= tol;
  };
  // Compare where both lines are drawn; a curve sampled over a wider range is still the same curve.
  const lo = Math.max(Math.min(...fa.map((p) => p.x)), Math.min(...fb.map((p) => p.x)));
  const hi = Math.min(Math.max(...fa.map((p) => p.x)), Math.max(...fb.map((p) => p.x)));
  const inA = fa.filter((p) => p.x >= lo && p.x <= hi);
  const inB = fb.filter((p) => p.x >= lo && p.x <= hi);
  if (!inA.length && !inB.length) return false;
  return sample(inA).every((p) => onLine(p, fb)) && sample(inB).every((p) => onLine(p, fa));
}

/**
 * Pair each current line with its baseline twin. A pair that moved is shown as
 * "AD (shock)" solid and "AD (base)" dashed, in the same colour (`group`), so the
 * eye reads one curve shifting rather than two unrelated lines. A line that did
 * not move is shown once, under its plain name: a dashed copy hidden exactly
 * underneath it only made the chart look broken.
 */
function pairLines<T extends LineSpec>(current: T[], base: T[], tags: CompareTags): T[] {
  const out: T[] = [];
  const ghosts: T[] = [];
  for (const line of current) {
    const twin = base.find((b) => b.label === line.label);
    if (!twin || sameLine(line.points, twin.points)) {
      out.push({ ...line, group: line.label });
      continue;
    }
    out.push({ ...line, label: `${line.label} (${tags.current})`, group: line.label });
    ghosts.push({ ...twin, label: `${twin.label} (${tags.base})`, group: twin.label, dashed: true, ghost: true });
  }
  return [...out, ...ghosts];
}

/** The baseline's markers that moved, drawn hollow: where the equilibrium was. */
function ghostMarkers(current: MarkerSpec[] = [], base: MarkerSpec[] = [], tags: CompareTags): MarkerSpec[] {
  const moved = base.filter((b) => {
    const now = current.find((c) => c.label === b.label);
    return !now || Math.abs(now.x - b.x) > 1e-9 * Math.max(1, Math.abs(b.x)) || Math.abs(now.y - b.y) > 1e-9 * Math.max(1, Math.abs(b.y));
  });
  return [
    ...current.map((m) => (moved.some((b) => b.label === m.label) ? { ...m, label: `${m.label} (${tags.current})` } : m)),
    ...moved.map((m) => ({ ...m, label: `${m.label} (${tags.base})`, ghost: true })),
  ];
}

/**
 * Merge a baseline run into the current run so panels show both states at once:
 * moved curves are paired with their dashed baseline, moved equilibria get a
 * hollow marker where they were, and each scalar carries its baseline value.
 */
export function mergePanels(current: Panel[], baseline: Panel[], tags: CompareTags = CHANGE_TAGS): Panel[] {
  return current.map((p) => {
    const b = baseline.find((x) => x.id === p.id);
    if (!b) return p;

    const chart =
      p.chart && b.chart
        ? { ...p.chart, series: pairLines(p.chart.series, b.chart.series, tags), markers: ghostMarkers(p.chart.markers, b.chart.markers, tags) }
        : p.chart;

    const timeseries =
      p.timeseries && b.timeseries
        ? { ...p.timeseries, series: pairLines(p.timeseries.series, b.timeseries.series, tags) }
        : p.timeseries;

    const scalars = p.scalars?.map((s) => {
      const prev = b.scalars?.find((x) => x.label === s.label);
      return prev ? { ...s, previous: prev.value } : s;
    });

    return { ...p, chart, timeseries, scalars };
  });
}
