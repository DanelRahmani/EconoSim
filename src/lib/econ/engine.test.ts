import { describe, expect, it } from "vitest";
import { defaultEconomy, withDefaults } from "@/lib/econ/defaults";
import { validateEconomy } from "@/lib/econ/types";
import { COUNTRIES } from "@/lib/econ/countries";
import { MODELS, runModel } from "@/lib/econ/registry";
import { solveLinear } from "@/lib/econ/math";
import { vars, evaluate } from "@/lib/econ/expr";
import { outputExpr, perWorkerExpr } from "@/lib/econ/models/cobbDouglas";
import { solowCore, solowPath } from "@/lib/econ/models/solow";
import { islmCore } from "@/lib/econ/models/islm";
import { adasPath, naturalOutput, shortRunEquilibrium } from "@/lib/econ/models/adas";
import { mfCore } from "@/lib/econ/models/mundellFleming";
import { dornbusch } from "@/lib/econ/models/dornbusch";
import { debtNext, debtSteadyState, currentAccount, nationalSaving, investment } from "@/lib/econ/models/externalBalance";
import { marshallLernerSum, jCurve, netExports } from "@/lib/econ/models/tradeFlows";
import { uipDeviation, cipDeviation, trilemmaCount } from "@/lib/econ/models/parity";
import { simulateScenario } from "@/lib/econ/scenario";

const e = defaultEconomy();

describe("linear solver", () => {
  it("solves a 2x2 system", () => {
    const x = solveLinear([[2, 1], [1, 3]], [3, 5]);
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(0.8, 10);
    expect(x![1]).toBeCloseTo(1.4, 10);
  });
  it("returns null for a singular system", () => {
    expect(solveLinear([[1, 1], [2, 2]], [1, 2])).toBeNull();
  });
});

describe("expression AST", () => {
  it("evaluates and collects variables", () => {
    const env = { A: 2, K: 3, L: 4, alpha: 0.5 };
    expect(evaluate(outputExpr, env)).toBeCloseTo(2 * Math.sqrt(12), 10);
    expect([...vars(outputExpr)].sort()).toEqual(["A", "K", "L", "alpha"]);
  });

  it("only references symbols that exist in the economy", () => {
    const known = new Set([...Object.keys(e), "K", "Y", "y", "k", "r"]);
    for (const name of vars(outputExpr)) expect(known.has(name)).toBe(true);
    for (const name of vars(perWorkerExpr)) expect(known.has(name)).toBe(true);
  });
});

describe("Solow-Swan", () => {
  const core = solowCore(e);

  it("sits at the steady state (investment = break-even)", () => {
    const be = e.n + e.g + e.delta;
    const residual = e.s * Math.pow(core.kSteady, e.alpha) - be * core.kSteady;
    expect(Math.abs(residual)).toBeLessThan(1e-9);
  });

  it("converges to the analytical steady state", () => {
    const path = solowPath(e, 400, 800);
    const last = path[path.length - 1].k;
    expect(last).toBeCloseTo(core.kSteady, 3);
  });

  it("maximises steady-state consumption at the golden rule", () => {
    const be = e.n + e.g + e.delta;
    const c = (k: number) => Math.pow(k, e.alpha) - be * k;
    const peak = c(core.kGolden);
    expect(peak).toBeGreaterThan(c(core.kGolden * 0.8));
    expect(peak).toBeGreaterThan(c(core.kGolden * 1.2));
  });

  it("has the expected comparative statics", () => {
    const kOf = (changes: Partial<typeof e>) => solowCore({ ...e, ...changes }).kSteady;
    expect(kOf({ s: e.s + 0.05 })).toBeGreaterThan(core.kSteady);
    expect(kOf({ n: e.n + 0.02 })).toBeLessThan(core.kSteady);
    expect(kOf({ delta: e.delta + 0.02 })).toBeLessThan(core.kSteady);
  });
});

describe("IS-LM", () => {
  const c = islmCore(e);

  it("clears both markets at the reported equilibrium", () => {
    const isResidual = c.Y - (e.c0 + e.c1 * (c.Y - e.T) + e.I0 - e.b * c.r + e.G);
    const lmResidual = e.M / e.P - (e.kY * c.Y - e.hR * c.r);
    expect(Math.abs(isResidual)).toBeLessThan(1e-6);
    expect(Math.abs(lmResidual)).toBeLessThan(1e-6);
  });

  it("reports multipliers matching the numeric derivatives", () => {
    const dydG = islmCore({ ...e, G: e.G + 1 }).Y - c.Y;
    const dydM = islmCore({ ...e, M: e.M * 1.01 }).Y - c.Y;
    expect(dydG).toBeCloseTo(c.fiscalMultiplier, 6);
    expect(c.fiscalMultiplier).toBeGreaterThan(0);
    expect(c.monetaryMultiplier).toBeGreaterThan(0);
    expect(dydM).toBeGreaterThan(0);
  });
});

describe("AD-AS", () => {
  it("converges to natural output over time", () => {
    const Yn = naturalOutput(e);
    const path = adasPath(e, Yn, 200, 400);
    const first = path[0];
    const last = path[path.length - 1];
    expect(Math.abs(last.Y - Yn)).toBeLessThan(Math.max(0.01 * Yn, 1e-3));
    expect(Math.abs(last.Y - Yn)).toBeLessThan(Math.abs(first.Y - Yn) + 1e-6);
  });

  it("solves AD and SRAS consistently", () => {
    const Yn = naturalOutput(e);
    const eq = shortRunEquilibrium(e, e.P, Yn);
    expect(Number.isFinite(eq.Y)).toBe(true);
    expect(Number.isFinite(eq.P)).toBe(true);
    expect(eq.P).toBeGreaterThan(0);
  });
});

describe("Mundell-Fleming", () => {
  const smallFloat = withDefaults({ openness: "open", size: "small", regime: "floating" });

  it("floating small open economy: fiscal policy is powerless, monetary works", () => {
    const dydG = mfCore({ ...smallFloat, G: smallFloat.G + 1 }).Y - mfCore(smallFloat).Y;
    const dydM = mfCore({ ...smallFloat, M: smallFloat.M * 1.01 }).Y - mfCore(smallFloat).Y;
    expect(Math.abs(dydG)).toBeLessThan(1e-9);
    expect(dydM).toBeGreaterThan(0);
  });

  it("fixed small open economy: fiscal works, monetary is neutral", () => {
    const smallFixed = withDefaults({ openness: "open", size: "small", regime: "fixed" });
    const dydG = mfCore({ ...smallFixed, G: smallFixed.G + 1 }).Y - mfCore(smallFixed).Y;
    const dydM = mfCore({ ...smallFixed, M: smallFixed.M * 1.01 }).Y - mfCore(smallFixed).Y;
    expect(dydG).toBeGreaterThan(0);
    expect(Math.abs(dydM)).toBeLessThan(1e-9);
  });

  it("clears the goods market for a large open economy", () => {
    const large = withDefaults({ openness: "open", size: "large", regime: "floating" });
    const c = mfCore(large);
    const residual = large.c0 + large.c1 * (c.Y - large.T) + large.I0 - large.b * c.r + large.G + c.NX - c.Y;
    expect(Math.abs(residual)).toBeLessThan(1e-6);
  });
});

describe("Dornbusch overshooting", () => {
  it("overshoots the long-run rate then converges", () => {
    const r = dornbusch(defaultEconomy(), Math.log(1.1));
    expect(r.s0).toBeGreaterThan(r.sLongRun);
    expect(r.overshootRatio).toBeGreaterThan(1);
    const last = r.series[r.series.length - 1];
    expect(Math.abs(last.s - r.sLongRun)).toBeLessThan(1e-3);
    expect(last.s).toBeLessThan(r.s0);
  });
});

describe("external balance", () => {
  it("has a stable debt steady state", () => {
    const r = 0.05;
    const g = 0.02;
    const pb = 0.01;
    const dStar = debtSteadyState(r, g, pb);
    expect(debtNext(dStar, r, g, pb)).toBeCloseTo(dStar, 12);
  });

  it("defines the current account as saving minus investment", () => {
    const Y = 200;
    const r = 0.05;
    expect(currentAccount(e, Y, r)).toBeCloseTo(nationalSaving(e, Y) - investment(e, r), 12);
  });
});

describe("trade flows", () => {
  it("applies the Marshall-Lerner condition", () => {
    expect(marshallLernerSum(0.7, 0.6)).toBeGreaterThan(1);
    expect(marshallLernerSum(0.2, 0.3)).toBeLessThan(1);
  });

  it("produces a J-curve that dips then recovers", () => {
    const tau = 1.5;
    const shortRun = -1;
    const longRun = 2;
    expect(jCurve(0, tau, shortRun, longRun)).toBeLessThan(0);
    expect(jCurve(100, tau, shortRun, longRun)).toBeCloseTo(longRun, 3);
  });

  it("net exports fall with income and with appreciation", () => {
    expect(netExports(e, 200, 1)).toBeLessThan(netExports(e, 100, 1));
    expect(netExports(e, 100, 1.1)).toBeLessThan(netExports(e, 100, 0.9));
  });
});

describe("parity conditions", () => {
  it("UIP holds when i = i* + rho", () => {
    expect(uipDeviation(0.05, 0.03, 0.02, 0)).toBeCloseTo(0, 12);
  });
  it("CIP holds when the forward rate prices the differential", () => {
    expect(cipDeviation(0.05, 0.03, 1, 1.02)).toBeCloseTo(0, 12);
  });
  it("counts trilemma corners", () => {
    expect(trilemmaCount(true, true, false)).toBe(2);
    expect(trilemmaCount(true, true, true)).toBe(3);
  });
});

describe("country presets", () => {
  it("are all internally valid and reference real fields", () => {
    const keys = new Set(Object.keys(defaultEconomy()));
    for (const c of COUNTRIES) {
      const merged = withDefaults(c.params);
      expect(validateEconomy(merged), `${c.name} is invalid`).toEqual([]);
      expect(["floating", "fixed"]).toContain(merged.regime);
      expect(["small", "large"]).toContain(merged.size);
      expect(["open", "closed"]).toContain(merged.openness);
      for (const k of Object.keys(c.params)) {
        expect(keys.has(k), `${c.name}.${k} is not an Economy field`).toBe(true);
      }
    }
  });
});

describe("every model runs and produces finite output", () => {
  for (const m of MODELS) {
    it(`runs ${m.id}`, () => {
      const panels = runModel(m.id, defaultEconomy());
      expect(panels.length).toBeGreaterThan(0);
      for (const p of panels) {
        for (const s of p.trace) expect(Number.isFinite(s.value)).toBe(true);
        for (const line of p.chart?.series ?? []) {
          expect(line.points.length).toBeGreaterThan(1);
          for (const pt of line.points) {
            expect(Number.isFinite(pt.x) && Number.isFinite(pt.y)).toBe(true);
          }
        }
        for (const line of p.timeseries?.series ?? []) {
          for (const pt of line.points) {
            expect(Number.isFinite(pt.x) && Number.isFinite(pt.y)).toBe(true);
          }
        }
        for (const s of p.scalars ?? []) expect(Number.isFinite(s.value)).toBe(true);
      }
    });
  }
});

describe("scenario simulation", () => {
  it("runs shocks without producing NaNs", () => {
    const scenario = {
      economy: defaultEconomy(),
      shocks: [
        { id: "s1", t: 10, label: "Monetary expansion", changes: { M: 100 } },
        { id: "s2", t: 20, label: "Fiscal expansion", changes: { G: 30 } },
      ],
      horizon: 60,
      steps: 240,
    };
    const path = simulateScenario(scenario);
    expect(path.length).toBe(241);
    for (const p of path) {
      expect(Number.isFinite(p.Y) && Number.isFinite(p.P)).toBe(true);
    }
  });
});
