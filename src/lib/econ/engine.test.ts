import { describe, expect, it } from "vitest";
import { defaultEconomy, withDefaults } from "@/lib/econ/defaults";
import { validateEconomy } from "@/lib/econ/types";
import { COUNTRIES } from "@/lib/econ/countries";
import {
  DEFAULT_AI,
  DEFAULT_EXPECTATIONS,
  DEFAULT_EXTERNALITY,
  DEFAULT_GAME,
  DEFAULT_MARKET,
  DEFAULT_MICRO,
  DEFAULT_MODEL,
  DEFAULT_OPTIONS,
  DEFAULT_SWEEP,
  DEFAULT_ZLB,
  MODELS,
  runModel,
} from "@/lib/econ/registry";
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
import { SHOCK_PRESETS, applyMode, resolveShocks, type ShockSpec } from "@/lib/econ/shocks";
import { GLOSSARY_ENTRIES } from "@/lib/econ/glossary";
import { decodeState, encodeState, readState, shareUrl, type SimState } from "@/lib/econ/permalink";
import { SWEEPABLE, sweepPanel } from "@/lib/econ/comparativeStatics";
import { exportName, panelToCsv, panelsToCsv } from "@/lib/econ/export";
import { axisDomain, clampWindow, pointsInWindow, zoomWindow, type Window } from "@/lib/scale";
import type { Panel } from "@/lib/econ/panel";
import { seriesToTable } from "@/lib/econ/panel";
import type { SweepParam } from "@/lib/econ/types";
import { phillipsCore, phillipsPath } from "@/lib/econ/models/phillips";
import { naturalUnemployment } from "@/lib/econ/models/labourMarket";
import { debtCore } from "@/lib/econ/models/debtDynamics";
import { akCore } from "@/lib/econ/models/akGrowth";
import { crisisCore } from "@/lib/econ/models/currencyCrisis";
import { zlbCore } from "@/lib/econ/models/zlb";
import { gameCore, GAMES } from "@/lib/econ/models/gameTheory";
import { consumerCore } from "@/lib/econ/models/consumerChoice";
import { marketCore } from "@/lib/econ/models/marketStructure";
import { externalityCore } from "@/lib/econ/models/externalities";
import { aiOutcome } from "@/lib/econ/models/aiBoom";

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

describe("shocks", () => {
  const preset = (id: string): ShockSpec => ({ kind: "preset", id });

  it("applies presets on top of the economy without mutating the base", () => {
    const base = defaultEconomy();
    const snapshot = { ...base };
    const { economy: shocked, applied } = resolveShocks(base, [preset("monetary"), preset("fiscal")]);
    expect(applied).toHaveLength(2);
    expect(shocked.M).toBeGreaterThan(base.M);
    expect(shocked.G).toBeGreaterThan(base.G);
    expect(base).toEqual(snapshot);
  });

  it("rebuilds presets from the live economy, so slider changes are respected", () => {
    const richer = { ...defaultEconomy(), M: 200 };
    expect(resolveShocks(richer, [preset("monetary")]).economy.M).toBeCloseTo(240, 10);
  });

  it("every preset only touches real Economy fields and stays valid", () => {
    const keys = new Set(Object.keys(defaultEconomy()));
    for (const s of SHOCK_PRESETS) {
      const changes = s.apply(defaultEconomy());
      for (const k of Object.keys(changes)) {
        expect(keys.has(k), `${s.id} writes unknown field ${k}`).toBe(true);
      }
      const merged = { ...defaultEconomy(), ...changes };
      expect(validateEconomy(merged), `${s.id} produces an invalid economy`).toEqual([]);
    }
  });

  it("ignores unknown preset ids", () => {
    expect(resolveShocks(defaultEconomy(), [preset("not-a-shock")]).applied).toHaveLength(0);
  });

  it("applies a user-defined shock as a percentage", () => {
    const base = defaultEconomy();
    const { economy: shocked, applied } = resolveShocks(base, [
      { kind: "custom", id: "c", label: "Tech investment boom", key: "A", mode: "percent", amount: 15 },
    ]);
    expect(shocked.A).toBeCloseTo(base.A * 1.15, 10);
    expect(applied[0].detail).toContain("A");
  });

  it("applies a user-defined shock as a delta, including negative ones", () => {
    const base = defaultEconomy();
    const { economy: shocked } = resolveShocks(base, [
      { kind: "custom", id: "c", label: "Baby bust", key: "n", mode: "delta", amount: -0.005 },
    ]);
    expect(shocked.n).toBeCloseTo(base.n - 0.005, 10);
  });

  it("clamps a custom shock that would otherwise break the model", () => {
    const { economy: shocked } = resolveShocks(defaultEconomy(), [
      { kind: "custom", id: "c", label: "Absurd saving", key: "s", mode: "absolute", amount: 5 },
    ]);
    expect(shocked.s).toBeLessThan(1);
    expect(validateEconomy(shocked)).toEqual([]);
  });

  it("covers all three operations in applyMode", () => {
    expect(applyMode(100, "percent", 10)).toBeCloseTo(110, 10);
    expect(applyMode(100, "delta", -10)).toBeCloseTo(90, 10);
    expect(applyMode(100, "absolute", 7)).toBeCloseTo(7, 10);
  });
});

describe("permalink", () => {
  const base = defaultEconomy();
  const state: SimState = {
    economy: { ...base, name: "Café growth", alpha: 0.42, G: 33 },
    model: "islm",
    compare: "both",
    horizon: 100,
    ai: { substitutionPct: 45, capitalIntensity: 2, capitalProductivity: 1.5 },
    expectations: "credible",
    micro: { px: 3, py: 1.5, income: 60, weight: 0.7 },
    market: { demandA: 30, demandB: 2, mc: 6, fixed: 20 },
    externality: { external: 4, tax: 3 },
    game: { game: "chicken", temptation: 8 },
    zlb: { demandShock: 0.35 },
    sweep: "G",
    shocks: [
      { kind: "preset", id: "fiscal" },
      { kind: "custom", id: "c1", label: "Tax cut", key: "T", mode: "percent", amount: -10 },
    ],
  };

  it("round-trips the whole view", () => {
    const back = decodeState(encodeState(state));
    expect(back).not.toBeNull();
    expect(back?.economy.name).toBe("Café growth");
    expect(back?.economy.alpha).toBeCloseTo(0.42, 10);
    expect(back?.economy.G).toBeCloseTo(33, 10);
    expect(back?.model).toBe("islm");
    expect(back?.compare).toBe("both");
    expect(back?.horizon).toBe(100);
    expect(back?.ai).toEqual(state.ai);
    expect(back?.expectations).toBe("credible");
    expect(back?.micro).toEqual(state.micro);
    expect(back?.market).toEqual(state.market);
    expect(back?.externality).toEqual(state.externality);
    expect(back?.game).toEqual(state.game);
    expect(back?.zlb).toEqual(state.zlb);
    expect(back?.sweep).toBe("G");
    expect(back?.shocks).toEqual(state.shocks);
  });

  it("survives a real query string", () => {
    const url = shareUrl(state, "https://example.com/simulator?old=1#frag");
    expect(url).not.toContain("old=1");
    expect(url).not.toContain("#frag");
    expect(readState(new URL(url).search)?.model).toBe("islm");
  });

  it("rejects garbage and versions it does not understand", () => {
    expect(decodeState(null)).toBeNull();
    expect(decodeState("")).toBeNull();
    expect(decodeState("not base64 !!")).toBeNull();
    expect(decodeState(btoa(JSON.stringify({ v: 99, e: base })))).toBeNull();
  });

  it("fills anything missing from the defaults", () => {
    const back = decodeState(btoa(JSON.stringify({ v: 1, e: { alpha: 0.5 } })));
    expect(back?.economy.alpha).toBe(0.5);
    expect(back?.economy.L).toBe(base.L);
    expect(back?.compare).toBe("current");
    expect(back?.model).toBe(DEFAULT_MODEL);
    expect(back?.ai).toEqual(DEFAULT_AI);
    expect(back?.expectations).toBe(DEFAULT_EXPECTATIONS);
    expect(back?.micro).toEqual(DEFAULT_MICRO);
    expect(back?.market).toEqual(DEFAULT_MARKET);
    expect(back?.externality).toEqual(DEFAULT_EXTERNALITY);
    expect(back?.game).toEqual(DEFAULT_GAME);
    expect(back?.zlb).toEqual(DEFAULT_ZLB);
    expect(back?.sweep).toBe(DEFAULT_SWEEP);
    expect(back?.shocks).toEqual([]);
  });

  it("clamps scenario dials to the range their sliders offer", () => {
    const token = btoa(
      JSON.stringify({
        v: 1,
        e: base,
        x: "wishful",
        mi: { px: 99, income: "lots" },
        ma: { demandB: -4 },
        ex: { external: 1e9 },
        g: { game: "solitaire", temptation: 2 },
        z: { demandShock: 5 },
        sw: "notAParameter",
      }),
    );
    const back = decodeState(token);
    expect(back?.expectations).toBe(DEFAULT_EXPECTATIONS);
    expect(back?.micro.px).toBe(5);
    expect(back?.micro.income).toBe(DEFAULT_MICRO.income);
    expect(back?.market.demandB).toBe(0.2);
    expect(back?.market.demandA).toBe(DEFAULT_MARKET.demandA);
    expect(back?.externality.external).toBe(8);
    expect(back?.game.game).toBe(DEFAULT_GAME.game);
    expect(back?.game.temptation).toBe(4);
    expect(back?.zlb.demandShock).toBeCloseTo(0.6, 10);
    expect(back?.sweep).toBe(DEFAULT_SWEEP);
  });

  it("drops wrongly typed fields but leaves range checking to validateEconomy", () => {
    const token = btoa(
      JSON.stringify({ v: 1, e: { alpha: "big", hR: null, openness: "sideways", name: 5, L: -3 } }),
    );
    const back = decodeState(token);
    expect(back?.economy.alpha).toBe(base.alpha);
    expect(back?.economy.hR).toBe(base.hR);
    expect(back?.economy.openness).toBe(base.openness);
    expect(back?.economy.name).toBe(base.name);
    // A number of the right type is left alone; the warning banner is what
    // catches it, so the two guards stay in their lanes.
    expect(back?.economy.L).toBe(-3);
    expect(validateEconomy(back!.economy).length).toBeGreaterThan(0);
  });

  it("keeps only shocks it can actually apply", () => {
    const token = btoa(
      JSON.stringify({
        v: 1,
        e: base,
        m: "no-such-model",
        c: "sideways",
        h: 1e9,
        a: { substitutionPct: 500, capitalIntensity: "lots" },
        k: [
          { kind: "preset", id: "nope" },
          { kind: "custom", key: "G", mode: "sideways", amount: 1 },
          { kind: "custom", key: "G", mode: "percent", amount: 5 },
          { kind: "custom", key: "notAField", mode: "percent", amount: 5 },
        ],
      }),
    );
    const back = decodeState(token);
    expect(back?.model).toBe(DEFAULT_MODEL);
    expect(back?.compare).toBe("current");
    expect(back?.horizon).toBe(200);
    expect(back?.ai.substitutionPct).toBe(95);
    expect(back?.ai.capitalIntensity).toBe(DEFAULT_AI.capitalIntensity);
    expect(back?.shocks).toHaveLength(1);
    expect(back?.shocks[0]).toMatchObject({ kind: "custom", key: "G", mode: "percent", amount: 5 });
  });
});

describe("Phillips curve and expectations", () => {
  const e = defaultEconomy();

  it("costs nothing when the disinflation is believed", () => {
    const credible = phillipsCore(e, "credible");
    expect(credible.sacrificeRatio).toBe(0);
    expect(credible.outputCost).toBe(0);
    expect(credible.impactU).toBeCloseTo(e.un, 12);
    const path = phillipsPath(e, "credible", 20);
    for (const p of path) {
      expect(p.u).toBeCloseTo(e.un, 12);
      expect(p.pi).toBeCloseTo(e.piTarget, 12);
    }
  });

  it("raises unemployment when expectations are slow", () => {
    const adaptive = phillipsCore(e, "adaptive");
    expect(adaptive.impactU).toBeGreaterThan(e.un);
    // u at impact = u_n + (piE - pi*)/beta
    expect(adaptive.impactU).toBeCloseTo(e.un + (e.piE - e.piTarget) / e.pcBeta, 10);
    expect(adaptive.outputCost).toBeGreaterThan(0);
  });

  it("has the textbook sacrifice ratio 1/(beta·theta)", () => {
    const adaptive = phillipsCore(e, "adaptive");
    expect(adaptive.sacrificeRatio).toBeCloseTo(1 / (e.pcBeta * e.theta), 12);
  });

  it("matches the closed form when the path is summed", () => {
    // The path integral tends to the analytic sacrifice ratio times the
    // disinflation as the window lengthens.
    const path = phillipsPath(e, "adaptive", 400, 400);
    const excess = path.reduce((s, p) => s + (p.u - e.un), 0);
    const analytic = (e.piE - e.piTarget) / (e.pcBeta * e.theta);
    expect(excess).toBeCloseTo(analytic, 1);
    expect(excess).toBeLessThan(analytic);
  });

  it("shifts the short-run curve down by the disinflation", () => {
    const adaptive = phillipsCore(e, "adaptive");
    // At unemployment = the natural rate, inflation equals expected inflation.
    const atNatural = (piE: number) => piE - e.pcBeta * (e.un - e.un);
    expect(atNatural(adaptive.pi0) - atNatural(adaptive.target)).toBeCloseTo(e.piE - e.piTarget, 12);
  });
});

describe("WS-PS labour market", () => {
  it("derives the natural rate the economy is calibrated to", () => {
    const e = defaultEconomy();
    const { exact, linear } = naturalUnemployment(e);
    // The defaults are set so the textbook linearisation lands exactly on `un`;
    // the exact solution sits just below it.
    expect(linear).toBeCloseTo(e.un, 12);
    expect(Math.abs(exact - e.un)).toBeLessThan(0.001);
  });

  it("rises with the mark-up and with wage push, and falls with the slope", () => {
    const e = defaultEconomy();
    const base = naturalUnemployment(e).exact;
    expect(naturalUnemployment({ ...e, markup: e.markup + 0.05 }).exact).toBeGreaterThan(base);
    expect(naturalUnemployment({ ...e, wagePush: e.wagePush + 0.05 }).exact).toBeGreaterThan(base);
    expect(naturalUnemployment({ ...e, wageSlope: e.wageSlope * 2 }).exact).toBeLessThan(base);
  });

  it("differs from the linearisation by exactly m²/((1+m)γ)", () => {
    const e = defaultEconomy();
    const { exact, linear } = naturalUnemployment(e);
    // The approximation error is second order in the mark-up. Stating it as an
    // identity is worth more than a hand-picked tolerance.
    expect(exact - linear).toBeCloseTo(-(e.markup ** 2) / ((1 + e.markup) * e.wageSlope), 12);
  });
});

describe("debt dynamics", () => {
  const e = defaultEconomy();

  it("drifts by the interest-growth differential net of the primary balance", () => {
    const core = debtCore(e, 10);
    expect(core.differential).toBeCloseTo(e.rStar + e.rho - (e.n + e.g), 12);
    expect(core.snowball).toBeCloseTo(core.differential * e.debtRatio, 12);
    expect(core.stabilisingBalance).toBeCloseTo(core.snowball, 12);
    // One period on: b' = (1 + r - g)b - pb
    const expected = (1 + core.differential) * e.debtRatio - e.primaryBalance;
    expect(core.path[1].b).toBeCloseTo(expected, 10);
  });

  it("makes pb/(r − g) a knife edge the ratio drifts away from", () => {
    const rich = { ...e, rStar: 0.08, rho: 0, n: 0.01, g: 0.02 };
    const star = e.primaryBalance / 0.05;
    const core = debtCore(rich, 5);
    expect(core.steadyState).toBeCloseTo(star, 10);
    // Sit exactly on it and nothing moves…
    expect(debtCore({ ...rich, debtRatio: star }, 20).endDebt).toBeCloseTo(star, 8);
    // …but above it the ratio grows away, and below it falls away.
    expect(debtCore({ ...rich, debtRatio: star * 2 }, 20).endDebt).toBeGreaterThan(star * 2);
    expect(debtCore({ ...rich, debtRatio: star / 2 }, 20).endDebt).toBeLessThan(star / 2);
  });

  it("has no steady state when r <= g", () => {
    const cheap = { ...e, rStar: 0.01 };
    expect(Number.isFinite(debtCore(cheap, 10).steadyState)).toBe(false);
  });
});

describe("AK endogenous growth", () => {
  const e = defaultEconomy();

  it("reproduces today's output and grows permanently", () => {
    const core = akCore(e, 40);
    // A = Y/K makes the AK technology exact at the current capital stock.
    expect(core.outputPerWorker).toBeCloseTo(core.capitalProductivity * (e.K0 / e.L), 8);
    expect(core.growth).toBeCloseTo(e.s * core.capitalProductivity - e.delta - e.n, 12);
    expect(core.growth).toBeGreaterThan(0);
  });

  it("has no steady state: the level keeps rising", () => {
    const core = akCore(e, 60);
    const mid = core.path[30].ak;
    const late = core.path[60].ak;
    // A constant growth rate means the ratio over equal spans is constant.
    expect(late / mid).toBeCloseTo(mid / core.path[0].ak, 6);
  });

  it("makes the growth rate rise one-for-one with the saving rate", () => {
    const low = akCore({ ...e, s: 0.1 }, 10).growth;
    const high = akCore({ ...e, s: 0.3 }, 10).growth;
    const A = akCore(e, 10).capitalProductivity;
    expect(high - low).toBeCloseTo(0.2 * A, 10);
  });
});

describe("currency crisis", () => {
  const e = defaultEconomy();

  it("dates the collapse from the credit path alone", () => {
    const core = crisisCore(e, 40);
    const expected = -Math.log(1 - e.reservesShare) / Math.log(1 + e.creditGrowth);
    expect(core.crisisTime).toBeCloseTo(expected, 10);
    expect(core.initialReserves + core.initialCredit).toBeCloseTo(e.M, 10);
  });

  it("brings reserves through zero exactly at the collapse date", () => {
    const core = crisisCore(e, 40);
    // The collapse date is a fraction of a period, so the crossing sits between
    // two samples: positive before it, negative after it.
    const before = core.path[Math.floor(core.crisisTime)];
    const after = core.path[Math.ceil(core.crisisTime)];
    expect(before.reserves).toBeGreaterThan(0);
    expect(after.reserves).toBeLessThan(0);
    expect(before.shadow).toBeLessThan(100);
    expect(after.shadow).toBeGreaterThan(100);
  });

  it("collapses sooner when credit grows faster, and never when it does not", () => {
    const slow = crisisCore({ ...e, creditGrowth: 0.04 }, 40).crisisTime;
    const fast = crisisCore({ ...e, creditGrowth: 0.16 }, 40).crisisTime;
    expect(fast).toBeLessThan(slow);
    expect(Number.isFinite(crisisCore({ ...e, creditGrowth: 0 }, 40).crisisTime)).toBe(false);
  });

  it("survives longer with more reserves", () => {
    const thin = crisisCore({ ...e, reservesShare: 0.2 }, 40).crisisTime;
    const fat = crisisCore({ ...e, reservesShare: 0.8 }, 40).crisisTime;
    expect(fat).toBeGreaterThan(thin);
  });
});

describe("zero lower bound", () => {
  const e = defaultEconomy();

  it("holds output at potential when the natural rate is positive", () => {
    const calm = zlbCore(e, 10, { demandShock: 0 });
    expect(calm.naturalRate).toBeGreaterThan(0);
    expect(calm.outputGap).toBeCloseTo(0, 8);
  });

  it("binds when the shock drives the natural rate negative", () => {
    const deep = zlbCore(e, 10, { demandShock: 0.3 });
    expect(deep.naturalRate).toBeLessThan(0);
    expect(deep.policyRate).toBe(0);
    expect(deep.outputGap).toBeLessThan(0);
  });

  it("reports the textbook multiplier comparison", () => {
    const deep = zlbCore(e, 10, { demandShock: 0.3 });
    expect(deep.multiplierAtFloor).toBeCloseTo(1 / (1 - e.c1), 12);
    expect(deep.multiplierAway).toBeCloseTo(1 / ((1 - e.c1) + (e.b * e.kY) / e.hR), 12);
    // Fiscal policy does more work on the floor than off it.
    expect(deep.multiplierAtFloor).toBeGreaterThan(deep.multiplierAway);
  });

  it("lets the bound stop binding as the shock decays", () => {
    const deep = zlbCore(e, 120, { demandShock: 0.3 });
    expect(deep.boundPeriods).toBeGreaterThan(0);
    const last = deep.path[deep.path.length - 1];
    expect(last.naturalRate).toBeGreaterThan(0);
    expect(last.Y).toBeCloseTo(last.Yn, 6);
  });
});

describe("game theory", () => {
  it("finds the dilemma's unique equilibrium and the dominant strategy", () => {
    const core = gameCore({ game: "prisoners", temptation: 5 });
    expect(core.nashCount).toBe(1);
    expect(core.nash[1][1]).toBe(true);
    expect(core.rowDominant).toBe(1);
    expect(core.colDominant).toBe(1);
    // No interior mixed equilibrium when a strategy dominates.
    expect(core.mixed).toBeNull();
    // Joint payoff lost: 2·(3 − 1).
    expect(core.dilemmaCost).toBe(4);
    // (T − R)/(T − P) = (5 − 3)/(5 − 1).
    expect(core.cooperationThreshold).toBeCloseTo(0.5, 12);
  });

  it("sustains cooperation at a lower discount factor when temptation falls", () => {
    const greedy = gameCore({ game: "prisoners", temptation: 8 }).cooperationThreshold!;
    const mild = gameCore({ game: "prisoners", temptation: 4 }).cooperationThreshold!;
    expect(mild).toBeLessThan(greedy);
    expect(mild).toBeCloseTo((4 - 3) / (4 - 1), 12);
  });

  it("finds two equilibria in the coordination game and none in matching pennies", () => {
    const coord = gameCore({ game: "coordination", temptation: 5 });
    expect(coord.nashCount).toBe(2);
    expect(coord.nash[0][0] && coord.nash[1][1]).toBe(true);

    const pennies = gameCore({ game: "matching", temptation: 5 });
    expect(pennies.nashCount).toBe(0);
    // Matching pennies is the classic case: randomise 50-50.
    expect(pennies.mixed?.p).toBeCloseTo(0.5, 10);
    expect(pennies.mixed?.q).toBeCloseTo(0.5, 10);
  });

  it("marks the right cells as best responses in chicken", () => {
    const core = gameCore({ game: "chicken", temptation: 5 });
    // Swerving is a best response when the other player goes straight, and vice versa.
    expect(core.bestResponseRow[1][0]).toBe(true);
    expect(core.bestResponseRow[0][1]).toBe(true);
    expect(core.nashCount).toBe(2);
  });

  it("plays every game it offers", () => {
    for (const g of GAMES) {
      const core = gameCore({ game: g.id, temptation: 5 });
      expect(core.nashCount).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(core.equilibriumPayoff[0])).toBe(true);
    }
  });
});

describe("consumer choice", () => {
  const m = { px: 1, py: 2, income: 24, weight: 0.5 };

  it("solves the Cobb-Douglas demands", () => {
    const core = consumerCore(m);
    expect(core.x).toBeCloseTo((m.weight * m.income) / m.px, 12);
    expect(core.y).toBeCloseTo(((1 - m.weight) * m.income) / m.py, 12);
  });

  it("satisfies the tangency condition", () => {
    const core = consumerCore(m);
    expect(core.mrs).toBeCloseTo(core.priceRatio, 10);
  });

  it("spends a fixed share of income on each good", () => {
    const core = consumerCore(m);
    expect((m.px * core.x) / m.income).toBeCloseTo(m.weight, 12);
    // Double the price of x and spending on x is unchanged: unit elasticity.
    const dear = consumerCore({ ...m, px: 2 });
    expect(dear.x).toBeCloseTo(core.x / 2, 10);
    expect(dear.x * 2).toBeCloseTo(core.x * 1, 10);
  });

  it("puts the optimum on the budget line and on the indifference curve", () => {
    const core = consumerCore(m);
    expect(m.px * core.x + m.py * core.y).toBeCloseTo(m.income, 10);
    expect(core.indifference(core.x)).toBeCloseTo(core.y, 10);
  });
});

describe("market structure", () => {
  const m = { demandA: 20, demandB: 1, mc: 4, fixed: 10 };

  it("solves competition and monopoly", () => {
    const core = marketCore(m);
    expect(core.qc).toBeCloseTo((m.demandA - m.mc) / m.demandB, 12);
    expect(core.qm).toBeCloseTo((m.demandA - m.mc) / (2 * m.demandB), 12);
    expect(core.priceM).toBeCloseTo((m.demandA + m.mc) / 2, 12);
    expect(core.priceC).toBe(m.mc);
  });

  it("has the textbook deadweight loss", () => {
    const core = marketCore(m);
    const expected = (m.demandA - m.mc) ** 2 / (8 * m.demandB);
    expect(core.deadweightLoss).toBeCloseTo(expected, 12);
    // The missing units are exactly the ones where P exceeds MC.
    expect(core.qc - core.qm).toBeCloseTo((m.demandA - m.mc) / (2 * m.demandB), 12);
  });

  it("keeps the surplus identity: lost consumer surplus = transfer + deadweight loss", () => {
    const core = marketCore(m);
    const consumerLoss = core.csC - core.csM;
    const transfer = core.psM - core.psC;
    expect(consumerLoss - transfer).toBeCloseTo(core.deadweightLoss, 10);
    expect(core.surplusC - core.surplusM).toBeCloseTo(core.deadweightLoss, 10);
  });

  it("raises the Lerner index as marginal cost falls", () => {
    const cheap = marketCore({ ...m, mc: 2 });
    expect(cheap.lerner).toBeGreaterThan(marketCore(m).lerner);
  });
});

describe("externalities and the Pigouvian tax", () => {
  const m = { demandA: 20, demandB: 1, mc: 4, fixed: 10 };

  it("over-produces by the harm when nothing is taxed", () => {
    const core = externalityCore(m, { external: 2, tax: 0 });
    expect(core.qPrivate).toBeCloseTo((m.demandA - m.mc) / m.demandB, 12);
    expect(core.qSocial).toBeCloseTo((m.demandA - m.mc - 2) / m.demandB, 12);
    expect(core.deadweightLoss).toBeCloseTo(2 ** 2 / (2 * m.demandB), 12);
  });

  it("removes the distortion exactly at the Pigouvian tax", () => {
    const core = externalityCore(m, { external: 2, tax: 2 });
    expect(core.residualLoss).toBeCloseTo(0, 12);
    expect(core.qTaxed).toBeCloseTo(core.qSocial, 10);
  });

  it("costs the same to tax too little as too much", () => {
    const under = externalityCore(m, { external: 2, tax: 1 });
    const over = externalityCore(m, { external: 2, tax: 3 });
    expect(under.residualLoss).toBeCloseTo(over.residualLoss, 12);
    expect(under.residualLoss).toBeGreaterThan(0);
  });

  it("handles an external benefit as a subsidy", () => {
    const core = externalityCore(m, { external: -2, tax: 0 });
    // With an external benefit the market under-produces: the social optimum is
    // above the private quantity.
    expect(core.qSocial).toBeGreaterThan(core.qPrivate);
  });
});

describe("AI boom scenario", () => {
  const e = defaultEconomy();
  const likeForLike = { substitutionPct: 30, capitalIntensity: 1, capitalProductivity: 1 };

  it("with no substitution, output equals the plain economy", () => {
    const r = aiOutcome(e, { ...likeForLike, substitutionPct: 0 });
    expect(r.output).toBeCloseTo(r.baselineOutput, 6);
    expect(r.aiCapital).toBeCloseTo(0, 10);
  });

  it("displaces labour and installs capital", () => {
    const r = aiOutcome(e, { ...likeForLike, substitutionPct: 25 });
    expect(r.labourEffective).toBeCloseTo(e.L * 0.75, 6);
    expect(r.aiCapital).toBeCloseTo(0.25 * e.K0, 6);
    expect(r.capitalTotal).toBeCloseTo(e.K0 + r.aiCapital, 6);
  });

  it("a like-for-like swap destroys output when capital's share is below a half", () => {
    const r = aiOutcome(e, likeForLike);
    expect(e.alpha).toBeLessThan(0.5);
    expect(r.output).toBeLessThan(r.baselineOutput);
    expect(r.change).toBeLessThan(0);
  });

  it("matches the baseline exactly at the break-even productivity", () => {
    const probe = aiOutcome(e, likeForLike);
    const atBreakEven = aiOutcome(e, { ...likeForLike, capitalProductivity: probe.breakEvenForShare });
    expect(atBreakEven.output).toBeCloseTo(atBreakEven.baselineOutput, 6);
  });

  it("wins above break-even and loses below it", () => {
    const probe = aiOutcome(e, likeForLike);
    const above = aiOutcome(e, { ...likeForLike, capitalProductivity: probe.breakEvenForShare * 1.2 });
    const below = aiOutcome(e, { ...likeForLike, capitalProductivity: probe.breakEvenForShare * 0.8 });
    expect(above.change).toBeGreaterThan(0);
    expect(below.change).toBeLessThan(0);
  });

  it("break-even rises with the share being replaced", () => {
    const small = aiOutcome(e, { ...likeForLike, substitutionPct: 10 });
    const large = aiOutcome(e, { ...likeForLike, substitutionPct: 60 });
    expect(large.breakEvenForShare).toBeGreaterThan(small.breakEvenForShare);
    expect(small.breakEvenForShare).toBeGreaterThan(small.breakEvenMarginal);
  });
});

describe("comparative statics", () => {
  const sweep = (modelId: string, param: SweepParam) =>
    sweepPanel({ modelId, modelLabel: modelId, economy: e, options: DEFAULT_OPTIONS, param });

  /** The direction cell of the row with this figure name. */
  const direction = (panel: Panel | null, label: string) => {
    const row = panel?.table?.rows.find((r) => r.label === label);
    expect(row, `no table row labelled ${label}`).toBeDefined();
    return row!.cells[3].text;
  };

  it("IS-LM: G up => output up, rate up, investment down", () => {
    const panel = sweep("islm", "G");
    expect(direction(panel, "Output (Y*)")).toBe("▲");
    expect(direction(panel, "Interest rate (r*)")).toBe("▲");
    expect(direction(panel, "Investment I")).toBe("▼");
  });

  it("Solow: a higher saving rate raises the steady state", () => {
    const panel = sweep("solow", "s");
    expect(direction(panel, "Steady-state k̂*")).toBe("▲");
    expect(direction(panel, "Steady-state ŷ*")).toBe("▲");
  });

  it("a parameter the model does not read moves nothing", () => {
    const panel = sweep("islm", "reservesShare");
    expect(panel?.table?.rows.length).toBeGreaterThan(0);
    for (const row of panel?.table?.rows ?? []) {
      expect(row.cells[3].text, `${row.label} moved for an unused parameter`).toBe("=");
    }
  });

  it("never reports a non-finite figure, and always says which way", () => {
    for (const m of MODELS) {
      const panel = sweep(m.id, "G");
      if (!panel) continue;
      expect(panel.table?.columns, `${m.id} columns`).toHaveLength(4);
      for (const row of panel.table?.rows ?? []) {
        expect(row.cells, `${m.id} · ${row.label}`).toHaveLength(4);
        for (const c of row.cells) {
          expect(c.text, `${m.id} · ${row.label}`).not.toMatch(/NaN|Infinity|undefined/);
        }
        expect(["▲", "▼", "=", "—"]).toContain(row.cells[3].text);
      }
      for (const step of panel.trace) expect(Number.isFinite(step.value)).toBe(true);
    }
  });

  it("sweeps only the numeric parameters, and only when asked", () => {
    expect(SWEEPABLE).toContain("G");
    expect(SWEEPABLE).not.toContain("name");
    expect(SWEEPABLE).not.toContain("openness");
    expect(sweep("islm", "none")).toBeNull();
    expect(sweep("islm", "name")).toBeNull();
  });
});

describe("export", () => {
  const panel: Panel = {
    id: "p",
    title: "A panel",
    scalars: [
      { label: 'Output, "gross"', value: 0.1 + 0.2 },
      { label: "Broken", value: NaN },
    ],
    table: {
      columns: ["\u2212\u03b5", "+\u03b5"],
      rows: [{ label: "k\u0302*", cells: [{ text: "1" }, { text: "2", emphasis: true }] }],
    },
    trace: [{ label: "Sum", value: 3 }],
  };

  it("quotes and escapes so a comma or a quote in a label cannot split a row", () => {
    const csv = panelToCsv(panel);
    expect(csv).toContain('"Output, ""gross""","0.3"');
  });

  it("writes full precision without float noise, and never a NaN", () => {
    const csv = panelToCsv(panel);
    expect(csv).toContain('"Output, ""gross""","0.3"');
    expect(csv).toContain('"Broken",""');
    expect(csv).not.toMatch(/NaN|Infinity/);
  });

  it("starts with a byte-order mark so Excel reads the Greek labels, and ends rows in CRLF", () => {
    const csv = panelToCsv(panel);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain('"\u2212\u03b5","+\u03b5"');
  });

  it("includes the calculation steps, which are the point of the export", () => {
    expect(panelToCsv(panel)).toContain('"Sum","3"');
  });

  it("puts every panel of a view in one file, in order", () => {
    const csv = panelsToCsv([panel, { ...panel, id: "q", title: "B panel" }]);
    expect(csv.startsWith("\uFEFF\"A panel\"")).toBe(true);
    expect(csv.indexOf("A panel")).toBeLessThan(csv.indexOf("B panel"));
    // One byte-order mark, not one per panel.
    expect(csv.split("\uFEFF")).toHaveLength(2);
  });

  it("makes a file name that is safe on disk", () => {
    expect(exportName("IS-LM", "Caf\u00e9 growth")).toBe("is-lm-cafe-growth");
    expect(exportName("../../etc/passwd")).toBe("etc-passwd");
    expect(exportName("\u03b1\u03b2\u03b3")).toBe("econosim");
  });

  it("exports every model without a non-finite figure", () => {
    for (const m of MODELS) {
      const csv = panelsToCsv(runModel(m.id, e, DEFAULT_OPTIONS));
      expect(csv, `${m.id} exported a non-finite figure`).not.toMatch(/NaN|Infinity|undefined/);
    }
  });
});

describe("data table behind a chart", () => {
  it("uses a shared x grid as the row labels", () => {
    const table = seriesToTable({
      xLabel: "k",
      yLabel: "y",
      series: [
        { label: "a", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] },
        { label: "b", points: [{ x: 0, y: 3 }, { x: 1, y: 4 }] },
      ],
    });
    expect(table?.columns).toEqual(["a", "b"]);
    expect(table?.rows.map((r) => r.label)).toEqual(["0", "1"]);
    expect(table?.rows[1].cells.map((c) => c.text)).toEqual(["2", "4"]);
  });

  it("falls back to one row per point when the series do not line up", () => {
    const table = seriesToTable({
      xLabel: "t",
      yLabel: "y",
      series: [
        { label: "a", points: [{ x: 0, y: 1 }] },
        { label: "b", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] },
      ],
    });
    expect(table?.columns).toEqual(["t", "y"]);
    expect(table?.rows).toHaveLength(3);
    expect(table?.rows.map((r) => r.label)).toEqual(["a", "b", "b"]);
  });

  it("gives every model's chart a text alternative, with no non-finite cell", () => {
    for (const m of MODELS) {
      for (const panel of runModel(m.id, e, DEFAULT_OPTIONS)) {
        const spec = panel.chart ?? panel.timeseries;
        if (!spec) continue;
        const table = seriesToTable(spec);
        expect(table, `${m.id}/${panel.id} has a chart but no table`).toBeDefined();
        expect(table!.columns.length, `${m.id}/${panel.id} columns`).toBeGreaterThan(0);
        for (const row of table!.rows) {
          expect(row.cells, `${m.id}/${panel.id} · ${row.label}`).toHaveLength(table!.columns.length);
          for (const c of row.cells) {
            expect(c.text, `${m.id}/${panel.id} · ${row.label}`).not.toMatch(/NaN|Infinity|undefined/);
          }
        }
      }
    }
  });

  it("returns nothing for a chart with no series", () => {
    expect(seriesToTable({ xLabel: "x", yLabel: "y", series: [] })).toBeUndefined();
  });

  it("mentions the chart's markers, which the rows cannot show", () => {
    const table = seriesToTable({
      xLabel: "k",
      yLabel: "y",
      series: [{ label: "a", points: [{ x: 0, y: 1 }, { x: 1, y: 2 }] }],
      markers: [{ x: 1, y: 2, label: "current" }],
    });
    expect(table?.caption).toContain("current at (1, 2)");
  });
});

describe("chart zoom", () => {
  const full: Window = [0, 100];

  it("zooms about the centre", () => {
    expect(zoomWindow(full, full, 0.5)).toEqual([25, 75]);
    expect(zoomWindow([25, 75], full, 2)).toEqual(full);
  });

  it("cannot leave the data, and refuses to collapse", () => {
    expect(zoomWindow([80, 100], full, 2)).toEqual([70, 100]);
    expect(clampWindow([-40, 50], full)).toEqual([0, 50]);
    expect(clampWindow([50, 40], full)).toEqual([40, 50]);
    expect(clampWindow([50, 50.01], full)).toBeNull();
    // Zooming a long way out is not a collapse: it just gives back the whole range.
    expect(zoomWindow(full, full, 1000)).toEqual(full);
  });

  it("stops zooming in at the limit instead of jumping back out", () => {
    let win: Window = full;
    for (let press = 0; press < 20; press++) win = zoomWindow(win, full, 0.5);
    expect(win).not.toEqual(full);
    expect(win[1] - win[0]).toBeGreaterThan(0);
    expect(win[1] - win[0]).toBeLessThan(1);
    // One more press changes nothing, rather than resetting the view.
    expect(zoomWindow(win, full, 0.5)).toEqual(win);
  });

  it("keeps the nearest point either side, so a zoomed line still reaches the frame", () => {
    const points = [0, 1, 2, 3, 4].map((x) => ({ x, y: x }));
    expect(pointsInWindow(points, [1.5, 2.5]).map((p) => p.x)).toEqual([1, 2, 3]);
    expect(pointsInWindow(points, [0, 4])).toHaveLength(5);
    expect(pointsInWindow(points, [0.5, 3.5]).map((p) => p.x)).toEqual([0, 1, 2, 3, 4]);
    expect(pointsInWindow(points, [10, 20])).toEqual([]);
  });

  it("returns to the full range on zoom out, for every chart in the app", () => {
    for (const m of MODELS) {
      for (const panel of runModel(m.id, e, DEFAULT_OPTIONS)) {
        for (const line of panel.chart?.series ?? []) {
          const domain = axisDomain(line.points.map((p) => p.x));
          const zoomed = zoomWindow(domain, domain, 0.5);
          expect(zoomed[0], `${m.id}/${line.label} did not zoom in`).toBeGreaterThan(domain[0] - 1e-9);
          expect(zoomed[1], `${m.id}/${line.label} did not zoom in`).toBeLessThan(domain[1] + 1e-9);
          const back = zoomWindow(zoomed, domain, 2);
          expect(back[0], `${m.id}/${line.label} did not come back`).toBeCloseTo(domain[0], 9);
          expect(back[1], `${m.id}/${line.label} did not come back`).toBeCloseTo(domain[1], 9);
          // A zoomed window never loses a point that falls inside it. It need not
          // contain any: a curve with points only at the ends can have an empty
          // middle, which is a thin-data chart rather than a broken one.
          const inside = line.points.filter((p) => p.x >= zoomed[0] && p.x <= zoomed[1]);
          const kept = pointsInWindow(line.points, zoomed).map((p) => p.x);
          for (const point of inside) expect(kept, `${m.id}/${line.label} dropped ${point.x}`).toContain(point.x);
        }
      }
    }
  });
});

describe("glossary", () => {
  it("every entry is explained", () => {
    expect(GLOSSARY_ENTRIES.length).toBeGreaterThan(10);
    for (const e of GLOSSARY_ENTRIES) {
      expect(e.name.length).toBeGreaterThan(0);
      expect(e.meaning.length).toBeGreaterThan(10);
    }
  });
});

describe("axis domain", () => {
  it("does not open a non-negative axis below zero", () => {
    // The regression: data running 1..800 used to give an x-axis starting at -63.
    const [lo, hi] = axisDomain([1, 800]);
    expect(lo).toBe(0);
    expect(hi).toBeGreaterThan(800);
  });

  it("keeps a quantity axis at zero when the data starts there", () => {
    expect(axisDomain([0, 11.5])[0]).toBe(0);
  });

  it("still pads data that genuinely crosses zero", () => {
    const [lo, hi] = axisDomain([-0.02, 0.03]);
    expect(lo).toBeLessThan(-0.02);
    expect(hi).toBeGreaterThan(0.03);
  });

  it("keeps the zoom of a range far from the origin", () => {
    const [lo, hi] = axisDomain([700, 900]);
    expect(lo).toBeGreaterThan(650);
    expect(lo).toBeLessThan(700);
    expect(hi).toBeGreaterThan(900);
  });

  it("copes with one value, no values, and a flat zero series", () => {
    const [lo, hi] = axisDomain([5]);
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(lo).toBeLessThan(5);
    expect(hi).toBeGreaterThan(5);
    expect(axisDomain([])).toEqual([0, 1]);
    // A flat zero line needs a window to sit in, conventionally symmetric.
    const [flatLo, flatHi] = axisDomain([0, 0]);
    expect(flatLo).toBeLessThan(0);
    expect(flatHi).toBeGreaterThan(0);
  });

  it("covers the data of every chart in the app, and starts at zero where it can", () => {
    // Mirrors what CurveChart does: one domain per axis, over every series and
    // marker of the panel together.
    for (const m of MODELS) {
      for (const panel of runModel(m.id, e, DEFAULT_OPTIONS)) {
        if (!panel.chart) continue;
        const all = [
          ...panel.chart.series.flatMap((s) => s.points),
          ...(panel.chart.markers ?? []),
        ].filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
        const xs = all.map((p) => p.x);
        const ys = all.map((p) => p.y);
        const [x0, x1] = axisDomain(xs);
        const [y0, y1] = axisDomain(ys);
        for (const x of xs) expect(x >= x0 - 1e-9 && x <= x1 + 1e-9, `${m.id} x=${x}`).toBe(true);
        for (const y of ys) expect(y >= y0 - 1e-9 && y <= y1 + 1e-9, `${m.id} y=${y}`).toBe(true);
        // Non-negative data that actually varies must not open below zero.
        if (Math.max(...xs) > Math.min(...xs) && Math.min(...xs) >= 0) {
          expect(x0, `${m.id}/${panel.id} opens its x-axis below zero`).toBeGreaterThanOrEqual(0);
        }
        if (Math.max(...ys) > Math.min(...ys) && Math.min(...ys) >= 0) {
          expect(y0, `${m.id}/${panel.id} opens its y-axis below zero`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe("time window", () => {
  const maxX = (id: string, horizon: number) => {
    const panels = runModel(id, defaultEconomy(), { ...DEFAULT_OPTIONS, horizon });
    const xs = panels.flatMap((p) => (p.timeseries?.series ?? []).flatMap((s) => s.points.map((pt) => pt.x)));
    return xs.length ? Math.max(...xs) : NaN;
  };

  it("is honoured by every time-path model", () => {
    for (const id of ["solow", "adas", "dornbusch", "external-balance"]) {
      const m = maxX(id, 10);
      expect(Number.isFinite(m), `${id} should have a time series`).toBe(true);
      expect(m, `${id} should respect a 10-period window`).toBeLessThanOrEqual(10 + 1e-6);
    }
  });

  it("widens the window when asked", () => {
    expect(maxX("solow", 100)).toBeGreaterThan(maxX("solow", 10));
    expect(maxX("adas", 100)).toBeGreaterThan(maxX("adas", 10));
  });
});
