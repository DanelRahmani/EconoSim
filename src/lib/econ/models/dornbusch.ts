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
  const eta = e.hR;
  const iStar = e.rStar;
  const pStar = Math.log(e.pStar);

  const m = Math.log(e.M);
  const p0 = Math.log(e.P);
  const y = 0; // log deviation of output from trend

  const pBar = m + dm - phi * y + eta * iStar;
  const sBar = pBar - pStar;
  const sOld = m - phi * y + eta * iStar - pStar;

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
        "Prices are sticky in the short run, so a monetary expansion depresses the interest rate and the exchange rate depreciates beyond its long-run level before appreciating back — overshooting.",
      timeseries: {
        xLabel: "Time",
        yLabel: "Log level",
        series: [
          { label: "s (exchange rate)", points: r.series.map((p) => ({ x: p.t, y: p.s })) },
          { label: "s̄ (long run)", points: r.series.map((p) => ({ x: p.t, y: r.sLongRun })) },
          { label: "p (price level)", points: r.series.map((p) => ({ x: p.t, y: p.p })) },
        ],
      },
      scalars: [
        { label: "Initial jump s(0)", value: r.s0 },
        { label: "Long-run s̄", value: r.sLongRun },
        { label: "Overshooting ratio", value: r.overshootRatio },
        { label: "Adjustment root λ", value: r.lambda },
      ],
      notes: [
        "The exchange rate jumps immediately (s(0)) then appreciates monotonically toward s̄.",
        `A larger 1/(ηλ) makes the overshoot bigger.`,
      ],
      trace: r.trace,
    },
  ];
}
