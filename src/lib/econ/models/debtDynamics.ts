import { type Expr, add, div, mul, sub, v, evaluate } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";
import { debtNext, debtSteadyState } from "./externalBalance";

/**
 * Government debt dynamics — the r versus g question.
 *
 *   bₜ₊₁ = (1 + r − g)·bₜ − pb
 *
 * Debt as a ratio to GDP drifts up by the interest-growth differential applied
 * to the existing stock ("the snowball") and down by the primary balance. Three
 * numbers settle everything:
 *
 *   the snowball          (r − g)·b              — what the debt does if policy does nothing
 *   the stabilising pb    (r − g)·b              — the surplus that holds b constant
 *   the steady state      b* = pb/(r − g)        — where b settles, when r > g
 *
 * When r ≤ g a positive primary balance is not needed to stabilise debt, and
 * `debtSteadyState` (shared with the external-balance model) returns Infinity.
 */

export interface DebtCore {
  r: number;
  g: number;
  /** r − g: the interest-growth differential. */
  differential: number;
  /** (r − g)·b: contribution of the existing debt to this period's change. */
  snowball: number;
  /** Primary balance that would hold the debt ratio constant. */
  stabilisingBalance: number;
  /** Debt ratio the economy converges to, or Infinity when r ≤ g. */
  steadyState: number;
  path: { t: number; b: number }[];
  endDebt: number;
  trace: CalcStep[];
}

const snowballExpr: Expr = mul(sub(v("r"), v("g")), v("b"));
const stabiliseExpr: Expr = mul(sub(v("r"), v("g")), v("b"));
const steadyExpr: Expr = div(v("pb"), sub(v("r"), v("g")));

export function debtCore(e: Economy, horizon = 60): DebtCore {
  const t = new Tracer();
  const r = e.rStar + e.rho;
  const g = e.n + e.g;
  const differential = r - g;
  const b0 = e.debtRatio;
  const pb = e.primaryBalance;

  t.step("Interest rate r = r* + ρ", r, add(v("rStar"), v("rho")), { rStar: e.rStar, rho: e.rho });
  t.step("Growth rate g = n + g_A", g, add(v("n"), v("g")), { n: e.n, g: e.g });
  t.step(
    "Interest-growth differential r − g",
    differential,
    sub(v("r"), v("g")),
    { r, g },
    differential > 0 ? "r > g: debt snowballs without a surplus" : "r ≤ g: growth alone outruns the interest bill",
  );
  const snowball = t.step("Snowball effect (r − g)·b", evaluate(snowballExpr, { r, g, b: b0 }), snowballExpr, {
    r,
    g,
    b: b0,
  });
  const stabilisingBalance = t.step(
    "Primary balance that stabilises debt",
    evaluate(stabiliseExpr, { r, g, b: b0 }),
    stabiliseExpr,
    { r, g, b: b0 },
    "Set Δb = 0 and solve: pb* = (r − g)·b",
  );
  const steadyState = debtSteadyState(r, g, pb);
  if (Number.isFinite(steadyState)) {
    t.step("Steady-state debt b* = pb/(r − g)", steadyState, steadyExpr, { pb, r, g });
  }

  const periods = Math.max(5, Math.min(400, Math.round(horizon)));
  const path: DebtCore["path"] = [];
  let b = b0;
  for (let i = 0; i <= periods; i++) {
    path.push({ t: i, b });
    const next = debtNext(b, r, g, pb);
    if (!Number.isFinite(next)) break;
    b = next;
  }

  return {
    r,
    g,
    differential,
    snowball,
    stabilisingBalance,
    steadyState,
    path,
    endDebt: path[path.length - 1]?.b ?? b0,
    trace: t.steps,
  };
}

export function debtDynamics(e: Economy, horizon = 60): Panel[] {
  const core = debtCore(e, horizon);
  const { r, g } = core;
  const pb = e.primaryBalance;
  const finite = Number.isFinite(core.steadyState) && core.steadyState > 0;

  // The phase line: how much debt rises this period for each starting level.
  const bMax = Math.max(e.debtRatio * 2, finite ? core.steadyState * 1.6 : 0, 1.2);
  const bRange = linspace(0, bMax, 80);
  const drift = (b: number) => (r - g) * b - pb;
  return [
    {
      id: "debt-phase",
      title: "Debt dynamics: the r − g drift",
      description:
        "Each period the debt ratio drifts by (r − g)·b and is paid down by the primary balance. The balance that makes those two cancel holds the debt ratio constant — but only exactly at that level: above it the debt grows away without limit, below it the debt falls away to nothing.",
      chart: {
        xLabel: "Debt ratio b (share of GDP)",
        yLabel: "Change in debt this period (Δb)",
        series: [
          { label: "Δb = (r − g)·b − pb", points: bRange.map((b) => ({ x: b, y: drift(b) })) },
          { label: "Δb = 0", points: [{ x: 0, y: 0 }, { x: bMax, y: 0 }], dashed: true },
        ],
        markers: [
          ...(finite ? [{ x: core.steadyState, y: 0, label: "b*" }] : []),
          { x: e.debtRatio, y: drift(e.debtRatio), label: "you" },
        ],
      },
      scalars: [
        { label: "r", value: r },
        { label: "g", value: g },
        { label: "r − g", value: core.differential },
        { label: "Snowball (r−g)·b", value: core.snowball, hint: "Extra debt this period created by the existing stock" },
        {
          label: "Primary balance to stabilise",
          value: core.stabilisingBalance,
          hint: "A surplus of this size holds the debt ratio constant",
        },
        {
          label: "Current primary balance",
          value: e.primaryBalance,
          hint: "Positive = surplus after interest payments are excluded",
        },
        ...(finite
          ? [{ label: "Debt ratio that stays put", value: core.steadyState, hint: "pb/(r − g) — the balance pb exactly covers the snowball here" }]
          : [{ label: "r − g", value: core.differential, hint: "r ≤ g, so no positive debt ratio is a knife edge" }]),
        { label: `Debt in ${horizon} periods`, value: core.endDebt },
      ],
      notes: [
        core.differential <= 0
          ? "r ≤ g, so growth outruns the interest bill: debt falls on its own even with a balanced primary budget. This is the case most advanced economies sat in for much of the last two decades."
          : `r > g by ${(core.differential * 100).toFixed(1)} points, so debt snowballs at ${(core.snowball * 100).toFixed(1)}% of GDP a period unless the primary balance covers it.`,        e.primaryBalance < core.stabilisingBalance
          ? `The current primary balance (${(e.primaryBalance * 100).toFixed(1)}% of GDP) is below the stabilising balance (${(core.stabilisingBalance * 100).toFixed(1)}%), so the debt ratio is rising.`
          : `The current primary balance (${(e.primaryBalance * 100).toFixed(1)}% of GDP) exceeds the stabilising balance (${(core.stabilisingBalance * 100).toFixed(1)}%), so the debt ratio is falling.`,
        "The honest caveat: r and g are treated as constants. In reality the dangerous case is r persistently above g with r itself rising as debt grows — a feedback this linear model cannot show.",      ],
      trace: core.trace,
    },
    {
      id: "debt-path",
      title: `Debt path — next ${horizon} periods`,
      description:
        "The debt ratio under the current primary balance, against the level it started at. Whether the line climbs or falls is decided entirely by the sign of pb − (r − g)·b.",
      timeseries: {
        xLabel: "Time",
        yLabel: "Debt ratio (share of GDP)",
        series: [
          { label: "Debt ratio b", points: core.path.map((p) => ({ x: p.t, y: p.b })) },
          { label: "Starting level", points: core.path.map((p) => ({ x: p.t, y: e.debtRatio })), dashed: true },
          ...(finite
            ? [
                {
                  label: "Steady-state b*",
                  points: core.path.map((p) => ({ x: p.t, y: core.steadyState })),
                  dashed: true,
                },
              ]
            : []),
        ],
      },
      scalars: [
        {
          label: "Change over the window",
          value: core.endDebt - e.debtRatio,
          hint: "Positive means the debt ratio grew",
        },
        {
          label: "Cumulative interest bill",
          value: core.path.reduce((s, p) => s + Math.max(0, core.differential) * p.b, 0),
          hint: "Sum of the snowball term over the window, in GDP points",
        },
      ],
      trace: [],
    },
  ];
}
