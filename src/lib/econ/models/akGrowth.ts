import { type Expr, add, div, mul, num, pow, sub, v, evaluate } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";
import { solowPath } from "./solow";

/**
 * Endogenous growth: the AK model, set against Solow.
 *
 * Solow's growth engine is exogenous — output per worker grows because A grows,
 * and the saving rate only moves the *level*. AK makes the other assumption:
 * returns to a broad measure of capital never diminish, so
 *
 *   Y = A·K,   K' = s·Y − δK   ⟹   γ = s·A − δ − n
 *
 * and the growth rate is a policy variable. A is set to the economy's *current*
 * average product of capital Y/K, so AK reproduces today's output exactly and
 * the only thing that changes is what happens next: instead of the marginal
 * product falling as capital deepens, it stays put.
 *
 * That is the whole argument in one parameter — and the honest caveat is that
 * constant returns to capital is an assumption, not a finding.
 */

export interface AkCore {
  /** A = Y/K: the average (and, in AK, constant marginal) product of capital. */
  capitalProductivity: number;
  /** γ = s·A − δ − n: the permanent growth rate of output per worker. */
  growth: number;
  /** The saving rate at which capital per worker stops shrinking: (δ+n)/A. */
  breakEvenSaving: number;
  /** Periods for output per worker to double, or Infinity if it is shrinking. */
  doublingTime: number;
  /** Output per worker today. */
  outputPerWorker: number;
  /** Output per worker at the horizon under AK and under Solow. */
  akEnd: number;
  solowEnd: number;
  solowGrowth: number;
  path: { t: number; ak: number; solow: number }[];
  trace: CalcStep[];
}

const gdpExpr: Expr = mul(v("A"), pow(v("K0"), v("alpha")), pow(v("L"), sub(num(1), v("alpha"))));
const capitalProductivityExpr: Expr = div(v("Y"), v("K"));
const growthExpr: Expr = sub(sub(mul(v("s"), v("A")), v("delta")), v("n"));
const breakEvenSavedExpr: Expr = div(add(v("delta"), v("n")), v("A"));

export function akCore(e: Economy, horizon = 120): AkCore {
  const t = new Tracer();
  const gdpNow = evaluate(gdpExpr, { A: e.A, K0: e.K0, L: e.L, alpha: e.alpha });
  t.step("Output today Y = A·K^α·L^(1−α)", gdpNow, gdpExpr, { A: e.A, K0: e.K0, L: e.L, alpha: e.alpha });

  const capitalProductivity = t.step(
    "AK capital productivity A = Y/K",
    evaluate(capitalProductivityExpr, { Y: gdpNow, K: e.K0 }),
    capitalProductivityExpr,
    { Y: gdpNow, K: e.K0 },
    "AK freezes the average product of capital instead of letting it fall as capital deepens",
  );

  const growth = t.step(
    "Growth rate γ = s·A − δ − n",
    evaluate(growthExpr, { s: e.s, A: capitalProductivity, delta: e.delta, n: e.n }),
    growthExpr,
    { s: e.s, A: capitalProductivity, delta: e.delta, n: e.n },
    "Constant forever: nothing here pulls the growth rate down",
  );

  const breakEvenSaving = t.step(
    "Break-even saving rate (δ + n)/A",
    evaluate(breakEvenSavedExpr, { delta: e.delta, n: e.n, A: capitalProductivity }),
    breakEvenSavedExpr,
    { delta: e.delta, n: e.n, A: capitalProductivity },
    "Below this the capital stock per worker shrinks",
  );

  const doublingTime = growth > 1e-9 ? Math.log(2) / growth : Infinity;

  // Per-worker output. AK grows at γ; Solow is shown with g held at zero so the
  // contrast is visible — with g > 0 Solow grows too, but only at the exogenous
  // rate, whatever the saving rate is.
  const periods = Math.max(10, Math.min(400, Math.round(horizon)));
  const ak0 = gdpNow / e.L;
  const flatG = { ...e, g: 0 };
  const solow = solowPath(flatG, horizon, Math.max(60, periods));
  const path: AkCore["path"] = [];
  for (let i = 0; i <= periods; i++) {
    const sIdx = Math.min(solow.length - 1, Math.round((i / periods) * (solow.length - 1)));
    path.push({
      t: i,
      ak: ak0 * Math.pow(1 + growth, i),
      solow: e.A * solow[sIdx].y,
    });
  }

  return {
    capitalProductivity,
    growth,
    breakEvenSaving,
    doublingTime,
    outputPerWorker: ak0,
    akEnd: path[path.length - 1].ak,
    solowEnd: path[path.length - 1].solow,
    solowGrowth: e.g,
    path,
    trace: t.steps,
  };
}

export function akGrowth(e: Economy, horizon = 120): Panel[] {
  const core = akCore(e, horizon);
  const A = core.capitalProductivity;
  const sRange = linspace(0, Math.max(0.5, core.breakEvenSaving * 2.5), 80);
  const akGrowthAt = (s: number) => (s * A - e.delta - e.n) * 100;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return [
    {
      id: "ak-growth",
      title: "Where growth comes from: saving in AK, technology in Solow",
      description:
        "In Solow the long-run growth rate of output per worker is the exogenous rate of technological progress — the saving rate is irrelevant. In AK the growth rate is s·A − δ − n, so raising saving raises growth permanently.",
      chart: {
        xLabel: "Saving rate s (%)",
        yLabel: "Long-run growth of output per worker (% per period)",
        series: [
          { label: "AK: s·A − δ − n", points: sRange.map((s) => ({ x: s * 100, y: akGrowthAt(s) })) },
          {
            label: "Solow: growth rate g",
            points: sRange.map((s) => ({ x: s * 100, y: core.solowGrowth * 100 })),
            dashed: true,
          },
          { label: "No growth", points: sRange.map((s) => ({ x: s * 100, y: 0 })), dashed: true },
        ],
        markers: [
          { x: e.s * 100, y: core.growth * 100, label: "you" },
          { x: core.breakEvenSaving * 100, y: 0, label: "break-even" },
        ],
      },
      scalars: [
        { label: "AK capital productivity A = Y/K", value: A },
        { label: "AK growth rate", value: core.growth },
        { label: "Solow long-run growth g", value: core.solowGrowth, hint: "Exogenous — the saving rate does not enter" },
        { label: "Break-even saving rate", value: core.breakEvenSaving },
        {
          label: "Doubling time",
          value: core.doublingTime,
          unit: "periods",
          hint: "ln2/γ — a permanent growth rate implies a doubling time",
        },
        { label: "Output per worker today", value: core.outputPerWorker },
      ],
      notes: [
        core.growth > core.solowGrowth
          ? `At s = ${pct(e.s)} the AK economy grows at ${pct(core.growth)} against Solow's ${pct(core.solowGrowth)}, and the gap widens with every extra point of saving.`
          : `At s = ${pct(e.s)} the AK economy grows at only ${pct(core.growth)} against Solow's ${pct(core.solowGrowth)}. Below the break-even saving rate of ${pct(core.breakEvenSaving)} the AK capital stock actually shrinks.`,
        "The two lines cross where s·A = g + δ + n. Below the crossing, Solow's world grows faster; above it, AK's does — and there is no ceiling.",
        "The honest caveat: AK is not a finding, it is an assumption. Everything rests on whether returns to a broad capital measure really are constant. If they diminish even slightly, Solow is right, the growth rate collapses back to g, and there is no growth lever in the saving rate at all.",
      ],
      trace: core.trace,
    },
    {
      id: "ak-path",
      title: `Output per worker — AK against Solow over ${horizon} periods`,
      description:
        "Solow is drawn with technological progress switched off, so the contrast is clean: its output converges to a level and stops, while AK compounds at a constant rate that never decays. Both lines are indexed to 100 in period zero.",
      timeseries: {
        xLabel: "Time",
        yLabel: "Output per worker (index, period 0 = 100)",
        series: [
          {
            label: "AK: Y = A·K",
            points: core.path.map((p) => ({ x: p.t, y: (p.ak / core.outputPerWorker) * 100 })),
          },
          {
            label: "Solow, g switched off",
            points: core.path.map((p) => ({ x: p.t, y: (p.solow / core.outputPerWorker) * 100 })),
          },
        ],
      },
      scalars: [
        { label: "AK output per worker at the horizon", value: core.akEnd },
        { label: "Solow output per worker at the horizon", value: core.solowEnd },
        {
          label: "AK ÷ Solow at the horizon",
          value: core.solowEnd > 0 ? core.akEnd / core.solowEnd : Number.NaN,
          hint: "The divergence is the model's whole point — AK has no steady state",
        },
      ],
      notes: [
        "Shorten the time window to see Solow's plateau properly — AK runs away with any long horizon, which is the point of the model.",
        "On a logarithmic axis the AK line would be perfectly straight: a constant growth rate forever, with no convergence to anything.",
      ],
      trace: [],
    },
  ];
}
