import { type Expr, add, div, mul, num, sub, v, evaluate } from "../expr";
import type { Economy, Expectations } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";
import { naturalOutput } from "./adas";

/**
 * The expectations-augmented Phillips curve:
 *
 *     π = πᵉ − β (u − u_n)
 *
 * plus Okun's law, which turns an unemployment gap into an output gap:
 *
 *     (Y − Yn)/Yn = −0.5 (u − u_n)
 *
 * The point of the model is the disinflation experiment. The central bank
 * announces and delivers a lower inflation rate. What that costs depends
 * entirely on how fast expectations follow:
 *
 *  - adaptive expectations (πᵉₜ₊₁ = πᵉₜ + θ(πₜ − πᵉₜ)): the bank must hold
 *    inflation below expectations period after period, so unemployment sits
 *    above its natural rate on a decaying path, and the sacrifice ratio is the
 *    neat closed form 1/(βθ);
 *  - a credible announcement: expectations jump straight to the target, so
 *    unemployment never leaves u_n and the disinflation is free.
 *
 * The two cases are the same model with one switch flipped — which is exactly
 * the Lucas-critique lesson.
 */

/** Okun's law: a one-point rise in unemployment costs about 0.5% of output. */
const OKUN = 0.5;

export interface PhillipsPath {
  t: number;
  pi: number;
  piE: number;
  u: number;
  Y: number;
  /** (Y − Yn)/Yn, as a fraction. */
  outputGap: number;
}

export interface PhillipsCore {
  pi0: number;
  target: number;
  Yn: number;
  naturalU: number;
  /** Unemployment at the moment the disinflation starts. */
  impactU: number;
  /** Excess unemployment summed over the whole adjustment (percentage-point periods). */
  excessUnemployment: number;
  /** 1/(βθ) — the textbook sacrifice ratio, by closed form. */
  sacrificeRatio: number;
  /** Output given up, as a fraction of one year's potential output. */
  outputCost: number;
  /** Periods for half the expectation gap to close. */
  halfLife: number;
  trace: CalcStep[];
}

const pcExpr: Expr = sub(v("piE"), mul(v("beta"), sub(v("u"), v("un"))));
const impactExpr: Expr = add(v("un"), div(sub(v("piE"), v("piStar")), v("beta")));
const sacrificeExpr: Expr = div(num(1), mul(v("beta"), v("theta")));
const lossExpr: Expr = mul(num(OKUN), div(sub(v("piE"), v("piStar")), mul(v("beta"), v("theta"))));

/** Walk the disinflation forward under the chosen expectations regime. */
export function phillipsPath(
  e: Economy,
  mode: Expectations,
  horizon = 40,
  steps?: number,
): PhillipsPath[] {
  const periods = steps ?? Math.max(20, Math.min(600, Math.round(horizon)));
  const Yn = naturalOutput(e);
  const dt = horizon / periods;
  let piE = mode === "credible" ? e.piTarget : e.piE;
  const out: PhillipsPath[] = [];
  for (let i = 0; i <= periods; i++) {
    // Cold turkey: the bank delivers the target immediately and holds it.
    const pi = e.piTarget;
    const u = e.un - (pi - piE) / e.pcBeta;
    const outputGap = -OKUN * (u - e.un);
    out.push({ t: i * dt, pi, piE, u, Y: Yn * (1 + outputGap), outputGap });
    piE += e.theta * (pi - piE) * dt;
  }
  return out;
}

export function phillipsCore(e: Economy, mode: Expectations): PhillipsCore {
  const t = new Tracer();
  const env = { piE: e.piE, piStar: e.piTarget, beta: e.pcBeta, un: e.un, theta: e.theta, u: e.un };
  const Yn = naturalOutput(e);

  t.step(
    "Inflation before the disinflation (π = πᵉ at u = uₙ)",
    evaluate(pcExpr, env),
    pcExpr,
    env,
    "The starting point: the central bank has been validating expectations",
  );
  const adaptive = mode === "adaptive";
  // With credible expectations the announcement moves πᵉ at once, so the curve
  // shifts down rather than the economy sliding along it: unemployment never
  // leaves its natural rate. Only the adaptive case has to travel the long way.
  const impactU = adaptive
    ? t.step(
        "Unemployment at impact",
        evaluate(impactExpr, env),
        impactExpr,
        env,
        "πᵉ is still at the old rate, so the curve says unemployment must rise",
      )
    : t.step(
        "Unemployment at impact",
        e.un,
        add(v("un"), div(sub(v("piE"), v("piStar")), v("beta"))),
        { un: e.un, piE: e.piTarget, piStar: e.piTarget, beta: e.pcBeta },
        "Expectations jump to the target, so this is just uₙ",
      );
  t.step("Output gap (Okun's law)", -OKUN * (impactU - e.un), mul(num(-OKUN), sub(v("u"), v("un"))), {
    u: impactU,
    un: e.un,
  });
  const sacrificeRatio = t.step(
    "Sacrifice ratio 1/(βθ)",
    evaluate(sacrificeExpr, env),
    sacrificeExpr,
    env,
    "Percentage points of excess unemployment per point of disinflation; infinite if expectations never adapt",
  );
  const outputCost = t.step(
    "Output cost",
    evaluate(lossExpr, env),
    lossExpr,
    env,
    "Fraction of one year's potential output given up, as a share of GDP",
  );

  const excessUnemployment = adaptive ? (e.piE - e.piTarget) / (e.pcBeta * e.theta) : 0;
  const halfLife = adaptive && e.theta < 1 ? Math.log(0.5) / Math.log(1 - e.theta) : 0;

  return {
    pi0: e.piE,
    target: e.piTarget,
    Yn,
    naturalU: e.un,
    impactU,
    excessUnemployment,
    sacrificeRatio: adaptive ? sacrificeRatio : 0,
    outputCost: adaptive ? outputCost : 0,
    halfLife,
    trace: t.steps,
  };
}

export function phillips(e: Economy, mode: Expectations, horizon = 40): Panel[] {
  const core = phillipsCore(e, mode);
  const adaptive = mode === "adaptive";
  // Whole periods, so dt = 1 and summing the path is exactly the integral.
  const path = phillipsPath(e, mode, horizon, Math.max(20, Math.min(600, Math.round(horizon))));
  const pathExcess = path.reduce((s, p) => s + (p.u - e.un), 0);
  const disinflation = e.piE - e.piTarget;
  // What the same disinflation would cost under slow expectations: this is the
  // number that makes the credible case's zero visible.
  const adaptiveCostPct = ((disinflation / (e.pcBeta * e.theta)) * OKUN) * 100;

  const uLo = Math.min(core.naturalU - 0.03, core.impactU - 0.01);
  const uHi = Math.max(core.naturalU + 0.06, core.impactU + 0.02);
  const uRange = linspace(uLo, uHi, 90);
  const curve = (piE: number) => uRange.map((u) => ({ x: u * 100, y: (piE - e.pcBeta * (u - e.un)) * 100 }));

  const ys = [...curve(core.pi0), ...curve(core.target)].map((p) => p.y);
  const yLo = Math.min(...ys) - 1;
  const yHi = Math.max(...ys) + 1;

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  const markers = [{ x: core.naturalU * 100, y: core.pi0 * 100, label: "start" }];
  if (adaptive && core.impactU > core.naturalU + 1e-6) {
    markers.push({ x: core.impactU * 100, y: core.target * 100, label: "impact" });
  }
  markers.push({ x: core.naturalU * 100, y: core.target * 100, label: "target" });

  return [
    {
      id: "phillips-curve",
      title: "The Phillips curve and the disinflation",
      description: adaptive
        ? "The short-run curve is drawn at the old expectation (dashed) and at the target. With adaptive expectations the economy slides down the old curve — unemployment must rise — and only then does the curve shift down."
        : "A credible announcement shifts the short-run curve straight down: the economy moves from the old curve to the target curve at the natural rate, with no rise in unemployment.",
      chart: {
        xLabel: "Unemployment (%)",
        yLabel: "Inflation (%)",
        series: [
          { label: `Short-run PC at πᵉ = ${pct(core.pi0)}`, points: curve(core.pi0), dashed: true },
          { label: `Short-run PC at πᵉ = ${pct(core.target)}`, points: curve(core.target) },
          {
            label: "Long-run PC",
            points: [
              { x: core.naturalU * 100, y: yLo },
              { x: core.naturalU * 100, y: yHi },
            ],
            dashed: true,
          },
        ],
        markers,
      },
      scalars: [
        { label: "Inflation before", value: core.pi0 },
        { label: "Inflation target", value: core.target },
        { label: "Natural unemployment uₙ", value: core.naturalU },
        ...(adaptive
          ? [
              { label: "Unemployment at impact", value: core.impactU, hint: "uₙ + (πᵉ − π*)/β" },
              {
                label: "Sacrifice ratio",
                value: core.sacrificeRatio,
                hint: "1/(βθ): points of excess unemployment per point of disinflation. Higher β or faster adaptation makes disinflation cheaper.",
              },
              {
                label: "Output cost (share of a year)",
                value: core.outputCost,
                hint: "Okun's law applied to the whole path: 0.5·(πᵉ − π*)/(βθ)",
              },
              { label: "Expectation half-life", value: core.halfLife, unit: "periods" },
            ]
          : [
              { label: "Excess unemployment", value: 0, hint: "Expectations moved with the announcement" },
              { label: "Sacrifice ratio", value: 0 },
              { label: "Output cost (share of a year)", value: 0 },
            ]),
      ],
      notes: adaptive
        ? [
            `Expectations are slow (θ = ${e.theta}), so the bank has to hold inflation below what people expect. Unemployment peaks at ${pct(core.impactU)} and the economy gives up about ${(core.outputCost * 100).toFixed(1)}% of a year's output.`,
            `The sacrifice ratio 1/(βθ) = ${core.sacrificeRatio.toFixed(2)}. Make expectations adapt faster (raise θ) or make the curve steeper (raise β) and the same disinflation costs less.`,
            "This is the Lucas critique in one picture: the cost depends on a behavioural parameter — how people form expectations — not on the policy announcement itself.",
          ]
        : [
            "A credible announcement moves expectations immediately, so the short-run curve shifts down without the economy sliding along it: inflation falls and unemployment never leaves uₙ.",
            `The same disinflation that costs ${adaptiveCostPct.toFixed(1)}% of a year's output under slow expectations costs nothing here. That gap is what central-bank credibility is worth.`,
            "The honest caveat: credibility is assumed, not modelled. Real announcements are only partly believed, so the truth lies between these two panels.",
          ],
      trace: core.trace,
    },
    {
      id: "phillips-dynamics",
      title: `Inflation, expectations and unemployment — next ${horizon} periods`,
      description: adaptive
        ? "Inflation drops to the target at once, but expected inflation only catches up gradually (dπᵉ/dt = θ(π − πᵉ)), so unemployment stays above the natural rate for a while."
        : "With credible expectations all three lines are flat: inflation is at target and unemployment at its natural rate from period zero.",
      timeseries: {
        xLabel: "Time",
        yLabel: "Percent",
        series: [
          { label: "Inflation π", points: path.map((p) => ({ x: p.t, y: p.pi * 100 })) },
          { label: "Expected inflation πᵉ", points: path.map((p) => ({ x: p.t, y: p.piE * 100 })) },
          { label: "Unemployment u", points: path.map((p) => ({ x: p.t, y: p.u * 100 })) },
          { label: "Natural rate uₙ", points: path.map((p) => ({ x: p.t, y: e.un * 100 })), dashed: true },
        ],
      },
      scalars: [
        { label: "Output gap at impact", value: path[0]?.outputGap ?? 0 },
        {
          label: `Excess unemployment over ${horizon} periods`,
          value: pathExcess,
          hint: "Percentage-point periods of unemployment above uₙ; tends to the closed form 1/(βθ) times the disinflation",
        },
      ],
      trace: [],
    },
  ];
}
