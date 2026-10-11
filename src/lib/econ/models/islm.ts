import { add, div, mul, num, sub, v } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";

export interface IslmCore {
  Y: number;
  r: number;
  /** I = I₀ − b·r: what the higher rate does to investment at the new equilibrium. */
  I: number;
  fiscalMultiplier: number;
  monetaryMultiplier: number;
  denominator: number;
  trace: CalcStep[];
}

export function islmCore(e: Economy): IslmCore {
  const t = new Tracer();
  const env = {
    c0: e.c0,
    c1: e.c1,
    I0: e.I0,
    b: e.b,
    G: e.G,
    T: e.T,
    M: e.M,
    P: e.P,
    kY: e.kY,
    hR: e.hR,
  };

  const realMoney = e.M / e.P;
  const denominator = t.step(
    "Slope term  (1−c1) + b·k/h",
    (1 - e.c1) + (e.b * e.kY) / e.hR,
    add(sub(num(1), v("c1")), div(mul(v("b"), v("kY")), v("hR"))),
    env,
  );

  const numerator = t.step(
    "Autonomous demand + (b/h)·M/P",
    e.c0 - e.c1 * e.T + e.I0 + e.G + (e.b / e.hR) * realMoney,
    add(sub(add(v("c0"), v("I0"), v("G")), mul(v("c1"), v("T"))), mul(div(v("b"), v("hR")), div(v("M"), v("P")))),
    env,
  );

  const Y = t.step(
    "Equilibrium output Y*",
    numerator / denominator,
    div(
      add(sub(add(v("c0"), v("I0"), v("G")), mul(v("c1"), v("T"))), mul(div(v("b"), v("hR")), div(v("M"), v("P")))),
      add(sub(num(1), v("c1")), div(mul(v("b"), v("kY")), v("hR"))),
    ),
    env,
  );

  const r = t.step("Equilibrium interest rate r*", (e.kY * Y - realMoney) / e.hR, div(sub(mul(v("kY"), v("Y")), div(v("M"), v("P"))), v("hR")), { ...env, Y });

  const I = t.step(
    "Investment at that rate I = I₀ − b·r",
    e.I0 - e.b * r,
    sub(v("I0"), mul(v("b"), v("r"))),
    { ...env, r },
    "The other side of a fiscal expansion: the higher rate is what crowds investment out",
  );

  const fiscalMultiplier = t.step(
    "Fiscal multiplier dY/dG",
    1 / denominator,
    div(num(1), add(sub(num(1), v("c1")), div(mul(v("b"), v("kY")), v("hR")))),
    env,
  );
  const monetaryMultiplier = t.step(
    "Monetary multiplier dY/d(M/P)",
    e.b / e.hR / denominator,
    div(div(v("b"), v("hR")), add(sub(num(1), v("c1")), div(mul(v("b"), v("kY")), v("hR")))),
    env,
  );

  return { Y, r, I, fiscalMultiplier, monetaryMultiplier, denominator, trace: t.steps };
}

/** Points on the IS and LM curves for charting, over a sensible Y range. */
export function islmCurves(e: Economy, core: IslmCore): { y: number[]; is: { x: number; y: number }[]; lm: { x: number; y: number }[] } {
  const yMax = Math.max(core.Y * 2, 100);
  const ys = linspace(0, yMax, 120);
  const isIntercept = (e.c0 - e.c1 * e.T + e.I0 + e.G) / e.b;
  const isSlope = (1 - e.c1) / e.b;
  const realMoney = e.M / e.P;
  return {
    y: ys,
    is: ys.map((Y) => ({ x: Y, y: isIntercept - isSlope * Y })),
    lm: ys.map((Y) => ({ x: Y, y: (e.kY * Y - realMoney) / e.hR })),
  };
}

export function islm(e: Economy): Panel[] {
  const core = islmCore(e);
  const curves = islmCurves(e, core);
  const isIntercept = (e.c0 - e.c1 * e.T + e.I0 + e.G) / e.b;

  return [
    {
      id: "islm",
      title: "IS-LM equilibrium",
      description: "The goods market (IS) and money market (LM) together pin down output and the interest rate in the short run.",
      chart: {
        xLabel: "Output (Y)",
        yLabel: "Interest rate (r)",
        series: [
          { label: "IS", points: curves.is },
          { label: "LM", points: curves.lm },
        ],
        markers: [{ x: core.Y, y: core.r, label: "E" }],
      },
      scalars: [
        { label: "Output (Y*)", value: core.Y },
        { label: "Interest rate (r*)", value: core.r, unit: "×100%" },
        { label: "Investment I", value: core.I, hint: "I₀ − b·r: what is left for investment once the rate has moved" },
        { label: "Fiscal multiplier dY/dG", value: core.fiscalMultiplier },
        { label: "Monetary multiplier dY/d(M/P)", value: core.monetaryMultiplier },
        { label: "IS intercept", value: isIntercept },
      ],
      notes: [
        "A rise in G shifts IS right: Y up, r up.",
        "A rise in M shifts LM right: Y up, r down.",
      ],
      trace: core.trace,
    },
  ];
}
