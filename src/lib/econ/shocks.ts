import type { Economy } from "./types";

/**
 * A shock is a named set of parameter changes applied on top of the current
 * economy. Every model then shows the economy *with* and *without* the shock.
 */
export interface ShockDef {
  id: string;
  label: string;
  help: string;
  apply: (e: Economy) => Partial<Economy>;
}

export const SHOCK_PRESETS: ShockDef[] = [
  {
    id: "monetary",
    label: "Monetary expansion",
    help: "The central bank raises the money supply by 20%. Shifts LM right (lower r, higher Y in the short run).",
    apply: (e) => ({ M: e.M * 1.2 }),
  },
  {
    id: "fiscal",
    label: "Fiscal expansion",
    help: "Government spending rises by 20. Shifts IS right: higher output and interest rate.",
    apply: (e) => ({ G: e.G + 20 }),
  },
  {
    id: "tech",
    label: "Technology boom",
    help: "Productivity A rises 8%. Raises output for given capital and labour, and lifts potential output Yn.",
    apply: (e) => ({ A: e.A * 1.08 }),
  },
  {
    id: "saving",
    label: "Saving surge",
    help: "The saving rate rises by 8 percentage points. Higher steady-state capital, but consumption may fall if you are past the golden rule.",
    apply: (e) => ({ s: Math.min(0.6, e.s + 0.08) }),
  },
  {
    id: "oil",
    label: "Oil / import-price shock",
    help: "The foreign price level rises 25%. A negative supply shock: higher prices, lower output in the short run.",
    apply: (e) => ({ pStar: e.pStar * 1.25 }),
  },
  {
    id: "premium",
    label: "Risk-premium spike",
    help: "The country risk premium rises 3 percentage points. Raises the domestic rate above the world rate.",
    apply: (e) => ({ rho: e.rho + 0.03 }),
  },
  {
    id: "rate",
    label: "World rate hike",
    help: "The world interest rate rises 2 percentage points. Tightens conditions in an open economy.",
    apply: (e) => ({ rStar: e.rStar + 0.02 }),
  },
  {
    id: "devalue",
    label: "Devaluation (fixed peg)",
    help: "The peg is lowered 15% (a real depreciation). Boosts net exports if Marshall-Lerner holds.",
    apply: (e) => ({ fxPeg: Math.max(0.5, e.fxPeg * 0.85) }),
  },
  {
    id: "pop",
    label: "Population surge",
    help: "Population growth rises 1 percentage point. Lowers steady-state capital per worker.",
    apply: (e) => ({ n: e.n + 0.01 }),
  },
];

export function findShock(id: string): ShockDef | undefined {
  return SHOCK_PRESETS.find((s) => s.id === id);
}

/** Merge every active shock's changes onto the economy. */
export function applyShocks(economy: Economy, activeIds: string[]): { economy: Economy; applied: ShockDef[] } {
  const applied = activeIds.map(findShock).filter((s): s is ShockDef => Boolean(s));
  const merged = applied.reduce<Partial<Economy>>((acc, s) => ({ ...acc, ...s.apply(economy) }), {});
  return { economy: { ...economy, ...merged }, applied };
}
