import type { Economy } from "./types";
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

export interface ModelDef {
  id: string;
  label: string;
  group: string;
  blurb: string;
  run: (e: Economy) => Panel[];
}

export const MODELS: ModelDef[] = [
  { id: "cobb-douglas", label: "Cobb-Douglas", group: "Foundations", blurb: "The production function everything else builds on.", run: cobbDouglas },
  { id: "solow", label: "Solow-Swan", group: "Long run", blurb: "Capital accumulation, the steady state and the golden rule.", run: solow },
  { id: "islm", label: "IS-LM", group: "Short run", blurb: "Goods and money markets set output and the interest rate.", run: islm },
  { id: "adas", label: "AD-AS", group: "Short run", blurb: "Aggregate demand and supply, and the path back to potential output.", run: adas },
  { id: "mf", label: "Mundell-Fleming", group: "Open economy", blurb: "IS-LM-BP: policy under fixed vs. floating rates.", run: mundellFleming },
  { id: "parity", label: "Parity conditions", group: "International macro", blurb: "UIP, CIP, PPP, the real exchange rate and the trilemma.", run: parity },
  { id: "dornbusch", label: "Dornbusch overshooting", group: "International macro", blurb: "Why the exchange rate overshoots after a money shock.", run: dornbuschPanel },
  { id: "external-balance", label: "External balance", group: "International macro", blurb: "Current account, net foreign assets and debt dynamics.", run: externalBalance },
  { id: "trade-flows", label: "Trade flows", group: "International macro", blurb: "Marshall-Lerner, the J-curve and Dutch disease.", run: tradeFlows },
  { id: "policy-rule", label: "Policy rule", group: "International macro", blurb: "The Taylor rule and the policy stance.", run: policyRule },
];

export function getModel(id: string): ModelDef {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

export function runModel(id: string, e: Economy): Panel[] {
  return getModel(id).run(e);
}

export const MODEL_GROUPS: string[] = Array.from(new Set(MODELS.map((m) => m.group)));
