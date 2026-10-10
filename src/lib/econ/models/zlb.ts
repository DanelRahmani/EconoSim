import { type Expr, add, div, mul, num, sub, v, evaluate } from "../expr";
import type { Economy, ZlbOptions } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";
import { naturalOutput } from "./adas";

/**
 * The zero lower bound.
 *
 * The natural rate of interest is the policy rate that would hold output at
 * potential — from the IS curve:
 *
 *   rₙ = (A₀ − (1−c₁)·Yₙ) / b,   where A₀ = c₀ + I₀ + G − c₁T
 *
 * When a demand shock is big enough, rₙ goes negative. A central bank that could
 * set a negative rate would keep output at potential; one that cannot sets
 * r = max(0, rₙ) and output lands below potential instead. That gap is what the
 * lower bound costs.
 *
 * The second result is the fiscal multiplier. On the floor the LM curve is flat,
 * so government spending does not crowd out investment through the interest
 * rate: dY/dG = 1/(1−c₁). Away from the floor it is smaller.
 */

export interface ZlbCore {
  /** Autonomous demand A₀ = c₀ + I₀ + G − c₁T. */
  autonomous: number;
  Yn: number;
  /** Natural (neutral) rate: the policy rate that would keep Y = Yn. */
  naturalRate: number;
  /** What the central bank actually sets. */
  policyRate: number;
  /** Output on the floor, or at potential if the bound does not bind. */
  output: number;
  outputGap: number;
  /** Output the economy would have had with an unconstrained rate. */
  unconstrainedOutput: number;
  multiplierAtFloor: number;
  multiplierAway: number;
  /** Periods for which the bound binds. */
  boundPeriods: number;
  path: { t: number; Y: number; Yn: number; naturalRate: number }[];
  trace: CalcStep[];
}

/** The demand shock decays back to nothing at this rate per period. */
const SHOCK_DECAY = 0.03;

const autonomousExpr = (): Expr => sub(add(v("c0"), v("I0"), v("G")), mul(v("c1"), v("T")));
const naturalRateExpr: Expr = div(sub(v("A0"), mul(sub(num(1), v("c1")), v("Yn"))), v("b"));
const multiplierFloorExpr: Expr = div(num(1), sub(num(1), v("c1")));
const multiplierAwayExpr: Expr = div(num(1), add(sub(num(1), v("c1")), div(mul(v("b"), v("kY")), v("hR"))));

/** Autonomous demand with the shock applied (shock is a fraction of Yn). */
function autonomousAfterShock(e: Economy, Yn: number, shockFrac: number): number {
  return e.c0 + e.I0 + e.G - e.c1 * e.T - shockFrac * Yn;
}

export function zlbCore(e: Economy, horizon = 40, opts: ZlbOptions): ZlbCore {
  const t = new Tracer();
  const Yn = naturalOutput(e);
  const env = { c0: e.c0, I0: e.I0, G: e.G, c1: e.c1, T: e.T, b: e.b, kY: e.kY, hR: e.hR, Yn };

  const autonomous = t.step("Autonomous demand A₀", evaluate(autonomousExpr(), env), autonomousExpr(), env);
  const A0 = autonomous - opts.demandShock * Yn;
  t.step(
    "Autonomous demand after the shock",
    A0,
    sub(autonomousExpr(), mul(v("shock"), v("Yn"))),
    { ...env, shock: opts.demandShock },
    `A demand shock of ${(opts.demandShock * 100).toFixed(0)}% of potential output`,
  );

  const naturalRate = t.step(
    "Natural rate of interest rₙ",
    evaluate(naturalRateExpr, { A0, c1: e.c1, Yn, b: e.b }),
    naturalRateExpr,
    { A0, c1: e.c1, Yn, b: e.b },
    "The rate that would hold output at potential — negative means the bound will bind",
  );

  const policyRate = Math.max(0, naturalRate);
  const constrained = naturalRate < 0;
  const outputConstrained = (A0 - e.b * policyRate) / (1 - e.c1);
  const output = constrained ? outputConstrained : Yn;

  const multiplierAtFloor = t.step(
    "Fiscal multiplier on the floor dY/dG",
    evaluate(multiplierFloorExpr, env),
    multiplierFloorExpr,
    env,
    "The LM curve is flat here, so spending crowds nothing out",
  );
  const multiplierAway = t.step(
    "Fiscal multiplier away from the floor",
    evaluate(multiplierAwayExpr, env),
    multiplierAwayExpr,
    env,
    "Higher rates crowd out investment again",
  );

  const periods = Math.max(5, Math.min(300, Math.round(horizon)));
  const path: ZlbCore["path"] = [];
  let boundPeriods = 0;
  for (let i = 0; i <= periods; i++) {
    const shock = opts.demandShock * Math.pow(1 - SHOCK_DECAY, i);
    const A = autonomousAfterShock(e, Yn, shock);
    const rn = (A - (1 - e.c1) * Yn) / e.b;
    if (rn < 0) boundPeriods++;
    const rate = Math.max(0, rn);
    path.push({ t: i, Y: (A - e.b * rate) / (1 - e.c1), Yn, naturalRate: rn });
  }

  return {
    autonomous: A0,
    Yn,
    naturalRate,
    policyRate,
    output,
    outputGap: output - Yn,
    unconstrainedOutput: Yn,
    multiplierAtFloor,
    multiplierAway,
    boundPeriods,
    path,
    trace: t.steps,
  };
}

export function zlb(e: Economy, horizon = 40, opts: ZlbOptions = { demandShock: 0.3 }): Panel[] {
  const core = zlbCore(e, horizon, opts);
  const { Yn } = core;
  const constrained = core.naturalRate < 0;

  const yLo = Math.max(0, Math.min(Yn * 0.7, core.output * 0.95));
  const yHi = Math.max(Yn * 1.3, core.output * 1.1);
  const yRange = linspace(yLo, yHi, 90);

  // IS is downward sloping in (Y, r); LM is upward sloping until it hits zero.
  const isCurve = (A: number) => yRange.map((Y) => ({ x: Y, y: (A - (1 - e.c1) * Y) / e.b }));
  const lmCurve = (Y: number) => (e.kY * Y - e.M / e.P) / e.hR;
  const isShocked = core.autonomous - opts.demandShock * Yn;

  return [
    {
      id: "zlb-diagram",
      title: "IS-LM when the policy rate cannot go below zero",
      description:
        "The IS curve falls and the LM curve rises, but the LM stops at zero — the central bank cannot set a negative rate. If the two would have met below the line, the economy is stuck on the flat segment and output is determined by the IS curve alone.",
      chart: {
        xLabel: "Output (Y)",
        yLabel: "Interest rate (r)",
        series: [
          { label: "IS (after the shock)", points: isCurve(isShocked) },
          { label: "IS (before the shock)", points: isCurve(core.autonomous), dashed: true },
          {
            label: "LM (clipped at zero)",
            points: yRange.map((Y) => ({ x: Y, y: Math.max(0, lmCurve(Y)) })),
          },
          {
            label: "Zero lower bound",
            points: [
              { x: yLo, y: 0 },
              { x: yHi, y: 0 },
            ],
            dashed: true,
          },
        ],
        markers: constrained
          ? [
              { x: core.output, y: 0, label: "constrained" },
              { x: Yn, y: core.naturalRate, label: "wanted" },
            ]
          : [{ x: core.output, y: core.policyRate, label: "E" }],
      },
      scalars: [
        { label: "Natural rate rₙ", value: core.naturalRate, hint: "Negative means the bound binds" },
        { label: "Policy rate actually set", value: core.policyRate },
        { label: "Natural output Yₙ", value: Yn },
        { label: "Output on the floor", value: core.output },
        {
          label: "Output gap",
          value: core.outputGap,
          hint: "The cost of the zero bound: the gap the central bank cannot close",
        },
        { label: "Fiscal multiplier at the bound", value: core.multiplierAtFloor, hint: "1/(1−c₁)" },
        { label: "Fiscal multiplier away from it", value: core.multiplierAway },
        { label: `Periods the bound binds`, value: core.boundPeriods },
      ],
      notes: [
        constrained
          ? `The shock pushes the natural rate to ${(core.naturalRate * 100).toFixed(2)}%. The central bank would like a negative rate; it settles for zero and output stops ${Math.abs(core.outputGap).toFixed(1)} short of potential.`
          : `The natural rate is ${(core.naturalRate * 100).toFixed(2)}%, comfortably positive. Increase the size of the demand shock until it goes negative and the bound starts to bind.`,
        `Government spending buys more here than usual: the multiplier is ${core.multiplierAtFloor.toFixed(2)} on the floor against ${core.multiplierAway.toFixed(2)} away from it, because a flat LM means no crowding out. This is the standard case for fiscal policy at the zero bound.`,
        "The honest caveat: this is the textbook IS-LM version, with no expectations and no financial frictions. It shows why the bound binds and why fiscal policy gains traction; it does not show forward guidance, and it assumes the money supply can keep expanding without other effects.",
      ],
      trace: core.trace,
    },
    {
      id: "zlb-path",
      title: `A recession at the bound — next ${horizon} periods`,
      description:
        "The demand shock decays, so the natural rate climbs back towards positive. While it is negative, output sits below potential; once it crosses zero the central bank regains control and the gap closes.",
      timeseries: {
        xLabel: "Time",
        yLabel: "Output",
        series: [
          { label: "Output Y", points: core.path.map((p) => ({ x: p.t, y: p.Y })) },
          { label: "Potential Yₙ", points: core.path.map((p) => ({ x: p.t, y: p.Yn })), dashed: true },
        ],
      },
      scalars: [
        {
          label: "Deepest output gap",
          value: Math.min(...core.path.map((p) => p.Y - p.Yn)),
          hint: "Where the bound bites hardest",
        },
        {
          label: "Natural rate at the trough",
          value: Math.min(...core.path.map((p) => p.naturalRate)),
        },
      ],
      notes: [
        core.boundPeriods > 0
          ? `The bound binds for the first ${core.boundPeriods} periods. After that the natural rate is positive again and conventional policy works.`
          : "The natural rate never goes negative over this window, so the bound never binds. Raise the demand shock to see it start.",
      ],
      trace: [],
    },
  ];
}
