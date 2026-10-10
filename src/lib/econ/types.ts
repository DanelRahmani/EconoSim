/**
 * Core economy configuration shared by every model in EconoSim.
 *
 * All quantities are dimensionless / indexed (base year = 100) so the app is
 * currency-agnostic. Prices are indexed to 1 unless the user changes them.
 */

export type ExchangeRegime = "floating" | "fixed";
export type CountrySize = "small" | "large";
export type Openness = "closed" | "open";

export interface Economy {
  name: string;

  // Production:  Y = A * K^alpha * L^(1-alpha)
  A: number; // total factor productivity
  alpha: number; // capital share, 0 < alpha < 1
  L: number; // labour force
  K0: number; // initial capital stock

  // Long-run growth (Solow-Swan)
  s: number; // saving rate, 0 < s < 1
  n: number; // population growth
  g: number; // technological progress
  delta: number; // depreciation

  // Fiscal
  G: number; // government spending
  T: number; // lump-sum taxes

  // Money market:  M / P = kY * Y - hR * r
  M: number; // money supply
  P: number; // price level
  kY: number; // income sensitivity of money demand
  hR: number; // interest sensitivity of money demand

  // Behaviour:  C = c0 + c1 * (Y - T) ;  I = I0 - b * r
  c0: number;
  c1: number; // marginal propensity to consume, 0 < c1 < 1
  I0: number;
  b: number; // investment sensitivity to the interest rate

  // Open economy
  openness: Openness;
  size: CountrySize;
  regime: ExchangeRegime;
  rStar: number; // world interest rate
  rho: number; // sovereign / country risk premium
  pStar: number; // foreign price level
  foreignIncome: number;
  X0: number; // autonomous exports
  importProp: number; // marginal propensity to import (m)
  fxSensitivity: number; // real-exchange-rate sensitivity of net exports (v)
  kappa: number; // degree of capital mobility (large country, finite BP slope)
  fxPeg: number; // the pegged real exchange rate when regime === "fixed"

  // Adjustment / expectations
  lambda: number; // SRAS slope (price flexibility)
  theta: number; // expectations-adjustment speed
  gamma: number; // output response to real depreciation (Dornbusch)
  piE: number; // expected inflation
}

export interface ValidationIssue {
  field: keyof Economy | "regime";
  message: string;
}

/**
 * Validate an economy at the trust boundary before it reaches the engine.
 *
 * Catches impossible parameters (negative capital, alpha outside (0,1)) that
 * would otherwise produce NaN curves that silently render as an empty chart.
 */
export function validateEconomy(e: Economy): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const positive: (keyof Economy)[] = ["A", "L", "K0", "delta", "hR", "b", "kappa", "lambda", "theta"];
  for (const k of positive) {
    const v = e[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
      issues.push({ field: k, message: `${k} must be a positive number` });
    }
  }
  const unit = (k: keyof Economy) => {
    const v = e[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0 || v >= 1) {
      issues.push({ field: k, message: `${k} must be between 0 and 1` });
    }
  };
  unit("alpha");
  unit("c1");
  unit("s");
  if (e.n + e.g + e.delta <= 0) {
    issues.push({ field: "n", message: "n + g + delta must be positive" });
  }
  if (e.c1 >= 1) issues.push({ field: "c1", message: "c1 must be less than 1" });
  return issues;
}
