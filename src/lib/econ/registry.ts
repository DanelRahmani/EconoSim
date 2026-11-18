import type {
  AiOptions,
  Economy,
  ExternalityOptions,
  Expectations,
  GameOptions,
  MarketOptions,
  MicroOptions,
  SweepParam,
  TradeOptions,
  ZlbOptions,
} from "./types";
import type { Panel } from "./panel";
import { cobbDouglas } from "./models/cobbDouglas";
import { solow } from "./models/solow";
import { akGrowth } from "./models/akGrowth";
import { islm } from "./models/islm";
import { adas } from "./models/adas";
import { zlb } from "./models/zlb";
import { phillips } from "./models/phillips";
import { labourMarket } from "./models/labourMarket";
import { debtDynamics } from "./models/debtDynamics";
import { currencyCrisis } from "./models/currencyCrisis";
import { mundellFleming } from "./models/mundellFleming";
import { parity } from "./models/parity";
import { dornbuschPanel } from "./models/dornbusch";
import { externalBalance } from "./models/externalBalance";
import { tradeFlows } from "./models/tradeFlows";
import { policyRule } from "./models/policyRule";
import { consumerChoice } from "./models/consumerChoice";
import { marketStructure } from "./models/marketStructure";
import { externalities } from "./models/externalities";
import { gameTheory } from "./models/gameTheory";
import { aiBoom } from "./models/aiBoom";

/** Everything a model might need beyond the economy itself. */
export interface RunOptions {
  /** How far forward time-path charts look, in periods. */
  horizon: number;
  /** Scenario settings for the AI boom model. */
  ai: AiOptions;
  /** Whether a disinflation is believed at once or has to be earned. */
  expectations: Expectations;
  /** Textbook micro dials. */
  micro: MicroOptions;
  /** Market-structure dials. */
  market: MarketOptions;
  /** Externality dials. */
  externality: ExternalityOptions;
  /** Which 2×2 game to play. */
  game: GameOptions;
  /** Size of the negative demand shock in the zero-lower-bound model. */
  zlb: ZlbOptions;
  /** Long-run trade elasticities for the trade-flows panel. */
  trade: TradeOptions;
  /** Which parameter the comparative-statics panel nudges, or "none". */
  sweep: SweepParam;
  /** Which parameter the sweep curve puts on its x-axis, or "none". */
  sweepAxis: SweepParam;
  /** Which figure that curve plots. Empty means the model's first reported one. */
  sweepFigure: string;
}

export const DEFAULT_HORIZON = 50;
/** Preset windows — a couple of clicks rather than a fiddly slider. */
export const HORIZON_PRESETS = [10, 25, 50, 100, 120];
/** The model the simulator opens on: the one a first-year course starts with. */
export const DEFAULT_MODEL = "islm";
export const DEFAULT_AI: AiOptions = { substitutionPct: 30, capitalIntensity: 1, capitalProductivity: 1 };
export const DEFAULT_MICRO: MicroOptions = { px: 1, py: 2, income: 24, weight: 0.5 };
export const DEFAULT_MARKET: MarketOptions = { demandA: 20, demandB: 1, mc: 4, fixed: 10 };
export const DEFAULT_EXTERNALITY: ExternalityOptions = { external: 2, tax: 0 };
export const DEFAULT_GAME: GameOptions = { game: "prisoners", temptation: 5 };
/**
 * A recession-sized shock: enough to push the natural rate a little below zero,
 * so the bound binds for a while. 12% gave a 20% output gap, a depression.
 */
export const DEFAULT_ZLB: ZlbOptions = { demandShock: 0.06 };
/** Mid-range textbook estimates: Marshall-Lerner holds, but not by much. */
export const DEFAULT_TRADE: TradeOptions = { etaX: 0.7, etaM: 0.6 };
/** Slow expectations are the interesting case, so they are the default. */
export const DEFAULT_EXPECTATIONS: Expectations = "adaptive";
/** Comparative statics starts off: it is a question you ask, not a default view. */
export const DEFAULT_SWEEP: SweepParam = "none";
/** So does the sweep curve. */
export const DEFAULT_SWEEP_AXIS: SweepParam = "none";
export const DEFAULT_SWEEP_FIGURE = "";

export const DEFAULT_OPTIONS: RunOptions = {
  horizon: DEFAULT_HORIZON,
  ai: DEFAULT_AI,
  expectations: DEFAULT_EXPECTATIONS,
  micro: DEFAULT_MICRO,
  market: DEFAULT_MARKET,
  externality: DEFAULT_EXTERNALITY,
  game: DEFAULT_GAME,
  zlb: DEFAULT_ZLB,
  trade: DEFAULT_TRADE,
  sweep: DEFAULT_SWEEP,
  sweepAxis: DEFAULT_SWEEP_AXIS,
  sweepFigure: DEFAULT_SWEEP_FIGURE,
};

export interface ModelDef {
  id: string;
  label: string;
  group: string;
  blurb: string;
  /** Models that plot a path over time honour `o.horizon`; the rest ignore it. */
  run: (e: Economy, o: RunOptions) => Panel[];
}

/** The models whose time paths follow the time-window dial; the control is shown only for these. */
export const HORIZON_MODELS = new Set(["solow", "ak-growth", "adas", "zlb", "phillips", "debt", "currency-crisis", "dornbusch", "external-balance"]);

export const MODELS: ModelDef[] = [
  { id: "cobb-douglas", label: "Cobb-Douglas", group: "Foundations", blurb: "The production function everything else builds on.", run: (e) => cobbDouglas(e) },
  { id: "solow", label: "Solow-Swan", group: "Long run", blurb: "Capital accumulation, the steady state and the golden rule.", run: (e, o) => solow(e, o.horizon) },
  { id: "ak-growth", label: "AK endogenous growth", group: "Long run", blurb: "What if returns to capital never diminished? Growth becomes a policy choice.", run: (e, o) => akGrowth(e, o.horizon) },
  { id: "islm", label: "IS-LM", group: "Short run", blurb: "Goods and money markets set output and the interest rate.", run: (e) => islm(e) },
  { id: "adas", label: "AD-AS", group: "Short run", blurb: "Aggregate demand and supply, and the path back to potential output.", run: (e, o) => adas(e, o.horizon) },
  { id: "zlb", label: "Zero lower bound", group: "Short run", blurb: "What happens when the policy rate hits zero and cannot fall further.", run: (e, o) => zlb(e, o.horizon, o.zlb) },
  { id: "phillips", label: "Phillips curve", group: "Inflation & unemployment", blurb: "Inflation, expectations and the cost of a disinflation.", run: (e, o) => phillips(e, o.expectations, o.horizon) },
  { id: "labour-market", label: "WS-PS labour market", group: "Inflation & unemployment", blurb: "Where the natural rate of unemployment comes from.", run: (e) => labourMarket(e) },
  { id: "debt", label: "Debt dynamics", group: "Fiscal & debt", blurb: "The r − g drift, and the primary balance needed to stabilise debt.", run: (e, o) => debtDynamics(e, o.horizon) },
  { id: "currency-crisis", label: "Currency crisis", group: "Fiscal & debt", blurb: "Why a pegged rate cannot survive a financed deficit, and when it breaks.", run: (e, o) => currencyCrisis(e, o.horizon) },
  { id: "mf", label: "Mundell-Fleming", group: "Open economy", blurb: "IS-LM-BP: policy under fixed vs. floating rates.", run: (e) => mundellFleming(e) },
  { id: "parity", label: "Parity conditions", group: "International macro", blurb: "UIP, CIP, PPP, the real exchange rate and the trilemma.", run: (e) => parity(e) },
  { id: "dornbusch", label: "Dornbusch overshooting", group: "International macro", blurb: "Why the exchange rate overshoots after a money shock.", run: (e, o) => dornbuschPanel(e, 10, o.horizon) },
  { id: "external-balance", label: "External balance", group: "International macro", blurb: "Current account, net foreign assets and debt dynamics.", run: (e, o) => externalBalance(e, o.horizon) },
  { id: "trade-flows", label: "Trade flows", group: "International macro", blurb: "Marshall-Lerner, the J-curve and Dutch disease.", run: (e, o) => tradeFlows(e, o.trade) },
  { id: "policy-rule", label: "Policy rule", group: "International macro", blurb: "The Taylor rule and the policy stance.", run: (e) => policyRule(e) },
  { id: "consumer-choice", label: "Consumer choice", group: "Micro", blurb: "Budget lines, indifference curves and the demand that falls out of them.", run: (e, o) => consumerChoice(e, o.micro) },
  { id: "market-structure", label: "Competition vs monopoly", group: "Micro", blurb: "Deadweight loss, and who pays for market power.", run: (e, o) => marketStructure(e, o.market) },
  { id: "externalities", label: "Externalities & tax", group: "Micro", blurb: "Private vs social cost, and the Pigouvian tax that closes the gap.", run: (e, o) => externalities(e, o.externality, o.market) },
  { id: "game-theory", label: "Game theory", group: "Strategic interaction", blurb: "Dominant strategies, Nash equilibria and why cooperation is hard.", run: (e, o) => gameTheory(e, o.game) },
  { id: "ai-boom", label: "AI boom", group: "Applied scenarios", blurb: "AI doing a share of labour tasks, funded by capital instead.", run: (e, o) => aiBoom(e, o.ai) },
];

/** The structural switches in the Parameters panel. */
export type StructureSwitch = "openness" | "size" | "regime";

/**
 * What each model reads from the economy, so the Parameters panel can show only
 * the sliders that do something. `key` is shown first, in this order — the dials
 * a student reaches for; `uses` is every slider the model reads; `structure` the
 * switches that change it. A test perturbs every parameter of every model and
 * fails if these lists and the model's real behaviour ever disagree.
 */
export interface ModelInputs {
  key: (keyof Economy)[];
  uses: (keyof Economy)[];
  structure: StructureSwitch[];
}

const PRODUCTION: (keyof Economy)[] = ["A", "alpha", "L", "K0"];
const GROWTH: (keyof Economy)[] = ["s", "n", "g", "delta"];
const ISLM: (keyof Economy)[] = ["G", "T", "M", "P", "c0", "c1", "I0", "b", "kY", "hR"];
const OPEN: (keyof Economy)[] = ["rStar", "rho", "X0", "importProp", "fxSensitivity", "kappa", "fxPeg"];
const NONE: ModelInputs = { key: [], uses: [], structure: [] };

export const MODEL_INPUTS: Record<string, ModelInputs> = {
  "cobb-douglas": { key: ["A", "alpha", "K0", "L"], uses: PRODUCTION, structure: [] },
  solow: { key: ["s", "n", "g", "delta"], uses: [...PRODUCTION, ...GROWTH], structure: [] },
  "ak-growth": { key: ["s", "A", "delta"], uses: [...PRODUCTION, ...GROWTH], structure: [] },
  islm: { key: ["G", "T", "M"], uses: ISLM, structure: [] },
  adas: {
    key: ["G", "M", "lambda", "theta"],
    uses: [...PRODUCTION.filter((k) => k !== "K0"), ...GROWTH, ...ISLM, "pStar", "energyShare", "lambda", "theta"],
    structure: ["openness"],
  },
  zlb: { key: ["G", "M"], uses: [...PRODUCTION.filter((k) => k !== "K0"), ...GROWTH, ...ISLM], structure: [] },
  phillips: { key: ["piE", "piTarget", "pcBeta"], uses: ["theta", "piE", "un", "pcBeta", "piTarget"], structure: [] },
  "labour-market": { key: ["wagePush", "markup", "wageSlope"], uses: [...PRODUCTION, "wagePush", "markup", "wageSlope"], structure: [] },
  debt: { key: ["debtRatio", "primaryBalance", "rStar", "g"], uses: ["n", "g", "rStar", "rho", "debtRatio", "primaryBalance"], structure: [] },
  "currency-crisis": { key: ["reservesShare", "creditGrowth"], uses: ["M", "reservesShare", "creditGrowth"], structure: ["regime"] },
  mf: { key: ["G", "M", "rStar"], uses: [...ISLM, ...OPEN], structure: ["openness", "size", "regime"] },
  parity: { key: ["rStar", "rho", "pStar"], uses: ["P", "rStar", "rho", "pStar"], structure: ["openness", "regime"] },
  dornbusch: { key: ["M", "theta"], uses: ["M", "P", "kY", "hR", "rStar", "pStar", "theta"], structure: [] },
  "external-balance": { key: ["G", "T", "rStar"], uses: ["n", "g", ...ISLM, ...OPEN], structure: ["openness", "size", "regime"] },
  "trade-flows": { key: ["pStar", "X0"], uses: [...ISLM, ...OPEN, "pStar"], structure: ["openness", "size", "regime"] },
  "policy-rule": {
    key: ["piE", "piTarget", "rStar"],
    uses: [...PRODUCTION.filter((k) => k !== "K0"), ...GROWTH, ...ISLM, "rStar", "piE", "piTarget"],
    structure: [],
  },
  "consumer-choice": NONE,
  "market-structure": NONE,
  externalities: NONE,
  "game-theory": NONE,
  "ai-boom": { key: ["A", "alpha"], uses: PRODUCTION, structure: [] },
};

export function modelInputs(id: string): ModelInputs {
  return MODEL_INPUTS[id] ?? NONE;
}

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function runModel(id: string, e: Economy, o: RunOptions = DEFAULT_OPTIONS): Panel[] {
  return getModel(id).run(e, o);
}

export const MODEL_GROUPS: string[] = Array.from(new Set(MODELS.map((m) => m.group)));
