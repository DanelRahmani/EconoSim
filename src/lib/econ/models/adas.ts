import { add, div, mul, num, sub, v } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer } from "../trace";
import { bisection, linspace } from "../math";
import { solowCore } from "./solow";

/** Natural (potential) output from the Solow steady state: Yn = A·L·ŷ*. */
export function naturalOutput(e: Economy): number {
  const core = solowCore(e);
  return e.A * e.L * core.ySteady;
}

/**
 * How much of potential output survives the cost of imported inputs: 1 − m·(P* − 1).
 *
 * A share m of the economy's inputs is bought abroad at the foreign price P*
 * (1 in the baseline). Dearer imports — an oil shock — make the same factors
 * produce less, so potential output falls: LRAS and SRAS both shift left, the
 * textbook adverse supply shock. A closed economy buys nothing abroad, so its
 * factor is 1. Floored at 0.1 so an extreme P* cannot drive potential to zero.
 */
export function importCostFactor(e: Economy): number {
  if (e.openness !== "open") return 1;
  return Math.max(0.1, 1 - e.importProp * (e.pStar - 1));
}

/** Potential output in AD-AS: the Solow level, net of the imported-input cost. */
export function adasPotential(e: Economy): number {
  return naturalOutput(e) * importCostFactor(e);
}

/** Aggregate demand: output from the IS-LM block as the price level varies. */
export function adOutput(e: Economy, P: number): number {
  const D = (1 - e.c1) + (e.b * e.kY) / e.hR;
  return (e.c0 - e.c1 * e.T + e.I0 + e.G + (e.b / e.hR) * (e.M / P)) / D;
}

/**
 * Short-run aggregate supply: P = Pᵉ·(1 + λ·(Y − Yn)/Yn).
 *
 * λ is unit-free: a 1% output gap moves prices λ% above what was expected.
 * It used to be P = Pᵉ + λ(Y − Yn), which mixed a price index (≈ 1) with output
 * in levels (≈ 150): at λ = 0.5 a 1% gap raised prices 75%, and SRAS drew as an
 * almost vertical line.
 */
export function srasOutput(e: Economy, P: number, priceExpectation: number, Yn: number): number {
  return Yn * (1 + (P / priceExpectation - 1) / e.lambda);
}

/** AD solved for the price level: the P at which demand equals Y (NaN where no positive price does). */
export function adPrice(e: Economy, Y: number): number {
  const D = (1 - e.c1) + (e.b * e.kY) / e.hR;
  const autonomous = e.c0 - e.c1 * e.T + e.I0 + e.G;
  const realBalances = ((Y * D - autonomous) * e.hR) / e.b;
  return realBalances > 0 ? e.M / realBalances : Number.NaN;
}

/** Short-run equilibrium where AD meets SRAS. */
export function shortRunEquilibrium(e: Economy, priceExpectation: number, Yn: number): { Y: number; P: number } {
  const f = (P: number) => adOutput(e, P) - srasOutput(e, P, priceExpectation, Yn);
  const P = bisection(f, 0.05, 20, 1e-10, 300);
  return { Y: adOutput(e, P), P };
}

export interface AdasPath {
  t: number;
  Y: number;
  P: number;
  Pe: number;
  pi: number;
}

/** Simulate expectations adjustment: dP^e/dt = θ (P − P^e). */
export function adasPath(e: Economy, Yn: number, horizon = 60, steps = 300): AdasPath[] {
  const dt = horizon / steps;
  let Pe = e.P;
  const out: AdasPath[] = [];
  for (let i = 0; i <= steps; i++) {
    const { Y, P } = shortRunEquilibrium(e, Pe, Yn);
    const pi = (P - Pe) / Pe;
    out.push({ t: i * dt, Y, P, Pe, pi });
    Pe += e.theta * (P - Pe) * dt;
  }
  return out;
}

export function adas(e: Economy, horizon = 60): Panel[] {
  const t = new Tracer();
  const core = solowCore(e);
  const Ysolow = t.step(
    "Solow output A·L·ŷ*",
    naturalOutput(e),
    mul(v("A"), v("L"), v("y")),
    { A: e.A, L: e.L, y: core.ySteady },
    "Output at the Solow steady state",
  );
  const factor = importCostFactor(e);
  const Yn = Ysolow * factor;
  if (e.openness === "open") {
    t.step(
      "Natural output Yn (net of imported-input cost)",
      Yn,
      mul(v("Y_s"), sub(num(1), mul(v("m"), sub(v("P^*"), num(1))))),
      { Y_s: Ysolow, m: e.importProp, "P^*": e.pStar },
      factor === 0.1
        ? "Floored: the imported-input cost is never allowed to take more than 90% of potential output"
        : "A dearer foreign price level P* (an oil shock) makes the same factors produce less: LRAS shifts left",
    );
  }
  const eq = shortRunEquilibrium(e, e.P, Yn);
  t.step(
    "Short-run output Y (AD ∩ SRAS)",
    eq.Y,
    div(
      add(sub(add(v("c0"), v("I0"), v("G")), mul(v("c1"), v("T"))), mul(div(v("b"), v("hR")), div(v("M"), v("P")))),
      add(sub(num(1), v("c1")), div(mul(v("b"), v("kY")), v("hR"))),
    ),
    { c0: e.c0, c1: e.c1, I0: e.I0, G: e.G, T: e.T, M: e.M, P: eq.P, b: e.b, hR: e.hR, kY: e.kY },
  );
  const path = adasPath(e, Yn, horizon, Math.max(120, Math.min(1200, Math.round(horizon * 5))));

  // Both curves are drawn over one window of output around the equilibrium and
  // potential, so the frame shows where they cross rather than how far each
  // can run. Points with a non-positive price are dropped: there is no such
  // region to draw.
  const yLo = 0.8 * Math.min(eq.Y, Yn);
  const yHi = 1.2 * Math.max(eq.Y, Yn);
  const ys = linspace(yLo, yHi, 120);
  // AD runs off towards infinite prices as output falls; past twice the
  // equilibrium price it only squashes the crossing into the bottom of the frame.
  const pCap = 2 * Math.max(eq.P, e.P);
  const positive = (pts: { x: number; y: number }[]) => pts.filter((q) => Number.isFinite(q.y) && q.y > 0 && q.y <= pCap);
  const adPts = positive(ys.map((Y) => ({ x: Y, y: adPrice(e, Y) })));
  const srasPts = positive(ys.map((Y) => ({ x: Y, y: e.P * (1 + (e.lambda * (Y - Yn)) / Yn) })));
  const prices = [...adPts, ...srasPts].map((q) => q.y);
  const pLo = Math.min(...prices);
  const pHi = Math.max(...prices);

  return [
    {
      id: "adas",
      title: "AD-AS equilibrium",
      description:
        "Aggregate demand (derived from IS-LM) meets short-run aggregate supply. Where the economy sits relative to LRAS determines the output gap and inflation pressure.",
      chart: {
        xLabel: "Output (Y)",
        yLabel: "Price level (P)",
        series: [
          { label: "AD", points: adPts },
          { label: "SRAS", points: srasPts },
          { label: "LRAS", points: [{ x: Yn, y: pLo }, { x: Yn, y: pHi }], dashed: true },
        ],
        markers: [{ x: eq.Y, y: eq.P, label: "E" }],
      },
      scalars: [
        { label: "Natural output (Yn)", value: Yn },
        { label: "Output (Y*)", value: eq.Y },
        { label: "Price level (P*)", value: eq.P },
        { label: "Output gap (Y−Yn)", value: eq.Y - Yn },
      ],
      notes: [
        eq.Y > Yn
          ? "Output is above potential: inflation pressures rise and expectations adjust upward."
          : eq.Y < Yn
            ? "Output is below potential: inflation pressures fall and expectations adjust downward."
            : "The economy is already at potential output.",
      ],
      trace: t.steps,
    },
    {
      id: "adas-dynamics",
      title: `Adjustment to the long run: next ${horizon} periods`,
      description: "With sticky expectations, output and prices converge over time to the LRAS level (dP^e/dt = θ·(P − P^e)).",
      // Both paths in percent, so they share an axis: output (≈ 150) and the
      // price index (≈ 1) drawn as levels left the price line flat along zero.
      timeseries: {
        xLabel: "Time",
        yLabel: "Percent",
        series: [
          { label: "Output gap (% of Yn)", points: path.map((p) => ({ x: p.t, y: ((p.Y - Yn) / Yn) * 100 })) },
          { label: "Price level (% above start)", points: path.map((p) => ({ x: p.t, y: (p.P / path[0].P - 1) * 100 })) },
          { label: "Potential (gap = 0)", points: path.map((p) => ({ x: p.t, y: 0 })), dashed: true },
        ],
      },
      trace: [],
    },
  ];
}
