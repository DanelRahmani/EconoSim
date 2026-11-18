import { add, mul, sub, v } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";

export interface DornbuschResult {
  sLongRun: number;
  pLongRun: number;
  s0: number;
  p0: number;
  sOld: number;
  lambda: number;
  overshootRatio: number;
  series: { t: number; s: number; p: number }[];
  trace: CalcStep[];
}

/**
 * Dornbusch overshooting. Money market m − p = φy − ηi, UIP ṡ = i − i*, and
 * sticky prices ṗ = θγ(s + p* − p). The stable eigenvector gives the saddlepath
 *   s − s̄ = (p − p̄) / (η·λ),  λ < 0
 * so a monetary expansion pushes s past its long-run value, then it appreciates back.
 */
export function dornbusch(e: Economy, dm: number, horizon = 40, steps = 200): DornbuschResult {
  const t = new Tracer();
  const phi = e.kY;
  // The model is in logs, so the money-demand slope has to be a semi-elasticity:
  // the IS-LM h is d(M/P)/di in levels, and dividing by real balances converts it.
  // Using h itself (≈ 100) made η|λ| huge and the overshoot invisible.
  const eta = (e.hR * e.P) / e.M;
  const iStar = e.rStar;
  const pStar = Math.log(e.pStar);

  const m = Math.log(e.M);
  const y = 0; // log deviation of output from trend

  // The economy starts at its old steady state; p₀ = ln P put it ~10 log points
  // away from it, so the "price path" was a climb from nowhere.
  const p0 = m - phi * y + eta * iStar;
  const pBar = m + dm - phi * y + eta * iStar;
  const sBar = pBar - pStar;
  const sOld = p0 - pStar;

  t.step("Long-run price level p̄ = m − φy + ηi*", pBar, add(sub(v("m"), mul(v("phi"), v("y"))), mul(v("eta"), v("iStar"))), { m: m + dm, phi, y, eta, iStar });
  t.step("Long-run exchange rate s̄ = p̄ − p*", sBar);

  const disc = Math.sqrt(e.theta * e.theta * e.gamma * e.gamma + (4 * e.theta * e.gamma) / eta);
  const lambda = (-e.theta * e.gamma - disc) / 2;
  t.step("Stable adjustment root λ", lambda, undefined, undefined, "Negative root of λ² + θγλ − θγ/η = 0");

  const x0 = p0 - pBar;
  const z0 = x0 / (eta * lambda);
  const s0 = sBar + z0;
  t.step("Initial jump s(0) = s̄ + (p₀−p̄)/(ηλ)", s0, undefined, undefined, "The exchange rate jumps immediately to the saddlepath");

  const overshootRatio = Math.abs(sOld - sBar) < 1e-12 ? 1 : (s0 - sOld) / (sBar - sOld);
  t.step("Overshooting ratio (s(0)−s₀_old)/(s̄−s₀_old)", overshootRatio, undefined, undefined, "Above 1 means the jump exceeds the long-run move");

  const series: { t: number; s: number; p: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const tt = (horizon * i) / steps;
    const decay = Math.exp(lambda * tt);
    series.push({ t: tt, s: sBar + z0 * decay, p: pBar + x0 * decay });
  }
  return { sLongRun: sBar, pLongRun: pBar, s0, p0, sOld, lambda, overshootRatio, series, trace: t.steps };
}

export function dornbuschPanel(e: Economy, dmPct = 10, horizon = 40): Panel[] {
  const dm = Math.log(1 + dmPct / 100);
  const r = dornbusch(e, dm, horizon, Math.max(60, Math.min(1200, Math.round(horizon * 5))));
  return [
    {
      id: "dornbusch",
      title: `Dornbusch overshooting (${dmPct}% shock, ${horizon} periods)`,
      description:
        "Prices are sticky in the short run, so a monetary expansion depresses the interest rate and the exchange rate depreciates beyond its long-run level before appreciating back. That is overshooting.",
      // Changes from the old steady state, in percent (log points × 100): the
      // overshoot is a few percent, and in log levels it vanished into the axis.
      timeseries: {
        xLabel: "Time",
        yLabel: "% change since the shock",
        series: [
          { label: "Exchange rate s", points: r.series.map((p) => ({ x: p.t, y: (p.s - r.sOld) * 100 })) },
          { label: "Long-run s̄", points: r.series.map((p) => ({ x: p.t, y: (r.sLongRun - r.sOld) * 100 })), dashed: true },
          { label: "Price level p", points: r.series.map((p) => ({ x: p.t, y: (p.p - r.p0) * 100 })) },
        ],
      },
      scalars: [
        { label: "Depreciation on impact", value: r.s0 - r.sOld, percent: true, hint: "s(0) − s_old, in log points" },
        { label: "Long-run depreciation", value: r.sLongRun - r.sOld, percent: true, hint: "Equal to the money shock: money is neutral in the long run" },
        { label: "Overshooting ratio", value: r.overshootRatio, hint: "Impact ÷ long-run move = 1 + 1/(η·|λ|)" },
        { label: "Adjustment root λ", value: r.lambda, hint: "Negative: the gap closes at this rate" },
      ],
      notes: [
        "The exchange rate jumps at once to s(0), past its new long-run level, then appreciates steadily back towards it as prices catch up.",
        "The overshoot is 1/(η·|λ|) of the long-run move: it is larger when money demand is less interest-sensitive (small η) or prices adjust slowly (small |λ|). Raise γ_D or θ and prices catch up faster, so the overshoot shrinks.",
      ],
      trace: r.trace,
    },
  ];
}
