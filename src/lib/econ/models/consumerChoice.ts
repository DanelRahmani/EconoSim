import { type Expr, div, mul, num, pow, sub, v, evaluate } from "../expr";
import type { Economy, MicroOptions } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";

/**
 * Consumer choice: the tangency that generates a demand curve.
 *
 *   maximise U = x^α·y^(1−α)   subject to   pₓx + p_y y = I
 *
 * The Cobb-Douglas case solves in one line:
 *
 *   x* = αI/pₓ,   y* = (1−α)I/p_y
 *
 * and it carries a strong, testable implication: the consumer spends the share α
 * of income on x whatever the prices are. That makes the demand curve for x a
 * rectangular hyperbola with unit elasticity, so total spending pₓx* is constant.
 * Everything else in the panel is the standard diagram — budget line, the
 * indifference curve through the optimum, and the tangency condition MRS = pₓ/p_y.
 */

export interface ConsumerCore {
  x: number;
  y: number;
  utility: number;
  /** Marginal rate of substitution at the optimum. */
  mrs: number;
  priceRatio: number;
  /** Share of income spent on x — α, by construction. */
  shareX: number;
  /** Indifference-curve parameter: utility to hold constant. */
  indifference: (x: number) => number;
  trace: CalcStep[];
}

const demandXExpr: Expr = div(mul(v("alpha"), v("I")), v("px"));
const demandYExpr: Expr = div(mul(sub(num(1), v("alpha")), v("I")), v("py"));
const utilityExpr: Expr = mul(pow(v("x"), v("alpha")), pow(v("y"), sub(num(1), v("alpha"))));
const mrsExpr: Expr = mul(div(v("alpha"), sub(num(1), v("alpha"))), div(v("y"), v("x")));

export function consumerCore(m: MicroOptions): ConsumerCore {
  const t = new Tracer();
  const env = { alpha: m.weight, I: m.income, px: m.px, py: m.py };

  const x = t.step("Demand for x — x* = αI/pₓ", evaluate(demandXExpr, env), demandXExpr, env);
  const y = t.step("Demand for y — y* = (1−α)I/p_y", evaluate(demandYExpr, env), demandYExpr, env);
  const utility = t.step("Utility at the optimum", evaluate(utilityExpr, { ...env, x, y }), utilityExpr, {
    ...env,
    x,
    y,
  });
  const mrs = t.step(
    "Marginal rate of substitution at the optimum",
    evaluate(mrsExpr, { ...env, x, y }),
    mrsExpr,
    { ...env, x, y },
    "Equal to the price ratio — that is what makes this the best affordable bundle",
  );

  return {
    x,
    y,
    utility,
    mrs,
    priceRatio: m.px / m.py,
    shareX: m.weight,
    // y such that U(x, y) = U(x*, y*): the indifference curve through the optimum.
    indifference: (xv: number) => {
      if (xv <= 0) return Infinity;
      const w = m.weight;
      return Math.pow(utility / Math.pow(xv, w), 1 / (1 - w));
    },
    trace: t.steps,
  };
}

export function consumerChoice(_e: Economy, m: MicroOptions): Panel[] {
  const core = consumerCore(m);
  const xMax = (m.income / m.px) * 1.25;
  const budget = linspace(0, xMax, 40).map((x) => ({ x, y: Math.max(0, (m.income - m.px * x) / m.py) }));

  // Sample the indifference curve only where it is on the page: from the point
  // where it meets the top of the budget line to a little past the optimum.
  const yTop = m.income / m.py;
  const w = m.weight;
  const xLo = Math.pow(core.utility / Math.pow(yTop, 1 - w), 1 / w);
  const xs = linspace(Number.isFinite(xLo) && xLo > 0 ? xLo : core.x * 0.2, core.x * 3, 60);
  const indifference = xs
    .map((x) => ({ x, y: core.indifference(x) }))
    .filter((p) => Number.isFinite(p.y) && p.y >= 0 && p.y <= yTop * 1.05);

  const pxRange = linspace(m.px * 0.4, m.px * 2.2, 60);
  const demand = pxRange.map((px) => ({ x: (w * m.income) / px, y: px }));

  return [
    {
      id: "consumer-choice",
      title: "The best affordable bundle",
      description:
        "The budget line shows what is affordable; the indifference curve shows what the consumer is equally happy with. The best bundle is where the curve just touches the line — the point where the marginal rate of substitution equals the price ratio.",
      chart: {
        xLabel: "Good x",
        yLabel: "Good y",
        series: [
          { label: "Budget line", points: budget },
          { label: `Indifference curve, U = ${core.utility.toFixed(2)}`, points: indifference },
        ],
        markers: [{ x: core.x, y: core.y, label: "optimal bundle" }],
      },
      scalars: [
        { label: "x*", value: core.x },
        { label: "y*", value: core.y },
        { label: "Utility U", value: core.utility, hint: "Ordinal only — the number means nothing, the ordering does" },
        { label: "MRS at the optimum", value: core.mrs, hint: "How much y the consumer will give up for one more x" },
        { label: "Price ratio pₓ/p_y", value: core.priceRatio },
        { label: "Share of income on x", value: core.shareX, hint: "α — fixed, whatever the prices" },
        { label: "Spending on x", value: m.px * core.x },
        { label: "Spending on y", value: m.py * core.y },
      ],
      notes: [
        `The tangency condition holds exactly: MRS = ${core.mrs.toFixed(3)} equals pₓ/p_y = ${core.priceRatio.toFixed(3)}. If they differed, the consumer could trade along the budget line and do better.`,
        `Cobb-Douglas spends a fixed share of income on each good — ${(w * 100).toFixed(0)}% on x and ${((1 - w) * 100).toFixed(0)}% on y — whatever the prices are. That is what the demand curve below is really showing.`,
        "The honest caveat: utility here is ordinal, so the level is meaningless; and this is a two-good, no-saving, no-uncertainty world. The Hicks decomposition of a price change into income and substitution effects is the natural next step and is not shown.",
      ],
      trace: core.trace,
    },
    {
      id: "consumer-demand",
      title: "The demand curve that falls out of it",
      description:
        "Fix income and the price of y, and vary the price of x. The quantity demanded traces out a demand curve — and for Cobb-Douglas preferences it is a rectangular hyperbola: unit elasticity, so total spending on x never changes.",
      chart: {
        xLabel: "Quantity of x",
        yLabel: "Price of x",
        series: [{ label: "Demand for x", points: demand }],
        markers: [{ x: core.x, y: m.px, label: "you" }],
      },
      scalars: [
        { label: "Price elasticity of demand", value: -1, hint: "Exactly minus one, everywhere, for Cobb-Douglas" },
        { label: "Spending pₓ·x at any price", value: w * m.income, hint: "Constant — the unit-elastic case in one number" },
      ],
      notes: [
        "Double the price of x and the quantity halves: revenue pₓx is unchanged. A firm with Cobb-Douglas consumers faces a unit-elastic demand curve and never wants to change its price.",
        "Slide the price of x and watch the optimum move along the budget line — but the *shares* of income never move.",
      ],
      trace: [],
    },
  ];
}
