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

  // Labour market (WS-PS)
  un: number; // natural rate of unemployment
  wagePush: number; // wage-push factors z (benefits, union power, minimum wage)
  markup: number; // price-setting mark-up m
  wageSlope: number; // how strongly the real wage responds to unemployment γ

  // Inflation
  pcBeta: number; // Phillips-curve slope β
  piTarget: number; // inflation target announced by the central bank

  // Fiscal
  debtRatio: number; // starting government debt, as a ratio to GDP
  primaryBalance: number; // primary balance, as a ratio to GDP (positive = surplus)

  // Balance of payments
  reservesShare: number; // foreign reserves as a share of the money supply
  creditGrowth: number; // growth rate of domestic credit μ
}

/**
 * Scenario settings for the AI boom model. These live outside `Economy`
 * because they describe a hypothetical, not the economy as it stands.
 */
export interface AiOptions {
  /** Share of labour tasks AI performs, in percent (0–95). */
  substitutionPct: number;
  /** AI capital installed per displaced worker, as a multiple of the economy's capital–labour ratio. */
  capitalIntensity: number;
  /** Productivity of AI capital relative to ordinary capital (1 = like-for-like). */
  capitalProductivity: number;
}

/**
 * Whether a disinflation is believed immediately or has to be earned.
 * This is the whole teaching point of the Phillips-curve model, so it is a
 * switch rather than a slider.
 */
export type Expectations = "adaptive" | "credible";

/** The same union as a runtime list, so guards stay in step with it. */
export const EXPECTATION_MODES: Expectations[] = ["adaptive", "credible"];

/** Textbook micro dials. They describe a single market, not the whole economy. */
export interface MicroOptions {
  /** Price of good x. */
  px: number;
  /** Price of good y. */
  py: number;
  /** Income. */
  income: number;
  /** Preference weight on x in U = x^α·y^(1−α). */
  weight: number;
}

/** Market-structure dials: demand P = a − b·Q and a constant marginal cost. */
export interface MarketOptions {
  /** Demand intercept a. */
  demandA: number;
  /** Demand slope b. */
  demandB: number;
  /** Constant marginal cost. */
  mc: number;
  /** Fixed cost. */
  fixed: number;
}

/** Externality dials: the wedge between private and social cost, and the tax that closes it. */
export interface ExternalityOptions {
  /** Marginal external cost per unit (negative for an external benefit). */
  external: number;
  /** Pigouvian tax per unit. */
  tax: number;
}

/** Which 2×2 game to play, and the temptation payoff that makes it a dilemma. */
export interface GameOptions {
  game: "prisoners" | "coordination" | "chicken" | "matching";
  /** Payoff to defecting against a cooperator (the source of the dilemma). */
  temptation: number;
}

/** Size of the negative demand shock used by the zero-lower-bound model. */
export interface ZlbOptions {
  /** Demand contraction, as a fraction of potential output. */
  demandShock: number;
}

/**
 * Which `Economy` parameter the comparative-statics panel nudges, or "none" to
 * leave the panel off. It lives in `RunOptions` because it changes nothing
 * about the economy — it only asks a different question of the same model.
 */
export type SweepParam = keyof Economy | "none";

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
  const positive: (keyof Economy)[] = [
    "A",
    "L",
    "K0",
    "delta",
    "hR",
    "b",
    "kappa",
    "lambda",
    "theta",
    "pcBeta",
    "wageSlope",
  ];
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
  unit("un");
  if (e.n + e.g + e.delta <= 0) {
    issues.push({ field: "n", message: "n + g + delta must be positive" });
  }
  if (e.c1 >= 1) issues.push({ field: "c1", message: "c1 must be less than 1" });
  return issues;
}
