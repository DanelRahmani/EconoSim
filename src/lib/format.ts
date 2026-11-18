/** Human-friendly number formatting for display (not LaTeX). */
export function fmtNum(x: number, dp = 3): string {
  if (!Number.isFinite(x)) return "n/a";
  if (x !== 0 && (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-3)) return x.toExponential(2);
  const r = Number(x.toFixed(dp));
  return String(r);
}

/** A figure as the panels show it: a rate stored as 0.032 reads "3.2%". */
export function fmtScalar(x: number, percent = false, dp = 4): string {
  if (!percent) return fmtNum(x, dp);
  if (!Number.isFinite(x)) return "n/a";
  return `${Number((x * 100).toFixed(2))}%`;
}

/**
 * How far a figure moved, in words a reader can trust.
 *  - A rate or share moves in percentage points: 3.2% → 8.7% is "+5.5 pp", not "+172%".
 *  - A figure that starts at zero or changes sign has no meaningful percentage
 *    change (an output gap going from −0.3 to +1.3 is not "+530%"), so the
 *    absolute change is shown instead.
 *  - Everything else moves by a percentage of where it started.
 */
export function describeChange(value: number, previous: number, percent = false): { up: boolean; text: string } | null {
  const diff = value - previous;
  if (!Number.isFinite(diff) || Math.abs(diff) < 1e-9 * Math.max(1, Math.abs(previous))) return null;
  const up = diff > 0;
  if (percent) return { up, text: `${Number(Math.abs(diff * 100).toFixed(2))} pp` };
  const crosses = Math.abs(previous) < 1e-9 || Math.sign(value) * Math.sign(previous) < 0;
  if (crosses) return { up, text: fmtNum(Math.abs(diff), 3) };
  return { up, text: `${Math.abs((diff / Math.abs(previous)) * 100).toFixed(1)}%` };
}

export function fmtPct(x: number, dp = 2): string {
  if (!Number.isFinite(x)) return "n/a";
  return `${(x * 100).toFixed(dp)}%`;
}
