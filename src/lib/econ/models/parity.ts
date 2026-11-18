import { add, div, mul, num, sub, v } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer } from "../trace";
import { linspace } from "../math";

/** Covered interest parity deviation: forward premium minus interest differential. */
export function cipDeviation(i: number, iStar: number, S: number, F: number): number {
  return (F - S) / S - (i - iStar);
}

/** Uncovered interest parity deviation: domestic rate minus (world rate + premium + expected depreciation). */
export function uipDeviation(i: number, iStar: number, rho: number, expectedDepreciation: number): number {
  return i - (iStar + rho + expectedDepreciation);
}

/**
 * Real exchange rate ε = P / (S·P*), with S the price of one unit of foreign
 * currency in domestic currency. It is the price of domestic goods in terms of
 * foreign goods, the same ε as in Mundell-Fleming: a rise is a real appreciation.
 * (The old q, S times P-star over P, was its reciprocal, and was wrongly called an appreciation
 * when it rose.)
 */
export function realExchangeRate(S: number, P: number, PStar: number): number {
  return P / (S * PStar);
}

/** Absolute PPP implies S = P / P*. */
export function pppImpliedRate(P: number, PStar: number): number {
  return P / PStar;
}

/** The trilemma: at most two of these can hold at once. */
export function trilemmaCount(fixed: boolean, mobility: boolean, independent: boolean): number {
  return [fixed, mobility, independent].filter(Boolean).length;
}

export function parity(e: Economy): Panel[] {
  const t = new Tracer();
  // The nominal rate is the normalisation: one unit of foreign currency costs
  // one unit of domestic currency today. Everything else is priced against it.
  const S = 1;
  const iStar = e.rStar;
  const mobility = e.openness === "open";
  // With free capital flows and static expectations, UIP pins the domestic rate
  // to the world rate plus the risk premium. That is a consequence the panel
  // shows, not a test it runs: the deviations below are zero by construction.
  const i = t.step(
    "Domestic rate under UIP, static expectations: i = i* + ρ",
    iStar + e.rho,
    add(v("iStar"), v("rho")),
    { iStar, rho: e.rho },
    "No depreciation is expected, so only the risk premium separates the two rates",
  );
  const impliedPPP = t.step("PPP-implied exchange rate S = P/P*", pppImpliedRate(e.P, e.pStar), div(v("P"), v("P^*")), { P: e.P, "P^*": e.pStar }, "Absolute purchasing power parity");
  const q = t.step(
    "Real exchange rate ε = P/(S·P*)",
    realExchangeRate(S, e.P, e.pStar),
    div(v("P"), mul(v("S"), v("P^*"))),
    { P: e.P, S, "P^*": e.pStar },
    "Above 1: domestic goods dearer than foreign ones (real appreciation)",
  );
  const F = t.step(
    "Forward rate by covered arbitrage F = S·(1 + i − i*)",
    S * (1 + (i - iStar)),
    mul(v("S"), add(num(1), sub(v("i"), v("iStar")))),
    { S, i, iStar },
    "Covered interest parity holds by arbitrage: F is priced from it",
  );
  const premium = (F - S) / S;

  const sRange = linspace(0.5, 1.5, 60);
  const fixed = e.regime === "fixed";
  // The trilemma as a choice: a country picks two corners and gives up the third.
  const corners = mobility
    ? fixed
      ? "Fixed exchange rate and free capital mobility: monetary policy is given up (the interest rate must follow the anchor)."
      : "Free capital mobility and independent monetary policy: the exchange rate is given up and floats."
    : fixed
      ? "Fixed exchange rate and independent monetary policy: capital mobility is given up (controls)."
      : "Independent monetary policy without capital mobility: the exchange rate could be pegged too, since capital controls remove the trilemma's bite.";

  return [
    {
      id: "parity",
      title: "Exchange-rate parity conditions",
      description:
        "The building blocks of open-economy asset pricing: interest parity ties interest rates to expected exchange-rate changes, and PPP ties price levels to the exchange rate.",
      chart: {
        xLabel: "Nominal exchange rate S (domestic currency per foreign unit)",
        yLabel: "Real exchange rate ε",
        series: [{ label: "ε = P/(S·P*)", points: sRange.map((s) => ({ x: s, y: realExchangeRate(s, e.P, e.pStar) })) }],
        markers: [{ x: S, y: q, label: "current" }],
      },
      scalars: [
        { label: "Nominal rate (S)", value: S, hint: "Domestic currency per unit of foreign currency; normalised to 1" },
        { label: "PPP-implied S", value: impliedPPP, hint: "P/P*: the nominal rate at which ε = 1" },
        { label: "Real exchange rate (ε)", value: q, hint: "Higher = real appreciation" },
        { label: "Domestic rate (i)", value: i, percent: true, hint: "i* + ρ: what UIP requires with no expected depreciation" },
        { label: "Forward rate (F)", value: F, hint: "Priced by covered arbitrage" },
        { label: "Forward premium (F − S)/S", value: premium, percent: true, hint: "Equals i − i* under covered parity" },
      ],
      notes: [
        `Trilemma: ${corners}`,
        "Both parity conditions hold here by construction: the forward rate is priced from covered arbitrage, and the domestic rate is set where uncovered parity holds with no expected depreciation. The panel shows what each condition implies; it does not test them.",
        q > 1
          ? "ε > 1: home prices are high relative to foreign prices at this nominal rate, so home goods are dear and net exports are under pressure. A fall in S (nominal appreciation) would make it worse."
          : q < 1
            ? "ε < 1: home goods are cheap relative to foreign ones, which favours net exports."
            : "ε = 1: absolute PPP holds at this nominal rate.",
      ],
      trace: t.steps,
    },
  ];
}
