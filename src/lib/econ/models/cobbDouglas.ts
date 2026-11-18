import { type Expr, div, mul, num, pow, sub, v, evaluate, withValues } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer } from "../trace";
import { linspace } from "../math";

/** Y = A K^alpha L^(1-alpha) */
export const outputExpr: Expr = mul(
  v("A"),
  pow(v("K"), v("alpha")),
  pow(v("L"), sub(num(1), v("alpha"))),
);

/** Output per worker: y = A·k^alpha (dividing Y by L). */
export const perWorkerExpr: Expr = mul(v("A"), pow(v("k"), v("alpha")));

/** Marginal product of capital: MPK = alpha·A·k^alpha / k = alpha·Y/K. */
export const mpkExpr: Expr = mul(v("alpha"), div(mul(v("A"), pow(v("k"), v("alpha"))), v("k")));

export function cobbDouglas(e: Economy): Panel[] {
  const t = new Tracer();
  const env = { A: e.A, alpha: e.alpha, L: e.L, K: e.K0 };

  const Y = t.step("Total output", evaluate(outputExpr, env), outputExpr, env);
  const y = t.step("Output per worker", Y / e.L, div(v("Y"), v("L")), { Y, L: e.L });

  const kRange = linspace(1, 800, 120);
  const yCurve = kRange.map((k) => ({ x: k, y: e.A * Math.pow(k, e.alpha) }));

  const mpkEnv = { A: e.A, alpha: e.alpha, k: e.K0 / e.L };
  const MPK = t.step("Marginal product of capital", evaluate(mpkExpr, mpkEnv), mpkExpr, mpkEnv);
  const wage = t.step(
    "Real wage (per worker)",
    (1 - e.alpha) * y,
    mul(sub(num(1), v("alpha")), v("y")),
    { y, alpha: e.alpha },
  );

  return [
    {
      id: "cobb-douglas",
      title: "Cobb-Douglas production function",
      description:
        "The production core that every other model builds on. Output per worker y = A·k^α rises with capital per worker but with diminishing returns.",
      chart: {
        xLabel: "Capital",
        yLabel: "Output",
        series: [
          { label: "Y = A·K^α·L^(1−α)", points: kRange.map((k) => ({ x: k, y: e.A * Math.pow(k, e.alpha) * Math.pow(e.L, 1 - e.alpha) })) },
        ],
        markers: [{ x: e.K0, y: Y, label: "current" }],
      },
      scalars: [
        { label: "Output (Y)", value: Y },
        { label: "Output per worker (y)", value: y },
        { label: "Marginal product of capital", value: MPK },
        { label: "Real wage", value: wage },
        { label: "Capital share (α)", value: e.alpha },
      ],
      notes: [
        "α is the capital share of income; 1−α is the labour share. Paying each factor its marginal product exhausts output: MPK·K + w·L = Y.",
        "A here is total factor productivity (Hicks-neutral). The Solow model writes the same technology as labour-augmenting, Y = K^α·(AL)^(1−α), so a 1% rise in Solow's A is a (1−α)% rise in this A.",
        `Per-worker reference curve shown; current capital K = ${e.K0}, labour L = ${e.L}.`,
      ],
      trace: t.steps,
    },
    {
      id: "cobb-douglas-perworker",
      title: "Per-worker production function",
      description: "y = A·k^α, the building block of the Solow-Swan model.",
      chart: {
        xLabel: "Capital per worker (k)",
        yLabel: "Output per worker (y)",
        series: [{ label: "y = A·k^α", points: yCurve }],
        markers: [{ x: e.K0 / e.L, y: e.A * Math.pow(e.K0 / e.L, e.alpha), label: "current" }],
      },
      trace: [
        {
          label: "Output per worker at current k",
          expr: perWorkerExpr,
          env: { A: e.A, k: e.K0 / e.L, alpha: e.alpha },
          value: e.A * Math.pow(e.K0 / e.L, e.alpha),
          note: withValues(perWorkerExpr, { A: e.A, k: e.K0 / e.L, alpha: e.alpha }),
        },
      ],
    },
  ];
}
