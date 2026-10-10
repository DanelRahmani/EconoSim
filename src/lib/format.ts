/** Human-friendly number formatting for display (not LaTeX). */
export function fmtNum(x: number, dp = 3): string {
  if (!Number.isFinite(x)) return "—";
  if (x !== 0 && (Math.abs(x) >= 1e6 || Math.abs(x) < 1e-3)) return x.toExponential(2);
  const r = Number(x.toFixed(dp));
  return String(r);
}

export function fmtPct(x: number, dp = 2): string {
  if (!Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(dp)}%`;
}
