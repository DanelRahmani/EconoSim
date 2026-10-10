import type { AiOptions, Economy } from "./types";
import type { Panel } from "./panel";
import { cobbDouglas } from "./models/cobbDouglas";
import { solow } from "./models/solow";
import { islm } from "./models/islm";
import { adas } from "./models/adas";
import { mundellFleming } from "./models/mundellFleming";
import { parity } from "./models/parity";
import { dornbuschPanel } from "./models/dornbusch";
import { externalBalance } from "./models/externalBalance";
import { tradeFlows } from "./models/tradeFlows";
import { policyRule } from "./models/policyRule";
import { aiBoom } from "./models/aiBoom";

/** How far forward the time-path charts should look, in periods. */
export interface RunOptions {
  horizon: number;
  /** Scenario settings for the AI boom model. */
  ai: AiOptions;
}

export const DEFAULT_HORIZON = 50;
/** Preset windows — a couple of clicks rather than a fiddly slider. */
export const HORIZON_PRESETS = [10, 25, 50, 100, 120];
export const DEFAULT_AI: AiOptions = { substitutionPct: 30, capitalIntensity: 1, capitalProductivity: 1 };
export const DEFAULT_OPTIONS: RunOptions = { horizon: DEFAULT_HORIZON, ai: DEFAULT_AI };

export interface ModelDef {
  id: string;
  label: string;
  group: string;
  blurb: string;
  /** Models that plot a path over time honour `o.horizon`; the rest ignore it. */
  run: (e: Economy, o: RunOptions) => Panel[];
}

export const MODELS: ModelDef[] = [
  { id: "cobb-douglas", label: "Cobb-Douglas", group: "Foundations", blurb: "The production function everything else builds on.", run: (e) => cobbDouglas(e) },
  { id: "solow", label: "Solow-Swan", group: "Long run", blurb: "Capital accumulation, the steady state and the golden rule.", run: (e, o) => solow(e, o.horizon) },
  { id: "islm", label: "IS-LM", group: "Short run", blurb: "Goods and money markets set output and the interest rate.", run: (e) => islm(e) },
  { id: "adas", label: "AD-AS", group: "Short run", blurb: "Aggregate demand and supply, and the path back to potential output.", run: (e, o) => adas(e, o.horizon) },
  { id: "mf", label: "Mundell-Fleming", group: "Open economy", blurb: "IS-LM-BP: policy under fixed vs. floating rates.", run: (e) => mundellFleming(e) },
  { id: "parity", label: "Parity conditions", group: "International macro", blurb: "UIP, CIP, PPP, the real exchange rate and the trilemma.", run: (e) => parity(e) },
  { id: "dornbusch", label: "Dornbusch overshooting", group: "International macro", blurb: "Why the exchange rate overshoots after a money shock.", run: (e, o) => dornbuschPanel(e, 10, o.horizon) },
  { id: "external-balance", label: "External balance", group: "International macro", blurb: "Current account, net foreign assets and debt dynamics.", run: (e, o) => externalBalance(e, o.horizon) },
  { id: "trade-flows", label: "Trade flows", group: "International macro", blurb: "Marshall-Lerner, the J-curve and Dutch disease.", run: (e) => tradeFlows(e) },
  { id: "policy-rule", label: "Policy rule", group: "International macro", blurb: "The Taylor rule and the policy stance.", run: (e) => policyRule(e) },
  { id: "ai-boom", label: "AI boom", group: "Applied scenarios", blurb: "AI doing a share of labour tasks, funded by capital instead.", run: (e, o) => aiBoom(e, o.ai) },
];

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function runModel(id: string, e: Economy, o: RunOptions = DEFAULT_OPTIONS): Panel[] {
  return getModel(id).run(e, o);
}

export const MODEL_GROUPS: string[] = Array.from(new Set(MODELS.map((m) => m.group)));
