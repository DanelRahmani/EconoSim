/** Small numeric helpers for the simulation engine. No dependencies. */

/** Solve A x = b with Gaussian elimination and partial pivoting. Null if singular. */
export function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = col + 1; r < n; r++) {
      const f = M[r][col] / M[col][col];
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c++) sum -= M[r][c] * x[c];
    x[r] = sum / M[r][r];
  }
  return x;
}

/** Classic 4th-order Runge-Kutta for a scalar ODE dy/dt = f(t, y). */
export function rk4(
  f: (t: number, y: number) => number,
  y0: number,
  t0: number,
  t1: number,
  steps: number,
): { t: number; y: number }[] {
  const h = (t1 - t0) / steps;
  const out: { t: number; y: number }[] = [{ t: t0, y: y0 }];
  let t = t0;
  let y = y0;
  for (let i = 0; i < steps; i++) {
    const k1 = f(t, y);
    const k2 = f(t + h / 2, y + (h * k1) / 2);
    const k3 = f(t + h / 2, y + (h * k2) / 2);
    const k4 = f(t + h, y + h * k3);
    y += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    t += h;
    out.push({ t, y });
  }
  return out;
}

/** Bisection root-finder on [a, b]. Assumes f(a) and f(b) bracket a root. */
export function bisection(
  f: (x: number) => number,
  a: number,
  b: number,
  tol = 1e-10,
  maxIter = 200,
): number {
  let lo = a;
  let hi = b;
  let fLo = f(lo);
  const fHi = f(hi);
  if (fLo === 0) return lo;
  if (fHi === 0) return hi;
  if (fLo * fHi > 0) {
    // No guaranteed bracket; nudge to the closer endpoint rather than throw.
    return Math.abs(fLo) < Math.abs(fHi) ? lo : hi;
  }
  for (let i = 0; i < maxIter; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if (Math.abs(fMid) < tol || (hi - lo) / 2 < tol) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

export function linspace(a: number, b: number, n: number): number[] {
  if (n <= 1) return [a];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(a + ((b - a) * i) / (n - 1));
  return out;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

export function round(x: number, dp = 4): number {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
}
