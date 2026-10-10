import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer } from "../trace";
import { mfCore } from "./mundellFleming";

/** Net exports: NX = X0 − m·Y − v·ε. */
export function netExports(e: Economy, Y: number, eps: number): number {
  return e.X0 - e.importProp * Y - e.fxSensitivity * eps;
}

/** Marshall-Lerner: a depreciation improves the trade balance when |ηX| + |ηM| > 1. */
export function marshallLernerSum(etaX: number, etaM: number): number {
  return etaX + etaM;
}

/** A parametric J-curve: starts worse (shortRun < 0) then improves to longRun. */
export function jCurve(t: number, tau: number, shortRun: number, longRun: number): number {
  return longRun * (1 - Math.exp(-t / tau)) + shortRun * Math.exp(-t / tau);
}

/** Terms of trade = export prices / import prices. */
export function termsOfTrade(px: number, pm: number): number {
  return px / pm;
}

export function tradeFlows(e: Economy, etaX = 0.7, etaM = 0.6, tau = 1.5): Panel[] {
  const t = new Tracer();
  const ml = marshallLernerSum(etaX, etaM);
  t.step("Marshall-Lerner sum |ηX| + |ηM|", ml, undefined, undefined, ml > 1 ? "Depreciation improves the trade balance" : "Depreciation worsens the trade balance (elasticities too low)");

  const shortRun = -1 * (e.fxSensitivity * 0.1);
  const longRun = (ml - 1) * (e.fxSensitivity * 0.2);
  const jc: { t: number; nx: number }[] = [];
  for (let i = 0; i <= 60; i++) jc.push({ t: i * 0.25, nx: jCurve(i * 0.25, tau, shortRun, longRun) });

  const tot = t.step("Terms of trade Px/Pm", termsOfTrade(1, 1));

  // Dutch disease: a resource boom (higher X0) appreciates the real exchange rate.
  const baselineEps = mfCore(e).eps;
  const boomEps = mfCore({ ...e, X0: e.X0 * 1.5 }).eps;
  t.step("Real exchange rate, baseline", baselineEps);
  t.step("Real exchange rate, resource boom", boomEps, undefined, undefined, "A boom raises export revenue and appreciates the currency");

  return [
    {
      id: "trade-flows",
      title: "Trade balance, Marshall-Lerner and the J-curve",
      description:
        "A depreciation only improves the trade balance if the Marshall-Lerner condition holds; even then, the J-curve means it worsens first before improving.",
      timeseries: {
        xLabel: "Time after depreciation",
        yLabel: "Trade balance",
        series: [{ label: "NX(t)", points: jc.map((p) => ({ x: p.t, y: p.nx })) }],
      },
      scalars: [
        { label: "Marshall-Lerner sum", value: ml, hint: "improves if > 1" },
        { label: "Terms of trade", value: tot },
        { label: "ε baseline", value: baselineEps },
        { label: "ε after resource boom", value: boomEps, hint: "Dutch disease: appreciation" },
        { label: "Appreciation from boom", value: boomEps - baselineEps },
      ],
      notes: [
        ml > 1 ? "Marshall-Lerner holds: a real depreciation raises net exports in the long run." : "Marshall-Lerner fails: elasticities are too low for depreciation to help.",
        "Dutch disease: a resource boom appreciates the real exchange rate and squeezes other tradables.",
      ],
      trace: t.steps,
    },
  ];
}
