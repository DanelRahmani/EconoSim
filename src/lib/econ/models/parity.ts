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

/** Real exchange rate: S times P-star over P. A rise is a real appreciation. */
export function realExchangeRate(S: number, P: number, PStar: number): number {
  return (S * PStar) / P;
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
  const S = 1;
  const i = e.rStar + e.rho; // domestic rate that clears UIP with static expectations
  const iStar = e.rStar;
  const impliedPPP = pppImpliedRate(e.P, e.pStar);
  const q = realExchangeRate(S, e.P, e.pStar);
  const F = S * (1 + (i - iStar));
  const cip = cipDeviation(i, iStar, S, F);
  const uip = uipDeviation(i, iStar, e.rho, 0);

  t.step("PPP-implied exchange rate S = P/P*", impliedPPP, undefined, undefined, "Absolute purchasing power parity");
  t.step("Real exchange rate q = S·P*/P", q);
  t.step("CIP-implied forward rate F", F);
  t.step("CIP deviation", cip, undefined, undefined, "Zero when covered parity holds");
  t.step("UIP deviation", uip, undefined, undefined, "Zero when uncovered parity holds");

  const sRange = linspace(0.5, 1.5, 60);
  const fixed = e.regime === "fixed";
  const mobility = e.openness === "open";
  const independent = !fixed;
  const count = trilemmaCount(fixed, mobility, independent);

  return [
    {
      id: "parity",
      title: "Exchange-rate parity conditions",
      description:
        "The building blocks of open-economy asset pricing: interest parity ties interest rates to expected exchange-rate changes, and PPP ties price levels to the exchange rate.",
      chart: {
        xLabel: "Nominal exchange rate (S)",
        yLabel: "Real exchange rate (q)",
        series: [{ label: "q = S·P*/P", points: sRange.map((s) => ({ x: s, y: realExchangeRate(s, e.P, e.pStar) })) }],
        markers: [{ x: S, y: q, label: "current" }],
      },
      scalars: [
        { label: "Nominal rate (S)", value: S },
        { label: "PPP-implied S", value: impliedPPP },
        { label: "Real exchange rate (q)", value: q },
        { label: "Domestic rate (i)", value: i },
        { label: "CIP forward (F)", value: F },
        { label: "CIP deviation", value: cip },
        { label: "UIP deviation", value: uip },
      ],
      notes: [
        count > 2
          ? "The trilemma is violated: a fixed rate, free capital mobility and independent monetary policy cannot all hold."
          : `Trilemma: ${count} of 3 corners chosen — a consistent configuration (at most two can hold).`,
        "With static exchange-rate expectations, UIP holds when the domestic rate equals the world rate plus the risk premium.",
      ],
      trace: t.steps,
    },
  ];
}
