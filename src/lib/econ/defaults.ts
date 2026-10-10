import type { Economy } from "./types";

/** A sensible, internally consistent baseline economy (see docs/models.md). */
export function defaultEconomy(): Economy {
  return {
    name: "Baseline",
    A: 1,
    alpha: 0.33,
    L: 100,
    K0: 300,

    s: 0.2,
    n: 0.01,
    g: 0.02,
    delta: 0.05,

    G: 20,
    T: 20,

    M: 90,
    P: 1,
    kY: 0.5,
    hR: 200,

    c0: 10,
    c1: 0.6,
    I0: 72,
    b: 200,

    openness: "open",
    size: "small",
    regime: "floating",
    rStar: 0.03,
    rho: 0,
    pStar: 1,
    foreignIncome: 100,
    X0: 10,
    importProp: 0.05,
    fxSensitivity: 10,
    kappa: 5,
    fxPeg: 1,

    lambda: 0.5,
    theta: 0.5,
    gamma: 0.5,
    piE: 0.05,

    // Chosen so the WS-PS natural rate matches `un` below: (m+z)/γ = 5%.
    un: 0.05,
    wagePush: 0.02,
    markup: 0.03,
    wageSlope: 1,

    pcBeta: 0.5,
    piTarget: 0.02,

    debtRatio: 0.6,
    primaryBalance: 0.01,

    reservesShare: 0.5,
    creditGrowth: 0.08,
  };
}

/** Shallow-merge a partial economy over the defaults. */
export function withDefaults(partial: Partial<Economy>): Economy {
  return { ...defaultEconomy(), ...partial };
}
