import type { Economy, Scenario, ShockEvent } from "./types";
import { naturalOutput, shortRunEquilibrium } from "./models/adas";
import { islmCore } from "./models/islm";

export interface ScenarioPoint {
  t: number;
  Y: number;
  P: number;
  r: number;
  Pe: number;
  shock?: string;
}

/** The economy after every shock up to and including time t. */
export function economyAt(scenario: Scenario, t: number): Economy {
  return scenario.shocks
    .filter((s) => s.t <= t)
    .reduce((acc, s) => ({ ...acc, ...s.changes }), scenario.economy);
}

/**
 * Simulate a scenario forward in time. At each step the current parameter set is
 * resolved (baseline plus any shocks already fired), the AD-AS short-run
 * equilibrium is solved, and price expectations adjust toward realised prices.
 */
export function simulateScenario(scenario: Scenario): ScenarioPoint[] {
  const { horizon, steps } = scenario;
  const dt = horizon / steps;
  const base = scenario.economy;
  let Pe = base.P;
  const out: ScenarioPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    const e = economyAt(scenario, t);
    const Yn = naturalOutput(e);
    const eq = shortRunEquilibrium(e, Pe, Yn);
    const r = islmCore(e).r;
    const fired = scenario.shocks.find((s) => Math.abs(s.t - t) < dt / 2);
    out.push({ t, Y: eq.Y, P: eq.P, r, Pe, shock: fired?.label });
    Pe += e.theta * (eq.P - Pe) * dt;
  }
  return out;
}

/** Baseline vs. shocked output, for comparison charts. */
export function baselineVsScenario(scenario: Scenario): { t: number; base: number; shocked: number }[] {
  const shocked = simulateScenario(scenario);
  const baseline = simulateScenario({ ...scenario, shocks: [] });
  return shocked.map((p, i) => ({ t: p.t, base: baseline[i]?.Y ?? 0, shocked: p.Y }));
}

/** Built-in shock presets (Simple mode). */
export function presetShocks(): Omit<ShockEvent, "id">[] {
  return [
    { t: 10, label: "Monetary expansion (M +10%)", changes: {} },
    { t: 20, label: "Fiscal expansion (G +10)", changes: { G: 30 } },
    { t: 30, label: "Productivity boom (A +5%)", changes: { A: 1.05 } },
    { t: 40, label: "Oil shock (P* +20%)", changes: { pStar: 1.2 } },
  ];
}
