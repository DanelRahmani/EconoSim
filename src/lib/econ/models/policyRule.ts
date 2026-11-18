import { add, mul, num, sub, v } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer } from "../trace";
import { linspace } from "../math";
import { islmCore } from "./islm";
import { naturalOutput } from "./adas";

/** Taylor rule:  i = r* + π + aπ(π − π*) + ay(y − ȳ). */
export function taylorRule(
  rStar: number,
  pi: number,
  piTarget: number,
  outputGap: number,
  aPi = 0.5,
  aY = 0.5,
): number {
  return rStar + pi + aPi * (pi - piTarget) + aY * outputGap;
}

export function policyRule(e: Economy, piTarget = e.piTarget): Panel[] {
  const t = new Tracer();
  const Yn = naturalOutput(e);
  const core = islmCore(e);
  const gap = t.step(
    "Output gap (Y − Yn)/Yn",
    (core.Y - Yn) / Yn,
    undefined,
    undefined,
    "IS-LM output against the Solow potential",
  );
  // The model has no separate inflation process outside the Phillips curve, so
  // the rule reads expected inflation πᵉ as current inflation.
  const pi = e.piE;
  const ruleExpr = add(v("rStar"), v("pi"), mul(num(0.5), sub(v("pi"), v("piStar"))), mul(num(0.5), v("gap")));
  const i = t.step(
    "Taylor-rule nominal rate i",
    taylorRule(e.rStar, pi, piTarget, gap),
    ruleExpr,
    { rStar: e.rStar, pi, piStar: piTarget, gap },
    "π is taken as expected inflation πᵉ",
  );
  // IS-LM has fixed prices, so its r is a real rate. Compare like with like:
  // the rule's real rate i − π against it, not the nominal i.
  const realRule = t.step("Rule-implied real rate i − π", i - pi, sub(v("i"), v("pi")), { i, pi });
  const stance = t.step(
    "Stance: rule real rate − IS-LM real rate",
    realRule - core.r,
    sub(v("rRule"), v("r")),
    { rRule: realRule, r: core.r },
    "Positive ⇒ the rule wants a higher real rate than the goods and money markets now deliver: tighter policy",
  );

  const piRange = linspace(-0.02, 0.1, 60);
  return [
    {
      id: "policy-rule",
      title: "Monetary policy rule",
      description: "A Taylor rule links the policy interest rate to inflation and the output gap: the modern regime-analysis complement to Mundell-Fleming.",
      chart: {
        xLabel: "Inflation π (%)",
        yLabel: "Nominal policy rate i (%)",
        series: [
          {
            label: "i = r* + π + 0.5(π−π*) + 0.5·gap",
            points: piRange.map((p) => ({ x: p * 100, y: taylorRule(e.rStar, p, piTarget, gap) * 100 })),
          },
          {
            label: "i = π (real rate zero)",
            points: piRange.map((p) => ({ x: p * 100, y: p * 100 })),
            dashed: true,
          },
        ],
        markers: [{ x: pi * 100, y: i * 100, label: "current" }],
      },
      scalars: [
        { label: "Rule nominal rate i", value: i, percent: true },
        { label: "Inflation π (= πᵉ)", value: pi, percent: true, hint: "The rule reads expected inflation as current inflation" },
        { label: "Target π*", value: piTarget, percent: true },
        { label: "Output gap", value: gap, percent: true },
        { label: "Rule real rate i − π", value: realRule, percent: true },
        { label: "IS-LM real rate r", value: core.r, percent: true, hint: "Prices are fixed in IS-LM, so its rate is a real rate" },
        { label: "Stance (rule − market, real)", value: stance, percent: true, hint: "Positive: the rule calls for tighter policy" },
      ],
      notes: [
        "The Taylor principle: the nominal rate must rise more than one-for-one with inflation, so the real rate rises too. In this rule the total response to π is 1 + aπ = 1.5, so any aπ > 0 satisfies it: the rule line is steeper than the dashed i = π line.",
        stance > 0
          ? "The rule's real rate is above the IS-LM real rate: by the rule, policy is too loose and should tighten."
          : "The rule's real rate is below the IS-LM real rate: by the rule, policy is too tight and should ease.",
        "Regime analysis: combine this with the trilemma to see what monetary autonomy a country really has.",
      ],
      trace: t.steps,
    },
  ];
}
