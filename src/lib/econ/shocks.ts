import type { Economy } from "./types";

/**
 * A shock is a named change applied on top of the current economy. Every model
 * then shows the economy *with* and *without* it.
 *
 * Presets are parameterised by the live economy, so they stay sensible when a
 * slider moves. User-defined shocks are stored as a field + operation + amount
 * for the same reason — recomputing each render instead of freezing a number.
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
  {
    id: "ai",
    label: "AI labour substitution",
    help: "AI takes on 30% of labour tasks and each displaced worker is replaced like-for-like by capital (AI capital = 30% of the existing stock). Open the AI boom model to vary the share, the capital needed and AI's productivity.",
    apply: (e) => ({ L: e.L * 0.7, K0: e.K0 * 1.3 }),
  },
];

export function findShock(id: string): ShockDef | undefined {
  return SHOCK_PRESETS.find((s) => s.id === id);
}

/** Fields a user can shock themselves — act like a central bank or government. */
export interface CustomField {
  key: keyof Economy;
  label: string;
  group: string;
  step: number;
}

export const CUSTOM_FIELDS: CustomField[] = [
  { key: "A", label: "Technology / productivity A", group: "Production", step: 0.01 },
  { key: "g", label: "Technological growth g", group: "Growth", step: 0.001 },
  { key: "alpha", label: "Capital share α", group: "Production", step: 0.01 },
  { key: "K0", label: "Capital stock K", group: "Production", step: 10 },
  { key: "L", label: "Labour force L", group: "Production", step: 5 },
  { key: "n", label: "Population growth n (births / migration)", group: "Growth", step: 0.001 },
  { key: "s", label: "Saving rate s", group: "Growth", step: 0.01 },
  { key: "delta", label: "Depreciation δ", group: "Growth", step: 0.005 },
  { key: "G", label: "Government spending G", group: "Fiscal", step: 1 },
  { key: "T", label: "Taxes T", group: "Fiscal", step: 1 },
  { key: "M", label: "Money supply M", group: "Monetary", step: 1 },
  { key: "P", label: "Price level P", group: "Monetary", step: 0.01 },
  { key: "rStar", label: "World interest rate r*", group: "External", step: 0.001 },
  { key: "rho", label: "Risk premium ρ", group: "External", step: 0.001 },
  { key: "X0", label: "Exports X₀", group: "External", step: 1 },
  { key: "importProp", label: "Import propensity m", group: "External", step: 0.005 },
];

export type ShockMode = "percent" | "delta" | "absolute";

export type ShockSpec =
  | { kind: "preset"; id: string }
  | { kind: "custom"; id: string; label: string; key: keyof Economy; mode: ShockMode; amount: number };

export interface ResolvedShock {
  id: string;
  label: string;
  /** Short readout of what it does, e.g. "A +10%" or "n = -0.005". */
  detail: string;
}

/** Fields that must stay strictly inside (0, 1) or the model breaks. */
const UNIT_FIELDS = new Set<string>(["alpha", "c1", "s"]);
/** Fields that must stay strictly positive. */
const POSITIVE_FIELDS = new Set<string>(["A", "L", "K0", "delta", "hR", "b", "kappa", "lambda", "theta", "M", "P"]);

function clampField(key: string, value: number): number {
  if (!Number.isFinite(value)) return value;
  if (UNIT_FIELDS.has(key)) return Math.min(0.99, Math.max(0.01, value));
  if (POSITIVE_FIELDS.has(key)) return Math.max(1e-3, value);
  return value;
}

function signed(x: number, dp = 1): string {
  return `${x > 0 ? "+" : ""}${Number(x.toFixed(dp))}`;
}

export function applyMode(base: number, mode: ShockMode, amount: number): number {
  if (mode === "percent") return base * (1 + amount / 100);
  if (mode === "delta") return base + amount;
  return amount;
}

/**
 * Combine every active shock onto the economy, rebuilding each from the current
 * values so the effects stay correct while the sliders move.
 */
export function resolveShocks(economy: Economy, specs: ShockSpec[]): { economy: Economy; applied: ResolvedShock[] } {
  const changes: Partial<Economy> = {};
  const applied: ResolvedShock[] = [];

  for (const spec of specs) {
    if (spec.kind === "preset") {
      const def = findShock(spec.id);
      if (!def) continue;
      Object.assign(changes, def.apply(economy));
      applied.push({ id: spec.id, label: def.label, detail: "" });
      continue;
    }
    const base = economy[spec.key] as number;
    const next = clampField(spec.key as string, applyMode(base, spec.mode, spec.amount));
    (changes as Record<string, number>)[spec.key as string] = next;
    const detail =
      spec.mode === "absolute"
        ? `${spec.key} = ${Number(next.toFixed(4))}`
        : `${spec.key} ${spec.mode === "percent" ? `${signed(spec.amount)}%` : signed(spec.amount, 4)}`;
    applied.push({ id: spec.id, label: spec.label, detail });
  }

  return { economy: { ...economy, ...changes }, applied };
}
