import { add, div, mul, num, sub, v } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace, solveLinear } from "../math";
import { islmCore } from "./islm";

export interface MfCore {
  Y: number;
  r: number;
  eps: number; // real exchange rate (higher = appreciation)
  M: number; // money supply (endogenous under a fixed rate)
  NX: number;
  trace: CalcStep[];
  note: string;
}

const rTarget = (e: Economy) => e.rStar + e.rho;

/**
 * Mundell-Fleming.
 *   IS: (1−c1+m)·Y + b·r + v·ε = c0 − c1·T + I0 + G + X0
 *   LM: kY·Y − hR·r = M/P
 *   BP: −m·Y + κ·r − v·ε = κ(r*+ρ) − X0
 *
 * Small country ⇒ perfect capital mobility (r = r*+ρ, horizontal BP).
 * Large country ⇒ finite κ, upward-sloping BP.
 */
export function mfCore(e: Economy): MfCore {
  const t = new Tracer();
  const env = {
    c0: e.c0,
    c1: e.c1,
    I0: e.I0,
    b: e.b,
    G: e.G,
    T: e.T,
    X0: e.X0,
    m: e.importProp,
    vv: e.fxSensitivity,
    kY: e.kY,
    hR: e.hR,
    M: e.M,
    P: e.P,
  };

  // Closed economy: fall back to plain IS-LM, no trade.
  if (e.openness === "closed") {
    const base = islmCore(e);
    t.step("Closed economy IS-LM output", base.Y, undefined, undefined, "Openness is off, so the Mundell-Fleming block collapses to IS-LM");
    return { Y: base.Y, r: base.r, eps: 0, M: e.M, NX: 0, trace: t.steps, note: "Closed economy — trade is switched off." };
  }

  const realMoney = e.M / e.P;
  const rt = rTarget(e);

  if (e.size === "small") {
    // Perfect capital mobility: r is pinned to the world rate.
    const r = t.step("World interest rate r = r* + ρ", rt, add(v("rStar"), v("rho")), { rStar: e.rStar, rho: e.rho });
    if (e.regime === "floating") {
      const Y = t.step("Output from LM at r = r*", (realMoney + e.hR * r) / e.kY, div(add(div(v("M"), v("P")), mul(v("hR"), v("r"))), v("kY")), { ...env, r });
      const eps = t.step(
        "Real exchange rate ε (clears the goods market)",
        (e.c0 - e.c1 * e.T + e.I0 + e.G + e.X0 - (1 - e.c1 + e.importProp) * Y - e.b * r) / e.fxSensitivity,
        div(sub(add(sub(add(v("c0"), v("I0"), v("G")), mul(v("c1"), v("T"))), v("X0")), add(mul(sub(add(num(1), v("m")), v("c1")), v("Y")), mul(v("b"), v("r")))), v("vv")),
        { ...env, Y, r },
      );
      const NX = e.X0 - e.importProp * Y - e.fxSensitivity * eps;
      return { Y, r, eps, M: e.M, NX, trace: t.steps, note: "Small open economy, floating rate: monetary policy is powerful, fiscal policy is not." };
    }
    // Fixed rate
    const eps = e.fxPeg;
    const Y = t.step(
      "Output with a fixed rate",
      (e.c0 - e.c1 * e.T + e.I0 - e.b * r + e.G + e.X0 - e.fxSensitivity * eps) / (1 - e.c1 + e.importProp),
      div(sub(add(sub(add(v("c0"), v("I0"), v("G")), mul(v("c1"), v("T"))), add(mul(v("b"), v("r")), mul(v("vv"), v("eps")))), v("X0")), add(num(1), v("m"), sub(num(0), v("c1")))),
      { ...env, r, eps },
    );
    const M = t.step("Money supply adjusts (endogenous)", e.P * (e.kY * Y - e.hR * r), mul(v("P"), sub(mul(v("kY"), v("Y")), mul(v("hR"), v("r")))), { ...env, Y, r });
    const NX = e.X0 - e.importProp * Y - e.fxSensitivity * eps;
    return { Y, r, eps, M, NX, trace: t.steps, note: "Small open economy, fixed rate: fiscal policy is powerful, monetary policy is not." };
  }

  // Large country: finite capital mobility, solve the system jointly.
  if (e.regime === "floating") {
    const A = [
      [1 - e.c1 + e.importProp, e.b, e.fxSensitivity],
      [e.kY, -e.hR, 0],
      [-e.importProp, e.kappa, -e.fxSensitivity],
    ];
    const bb = [
      e.c0 - e.c1 * e.T + e.I0 + e.G + e.X0,
      realMoney,
      e.kappa * rt - e.X0,
    ];
    const sol = solveLinear(A, bb) ?? [0, 0, 0];
    const [Y, r, eps] = sol;
    t.step("Joint solution for (Y, r, ε)", Y, undefined, undefined, "3×3 linear system: IS, LM and the upward-sloping BP curve");
    const NX = e.X0 - e.importProp * Y - e.fxSensitivity * eps;
    return { Y, r, eps, M: e.M, NX, trace: t.steps, note: "Large open economy, floating rate: the BP curve slopes upward, so policy spills over." };
  }
  const eps = e.fxPeg;
  const A = [
    [1 - e.c1 + e.importProp, e.b],
    [-e.importProp, e.kappa],
  ];
  const bb = [
    e.c0 - e.c1 * e.T + e.I0 + e.G + e.X0 - e.fxSensitivity * eps,
    e.kappa * rt - e.X0 + e.fxSensitivity * eps,
  ];
  const sol = solveLinear(A, bb) ?? [0, 0];
  const [Y, r] = sol;
  t.step("Joint solution for (Y, r) at a fixed rate", Y, undefined, undefined, "2×2 system: IS and BP with ε pegged");
  const M = e.P * (e.kY * Y - e.hR * r);
  const NX = e.X0 - e.importProp * Y - e.fxSensitivity * eps;
  return { Y, r, eps, M, NX, trace: t.steps, note: "Large open economy, fixed rate." };
}

export function mundellFleming(e: Economy): Panel[] {
  const core = mfCore(e);
  const rt = rTarget(e);
  const yMax = Math.max(core.Y * 2, 100);
  const ys = linspace(0, yMax, 120);
  const realMoney = e.M / e.P;

  const isR = (Y: number) =>
    (e.c0 - e.c1 * e.T + e.I0 + e.G + e.X0 - (1 - e.c1 + e.importProp) * Y - e.fxSensitivity * core.eps) / e.b;
  const lmR = (Y: number) => (e.kY * Y - realMoney) / e.hR;
  const bpR = (Y: number) =>
    e.size === "small" ? rt : (e.kappa * rt - e.X0 + e.importProp * Y + e.fxSensitivity * core.eps) / e.kappa;

  const series = [
    { label: "IS*", points: ys.map((Y) => ({ x: Y, y: isR(Y) })) },
    { label: "LM*", points: ys.map((Y) => ({ x: Y, y: lmR(Y) })) },
    { label: "BP", points: ys.map((Y) => ({ x: Y, y: bpR(Y) })), dashed: true },
  ];

  const compare = (changes: Partial<Economy>) => mfCore({ ...e, ...changes }).Y;
  const fiscalEffect = compare({ G: e.G + 1 }) - compare({ G: e.G });
  const monetaryEffect = compare({ M: e.M * 1.01 }) - compare({ M: e.M });

  return [
    {
      id: "mf",
      title: "Mundell-Fleming (IS-LM-BP)",
      description: core.note,
      chart: { xLabel: "Output (Y)", yLabel: "Interest rate (r)", series, markers: [{ x: core.Y, y: core.r, label: "E" }] },
      scalars: [
        { label: "Output (Y*)", value: core.Y },
        { label: "Interest rate (r*)", value: core.r },
        { label: "Real exchange rate (ε)", value: core.eps, hint: "higher = appreciation" },
        { label: "Net exports (NX)", value: core.NX },
        { label: "Money supply (M)", value: core.M, hint: e.regime === "fixed" ? "endogenous" : "exogenous" },
        { label: "dY per unit of G", value: fiscalEffect, hint: "fiscal multiplier" },
        { label: "dY per 1% rise in M", value: monetaryEffect, hint: "monetary effect" },
      ],
      notes: [
        e.size === "small" && e.regime === "floating"
          ? "With perfect capital mobility and a floating rate, fiscal policy is fully crowded out by the exchange rate."
          : e.size === "small" && e.regime === "fixed"
            ? "With a fixed rate, the money supply adjusts and monetary policy loses its independent effect."
            : "With imperfect mobility, both fiscal and monetary policy move output.",
      ],
      trace: core.trace,
    },
  ];
}
