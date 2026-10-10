import { type Expr, add, div, mul, num, pow, sub, v, evaluate } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace, rk4 } from "../math";

export interface SolowCore {
  kSteady: number;
  ySteady: number;
  cSteady: number;
  iSteady: number;
  kGolden: number;
  cGolden: number;
  sGolden: number;
  halfLife: number;
  k0: number;
  trace: CalcStep[];
}

const breakEvenExpr: Expr = add(v("n"), v("g"), v("delta"));
const kSteadyExpr: Expr = pow(
  div(v("s"), breakEvenExpr),
  div(num(1), sub(num(1), v("alpha"))),
);
const kGoldenExpr: Expr = pow(
  div(v("alpha"), breakEvenExpr),
  div(num(1), sub(num(1), v("alpha"))),
);

/** Steady state, golden rule and convergence speed of the Solow-Swan model. */
export function solowCore(e: Economy): SolowCore {
  const t = new Tracer();
  const env = { s: e.s, n: e.n, g: e.g, delta: e.delta, alpha: e.alpha };

  const breakEven = evaluate(breakEvenExpr, env);
  t.step("Break-even investment rate n+g+δ", breakEven, breakEvenExpr, env);
  const kStar = t.step("Steady-state capital per effective worker k̂*", evaluate(kSteadyExpr, env), kSteadyExpr, env);
  const yStar = t.step("Steady-state output ŷ*", Math.pow(kStar, e.alpha), pow(v("k"), v("alpha")), { k: kStar, alpha: e.alpha });
  const cStar = t.step("Steady-state consumption ĉ*", (1 - e.s) * yStar, mul(sub(num(1), v("s")), v("y")), { s: e.s, y: yStar });
  const iStar = t.step("Steady-state investment", e.s * yStar, mul(v("s"), v("y")), { s: e.s, y: yStar });

  const sGolden = t.step("Golden-rule saving rate (s = α)", e.alpha, v("alpha"), { alpha: e.alpha });
  const kGolden = t.step("Golden-rule capital k̂_gold", evaluate(kGoldenExpr, env), kGoldenExpr, env);
  const yGolden = Math.pow(kGolden, e.alpha);
  const cGolden = t.step("Golden-rule consumption ĉ_gold", (1 - e.alpha) * yGolden, mul(sub(num(1), v("alpha")), v("y")), { alpha: e.alpha, y: yGolden });

  const halfLife = t.step(
    "Convergence half-life",
    Math.LN2 / ((1 - e.alpha) * breakEven),
    div(num(Math.LN2), mul(sub(num(1), v("alpha")), breakEvenExpr)),
    env,
    "Approximate number of periods for half the gap to the steady state to close",
  );

  return {
    kSteady: kStar,
    ySteady: yStar,
    cSteady: cStar,
    iSteady: iStar,
    kGolden,
    cGolden,
    sGolden,
    halfLife,
    k0: e.K0 / (e.A * e.L),
    trace: t.steps,
  };
}

/** Simulate the transition path dk/dt = s k^α - (n+g+δ) k. */
export function solowPath(e: Economy, horizon = 120, steps = 400): { t: number; k: number; y: number; c: number; i: number; be: number }[] {
  const be = e.n + e.g + e.delta;
  const k0 = e.K0 / (e.A * e.L);
  const raw = rk4((_, k) => e.s * Math.pow(Math.max(k, 1e-6), e.alpha) - be * k, k0, 0, horizon, steps);
  return raw.map((p) => {
    const y = Math.pow(p.y, e.alpha);
    return { t: p.t, k: p.y, y, c: (1 - e.s) * y, i: e.s * y, be: be * p.y };
  });
}

export function solow(e: Economy, horizon = 120): Panel[] {
  const core = solowCore(e);
  const path = solowPath(e, horizon);
  const be = e.n + e.g + e.delta;

  const kMax = Math.max(core.kSteady * 2.5, core.kGolden * 1.3, core.k0 * 1.5);
  const kRange = linspace(0.001, kMax, 140);

  return [
    {
      id: "solow-phase",
      title: "Solow phase diagram",
      description:
        "Investment s·k^α and break-even investment (n+g+δ)·k. Where they cross is the steady state; the golden rule maximises steady-state consumption.",
      chart: {
        xLabel: "Capital per effective worker (k̂)",
        yLabel: "Investment per effective worker",
        series: [
          { label: "s·k̂^α (actual investment)", points: kRange.map((k) => ({ x: k, y: e.s * Math.pow(k, e.alpha) })) },
          { label: "(n+g+δ)·k̂ (break-even)", points: kRange.map((k) => ({ x: k, y: be * k })), dashed: true },
        ],
        markers: [
          { x: core.kSteady, y: e.s * Math.pow(core.kSteady, e.alpha), label: "k̂*" },
          { x: core.kGolden, y: be * core.kGolden, label: "golden rule" },
        ],
      },
      scalars: [
        { label: "Steady-state k̂*", value: core.kSteady },
        { label: "Steady-state ŷ*", value: core.ySteady },
        { label: "Steady-state ĉ*", value: core.cSteady },
        { label: "Golden-rule k̂", value: core.kGolden },
        { label: "Golden-rule ĉ", value: core.cGolden },
        { label: "Half-life (periods)", value: core.halfLife },
      ],
      notes: [
        core.sGolden > e.s
          ? "Saving is below the golden-rule rate: raising s would raise long-run consumption."
          : "Saving is at or above the golden-rule rate: raising s further would lower long-run consumption.",
      ],
      trace: core.trace,
    },
    {
      id: "solow-path",
      title: "Transition path",
      description: "Starting from the current capital stock, the economy converges to its steady state (RK4 integration of the Solow ODE).",
      timeseries: {
        xLabel: "Time",
        yLabel: "Per effective worker",
        series: [
          { label: "k̂", points: path.map((p) => ({ x: p.t, y: p.k })) },
          { label: "ŷ", points: path.map((p) => ({ x: p.t, y: p.y })) },
          { label: "ĉ", points: path.map((p) => ({ x: p.t, y: p.c })) },
        ],
      },
      trace: [],
    },
  ];
}
