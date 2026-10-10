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

/** Aggregate demand: output from the IS-LM block as the price level varies. */
export function adOutput(e: Economy, P: number): number {
  const D = (1 - e.c1) + (e.b * e.kY) / e.hR;
  return (e.c0 - e.c1 * e.T + e.I0 + e.G + (e.b / e.hR) * (e.M / P)) / D;
}

/** Short-run aggregate supply: P = P^e + λ (Y − Yn). */
export function srasOutput(e: Economy, P: number, priceExpectation: number, Yn: number): number {
  return Yn + (P - priceExpectation) / e.lambda;
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
  const Yn = naturalOutput(e);
  const core = solowCore(e);
  t.step("Natural output Yn (Solow steady state)", Yn, mul(v("A"), v("L"), v("y")), { A: e.A, L: e.L, y: core.ySteady }, "Potential output the long-run AS curve sits at");
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

  const yMax = Math.max(Yn * 1.4, eq.Y * 1.2, 100);
  const ys = linspace(1, yMax, 120);
  const ps = linspace(0.2, Math.max(eq.P * 1.6, 1.6), 120);

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
          { label: "AD", points: ps.map((P) => ({ x: adOutput(e, P), y: P })) },
          { label: "SRAS", points: ys.map((Y) => ({ x: Y, y: e.P + e.lambda * (Y - Yn) })) },
          { label: "LRAS", points: [{ x: Yn, y: 0.2 }, { x: Yn, y: 20 }], dashed: true },
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
      title: `Adjustment to the long run — next ${horizon} periods`,
      description: "With sticky expectations, output and prices converge over time to the LRAS level (dP^e/dt = θ·(P − P^e)).",
      timeseries: {
        xLabel: "Time",
        yLabel: "Value",
        series: [
          { label: "Y", points: path.map((p) => ({ x: p.t, y: p.Y })) },
          { label: "Yn", points: path.map((p) => ({ x: p.t, y: Yn })) },
          { label: "P", points: path.map((p) => ({ x: p.t, y: p.P })) },
        ],
      },
      trace: [],
    },
  ];
}
