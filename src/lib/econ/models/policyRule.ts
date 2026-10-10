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

export function policyRule(e: Economy, piTarget = 0.02): Panel[] {
  const t = new Tracer();
  const Yn = naturalOutput(e);
  const core = islmCore(e);
  const outputGapPct = (core.Y - Yn) / Yn;
  const pi = e.piE;
  const i = t.step(
    "Taylor-rule interest rate",
    taylorRule(e.rStar, pi, piTarget, outputGapPct),
    undefined,
    undefined,
    "i = r* + π + 0.5(π − π*) + 0.5·(output gap)",
  );
  t.step("Output gap", outputGapPct);
  t.step("Implied policy stance vs. market rate", i - core.r, undefined, undefined, "Positive ⇒ the rule calls for a tighter stance than the IS-LM rate");

  const piRange = linspace(-0.02, 0.1, 60);
  return [
    {
      id: "policy-rule",
      title: "Monetary policy rule",
      description: "A Taylor rule links the policy interest rate to inflation and the output gap — the modern regime-analysis complement to Mundell-Fleming.",
      chart: {
        xLabel: "Inflation (π)",
        yLabel: "Policy rate (i)",
        series: [
          {
            label: "i = r* + π + 0.5(π−π*) + 0.5·gap",
            points: piRange.map((p) => ({ x: p, y: taylorRule(e.rStar, p, piTarget, outputGapPct) })),
          },
        ],
        markers: [{ x: pi, y: i, label: "current" }],
      },
      scalars: [
        { label: "Rule rate (i)", value: i },
        { label: "Inflation (π)", value: pi },
        { label: "Target (π*)", value: piTarget },
        { label: "Output gap", value: outputGapPct },
        { label: "IS-LM market rate", value: core.r },
      ],
      notes: [
        "A larger inflation coefficient (aπ > 1) is the Taylor principle: the real rate rises with inflation.",
        "Regime analysis: combine this with the trilemma to see what monetary autonomy a country really has.",
      ],
      trace: t.steps,
    },
  ];
}
