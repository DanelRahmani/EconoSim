import { add, div, mul, num, sub, v } from "../expr";
import type { Economy, TradeOptions } from "../types";
import type { Panel } from "../panel";
import { Tracer } from "../trace";
import { mfCore } from "./mundellFleming";

/** Net exports in the Mundell-Fleming block: NX = X0 − m·Y − v·ln ε. */
export function netExports(e: Economy, Y: number, eps: number): number {
  return e.X0 - e.importProp * Y - e.fxSensitivity * Math.log(eps);
}

/** Marshall-Lerner: a depreciation improves the trade balance when ηX + ηM > 1. */
export function marshallLernerSum(etaX: number, etaM: number): number {
  return etaX + etaM;
}

/**
 * Change in the trade balance, as a share of imports, after a depreciation d
 * from balanced trade: export volumes rise ηX·d, import volumes fall ηM·d, and
 * each import now costs d more in home currency. To first order
 *   ΔTB / M = (ηX + ηM − 1)·d.
 */
export function tradeBalanceResponse(etaX: number, etaM: number, d: number): number {
  return (etaX + etaM - 1) * d;
}

/**
 * Elasticities grow over time as contracts roll over and buyers switch supplier:
 * η(t) = η_SR + (η_LR − η_SR)(1 − e^(−t/τ)).
 */
export function elasticityAt(t: number, shortRun: number, longRun: number, tau: number): number {
  return shortRun + (longRun - shortRun) * (1 - Math.exp(-t / tau));
}

/** Kept for compatibility: a J-curve between a short-run and a long-run level. */
export function jCurve(t: number, tau: number, shortRun: number, longRun: number): number {
  return longRun * (1 - Math.exp(-t / tau)) + shortRun * Math.exp(-t / tau);
}

/** Terms of trade = export prices / import prices, in a common currency. */
export function termsOfTrade(px: number, pm: number): number {
  return px / pm;
}

/** Short-run elasticities as a share of the long-run ones: volumes barely move at first. */
export const SHORT_RUN_SHARE = 0.2;
/** Periods for elasticities to cover 63% of the way to their long-run values. */
export const ADJUSTMENT_TAU = 1.5;
/** The depreciation the J-curve experiment applies. */
export const DEPRECIATION = 0.1;

export function tradeFlows(e: Economy, trade: TradeOptions): Panel[] {
  const t = new Tracer();
  const { etaX, etaM } = trade;
  const etaXs = etaX * SHORT_RUN_SHARE;
  const etaMs = etaM * SHORT_RUN_SHARE;
  const d = DEPRECIATION;

  const ml = t.step("Marshall-Lerner sum ηX + ηM (long run)", marshallLernerSum(etaX, etaM), add(v("etaX"), v("etaM")), { etaX, etaM }, "Above 1: a depreciation improves the trade balance");
  const tbExpr = mul(sub(add(v("etaX"), v("etaM")), num(1)), v("d"));
  const shortRun = t.step(
    "Impact on the trade balance (% of imports)",
    tradeBalanceResponse(etaXs, etaMs, d) * 100,
    mul(tbExpr, num(100)),
    { etaX: etaXs, etaM: etaMs, d },
    `Short-run elasticities are ${SHORT_RUN_SHARE * 100}% of the long-run ones: dearer imports bite before volumes adjust`,
  );
  const longRun = t.step(
    "Long-run effect on the trade balance (% of imports)",
    tradeBalanceResponse(etaX, etaM, d) * 100,
    mul(tbExpr, num(100)),
    { etaX, etaM, d },
  );

  const jc: { t: number; tb: number }[] = [];
  for (let i = 0; i <= 64; i++) {
    const tt = i * 0.25;
    const ex = elasticityAt(tt, etaXs, etaX, ADJUSTMENT_TAU);
    const em = elasticityAt(tt, etaMs, etaM, ADJUSTMENT_TAU);
    jc.push({ t: tt, tb: tradeBalanceResponse(ex, em, d) * 100 });
  }

  // With one good per country, the terms of trade are the home price over the
  // foreign price at the normalised nominal rate: dearer imports (an oil shock)
  // worsen them.
  const tot = t.step("Terms of trade P/P*", termsOfTrade(e.P, e.pStar), div(v("P"), v("P^*")), { P: e.P, "P^*": e.pStar }, "Below 1 after an import-price shock");

  // Dutch disease: a resource boom (exports up 50%) appreciates the real exchange rate.
  const baselineEps = mfCore(e).eps;
  const boomEps = mfCore({ ...e, X0: e.X0 * 1.5 }).eps;
  const appreciation = t.step(
    "Real appreciation from a resource boom",
    boomEps / baselineEps - 1,
    sub(div(v("eps_boom"), v("eps")), num(1)),
    { eps_boom: boomEps, eps: baselineEps },
    "Mundell-Fleming solved again with exports 50% higher",
  );

  return [
    {
      id: "trade-flows",
      title: `Trade balance after a ${d * 100}% depreciation: Marshall-Lerner and the J-curve`,
      description:
        "A real depreciation makes exports cheaper abroad and imports dearer at home. Whether the trade balance improves depends on how strongly volumes respond (the elasticities), and because volumes respond slowly while prices change at once, it usually gets worse before it gets better: the J-curve.",
      timeseries: {
        xLabel: "Periods after the depreciation",
        yLabel: "Change in trade balance (% of imports)",
        series: [
          { label: "Trade balance change", points: jc.map((p) => ({ x: p.t, y: p.tb })) },
          { label: "No change", points: jc.map((p) => ({ x: p.t, y: 0 })), dashed: true },
        ],
      },
      scalars: [
        { label: "Marshall-Lerner sum ηX + ηM", value: ml, hint: "The trade balance improves in the long run if this exceeds 1" },
        { label: "Impact effect (% of imports)", value: shortRun },
        { label: "Long-run effect (% of imports)", value: longRun },
        { label: "Terms of trade P/P*", value: tot },
        { label: "ε baseline", value: baselineEps, hint: "Real exchange rate; higher = appreciation" },
        { label: "ε after a resource boom", value: boomEps },
        { label: "Appreciation from the boom", value: appreciation, percent: true },
      ],
      notes: [
        ml > 1
          ? `Marshall-Lerner holds (ηX + ηM = ${ml.toFixed(2)}): the depreciation improves the trade balance by ${longRun.toFixed(1)}% of imports in the long run.`
          : `Marshall-Lerner fails (ηX + ηM = ${ml.toFixed(2)} ≤ 1): volumes do not respond enough, and the depreciation worsens the trade balance for good.`,
        shortRun < 0
          ? `On impact volumes have hardly moved, so dearer imports dominate and the balance worsens by ${Math.abs(shortRun).toFixed(1)}% of imports: the dip of the J.`
          : "Even the short-run elasticities exceed 1 here, so there is no J-curve dip.",
        "The Mundell-Fleming block assumes Marshall-Lerner always holds (its net exports rise with any depreciation); this panel is where you can see what happens when it does not.",
        "Dutch disease: a resource boom appreciates the real exchange rate and squeezes the other tradable sectors.",
      ],
      trace: t.steps,
    },
  ];
}
