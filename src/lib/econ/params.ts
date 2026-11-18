import type { Economy } from "./types";

/**
 * The economy's sliders: label, range, step, group and the explanation behind the
 * "i" button. They live here rather than in the Simulator so the engine tests can
 * check every model's parameter list against what the model actually reads.
 */
export interface ParamDef {
  key: keyof Economy;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
  help: string;
}

export const PARAMS: ParamDef[] = [
  { key: "A", label: "Technology A", min: 0.5, max: 2, step: 0.01, group: "Production", help: "Total factor productivity: how much output you get from a given amount of capital and labour. A higher A raises potential output." },
  { key: "alpha", label: "Capital share α", min: 0.1, max: 0.6, step: 0.01, group: "Production", help: "The share of income that goes to capital (about 0.33 in most countries). The rest, 1−α, is labour's share." },
  { key: "L", label: "Labour L", min: 10, max: 1000, step: 1, group: "Production", help: "The size of the workforce." },
  { key: "K0", label: "Initial capital K₀", min: 10, max: 2000, step: 1, group: "Production", help: "The starting capital stock. The Solow model grows it toward its steady state." },

  { key: "s", label: "Saving rate s", min: 0.05, max: 0.5, step: 0.01, group: "Growth (long run)", help: "The share of income households save. More saving builds more capital, but does not raise long-run growth per worker." },
  { key: "n", label: "Population growth n", min: -0.02, max: 0.05, step: 0.001, group: "Growth (long run)", help: "How fast the workforce grows. Higher n needs more investment just to keep capital per worker constant." },
  { key: "g", label: "Tech growth g", min: 0, max: 0.05, step: 0.001, group: "Growth (long run)", help: "How fast productivity improves over time." },
  { key: "delta", label: "Depreciation δ", min: 0.01, max: 0.15, step: 0.005, group: "Growth (long run)", help: "The share of the capital stock that wears out each period." },

  { key: "G", label: "Government G", min: 0, max: 100, step: 1, group: "Fiscal & money", help: "Government spending. Raising it shifts the IS curve right." },
  { key: "T", label: "Taxes T", min: 0, max: 100, step: 1, group: "Fiscal & money", help: "Lump-sum taxes. They reduce disposable income and shift the IS curve left." },
  { key: "M", label: "Money supply M", min: 10, max: 300, step: 1, group: "Fiscal & money", help: "How much money the central bank has supplied. Raising it shifts the LM curve right." },
  { key: "P", label: "Price level P", min: 0.5, max: 2, step: 0.01, group: "Fiscal & money", help: "Average prices. Real money balances are M/P." },

  { key: "c0", label: "Autonomous consumption c₀", min: 0, max: 50, step: 1, group: "Behaviour", help: "Consumption that happens regardless of income." },
  { key: "c1", label: "MPC c₁", min: 0.1, max: 0.95, step: 0.01, group: "Behaviour", help: "The marginal propensity to consume, the fraction of each extra unit of income that is spent. Higher c1 makes the IS curve flatter and the fiscal multiplier bigger." },
  { key: "I0", label: "Autonomous investment I₀", min: 0, max: 200, step: 1, group: "Behaviour", help: "Investment that happens regardless of the interest rate." },
  { key: "b", label: "Investment sensitivity b", min: 10, max: 500, step: 5, group: "Behaviour", help: "How strongly investment reacts to the interest rate." },
  { key: "kY", label: "Money demand k", min: 0.1, max: 1.5, step: 0.01, group: "Behaviour", help: "How much money people want to hold per unit of income. Higher k tilts the LM curve up." },
  { key: "hR", label: "Money demand h", min: 20, max: 500, step: 5, group: "Behaviour", help: "How strongly money demand falls as the interest rate rises. Higher h flattens the LM curve." },

  { key: "rStar", label: "World rate r*", min: 0, max: 0.1, step: 0.001, group: "Open economy", help: "The interest rate prevailing in world markets. A small open economy takes it as given." },
  { key: "rho", label: "Risk premium ρ", min: 0, max: 0.1, step: 0.001, group: "Open economy", help: "Extra yield investors demand to hold this country's assets, above the world rate." },
  { key: "pStar", label: "Foreign price level P*", min: 0.5, max: 2, step: 0.01, group: "Open economy", help: "The price level abroad, 1 in the baseline. Dearer imports (an oil shock) raise costs at home; in AD-AS they lower potential output." },
  { key: "energyShare", label: "Imported energy share σ", min: 0, max: 0.4, step: 0.01, group: "Open economy", help: "The share of production costs spent on imported energy. It decides how hard a rise in the foreign price P* (an oil shock) hits potential output: Yn falls by the factor P*^(−σ/(1−σ))." },
  { key: "X0", label: "Exports X₀", min: 0, max: 60, step: 1, group: "Open economy", help: "Autonomous exports: sales abroad independent of income and the exchange rate." },
  { key: "importProp", label: "Import propensity m", min: 0, max: 0.3, step: 0.005, group: "Open economy", help: "The fraction of each extra unit of income spent on imports." },
  { key: "fxSensitivity", label: "FX sensitivity v", min: 1, max: 40, step: 1, group: "Open economy", help: "How strongly net exports react to the real exchange rate." },
  { key: "kappa", label: "Capital mobility κ", min: 1, max: 100, step: 1, group: "Open economy", help: "How freely capital crosses the border. Small κ means a steeper BP curve (less mobile)." },
  { key: "fxPeg", label: "Peg level ε̄", min: 0.5, max: 1.5, step: 0.01, group: "Open economy", help: "The real exchange rate the central bank defends when the regime is Fixed." },

  { key: "lambda", label: "SRAS slope λ", min: 0.1, max: 2, step: 0.05, group: "Adjustment", help: "How far prices rise above expectations for each 1% that output is above potential. Low λ: a flat SRAS, sticky prices. High λ: a steep SRAS, flexible prices." },
  { key: "theta", label: "Expectations speed θ", min: 0.05, max: 1, step: 0.05, group: "Adjustment", help: "How quickly price expectations catch up to realised prices, and so how fast the economy returns to potential output. In the Phillips curve it also sets the sacrifice ratio 1/(βθ)." },

  { key: "gamma", label: "Demand response to the real rate γ_D", min: 0.1, max: 3, step: 0.05, group: "Adjustment", help: "Dornbusch: how strongly demand, and so prices, respond when the exchange rate is away from its long-run level, ṗ = θ·γ_D·(s + p* − p). Larger γ_D: prices catch up faster, the adjustment root |λ| grows, and the overshoot 1/(η·|λ|) shrinks." },

  { key: "piE", label: "Expected inflation πᵉ", min: 0, max: 0.2, step: 0.005, group: "Inflation & labour", help: "The inflation rate people expect, and the rate the economy starts at. A high πᵉ makes a disinflation expensive." },
  { key: "piTarget", label: "Inflation target π*", min: 0, max: 0.15, step: 0.005, group: "Inflation & labour", help: "What the central bank announces and delivers. The gap between πᵉ and π* is the size of the disinflation." },
  { key: "pcBeta", label: "Phillips slope β", min: 0.1, max: 1.5, step: 0.05, group: "Inflation & labour", help: "How strongly unemployment pushes inflation away from expectations. A steeper curve means a cheaper disinflation." },
  { key: "un", label: "Natural unemployment uₙ", min: 0.01, max: 0.2, step: 0.005, group: "Inflation & labour", help: "The unemployment rate that leaves inflation unchanged. The WS-PS model derives it; this slider overrides it for the Phillips curve." },
  { key: "wagePush", label: "Wage push z", min: 0, max: 0.15, step: 0.005, group: "Inflation & labour", help: "Benefits, union strength, minimum wages: anything that lets workers win a higher real wage at a given unemployment rate." },
  { key: "markup", label: "Firms' mark-up m", min: 0, max: 0.4, step: 0.005, group: "Inflation & labour", help: "The mark-up firms charge over marginal cost. It fixes the real wage they can pay, and so helps set the natural rate." },
  { key: "wageSlope", label: "Wage-setting slope γ", min: 0.3, max: 3, step: 0.05, group: "Inflation & labour", help: "How sharply the real wage workers can win falls as unemployment rises. A steeper curve means a lower natural rate." },

  { key: "debtRatio", label: "Debt ratio b₀", min: 0, max: 2, step: 0.05, group: "Debt & balance of payments", help: "Government debt as a share of GDP at the start." },
  { key: "primaryBalance", label: "Primary balance pb", min: -0.1, max: 0.1, step: 0.005, group: "Debt & balance of payments", help: "The budget balance excluding interest payments, as a share of GDP. Positive is a surplus; debt is stable only if pb covers (r − g)·b." },
  { key: "reservesShare", label: "Reserves (share of M)", min: 0.05, max: 0.95, step: 0.05, group: "Debt & balance of payments", help: "Foreign reserves as a share of the money supply. The rest of the money supply is domestic credit, which is what drains the reserves." },
  { key: "creditGrowth", label: "Domestic credit growth μ", min: 0, max: 0.4, step: 0.005, group: "Debt & balance of payments", help: "How fast the government borrows from the central bank. Financing a deficit this way is what dates the collapse of a peg." },
];

export const GROUP_ORDER = [
  "Production",
  "Growth (long run)",
  "Fiscal & money",
  "Behaviour",
  "Open economy",
  "Adjustment",
  "Inflation & labour",
  "Debt & balance of payments",
];

export const PARAM_BY_KEY: Partial<Record<keyof Economy, ParamDef>> = Object.fromEntries(PARAMS.map((p) => [p.key, p]));

/** Every key that has a slider. */
export const SLIDER_KEYS: (keyof Economy)[] = PARAMS.map((p) => p.key);

/** A model's sliders in sidebar order: its key ones first, then the rest by group. */
export function orderedParams(key: (keyof Economy)[], uses: (keyof Economy)[]): { key: ParamDef[]; more: ParamDef[] } {
  const keyDefs = key.map((k) => PARAM_BY_KEY[k]).filter((p): p is ParamDef => !!p);
  const more = PARAMS.filter((p) => uses.includes(p.key) && !key.includes(p.key)).sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
  );
  return { key: keyDefs, more };
}
