/**
 * Shareable links.
 *
 * The whole simulator state — economy, model, comparison mode, time window,
 * scenario options and active shocks — is packed into one URL parameter, so a
 * student can send "look at this" and a lecturer can put a working example in a
 * slide deck.
 *
 * Encoding is base64url of a versioned JSON blob. That is not the most compact
 * possible scheme (~600 characters for the default economy) but it is readable,
 * debuggable and needs no schema of its own. ponytail: if links ever get too
 * long to paste, switch to deltas from the defaults plus short keys; the version
 * field is already there to make that migration safe.
 *
 * Decoding is a trust boundary: a URL is user input, so every field is checked
 * against the known defaults, enums, model ids and shock ids, and anything
 * unrecognised falls back to a default rather than reaching the engine.
 */

import { defaultEconomy } from "./defaults";
import {
  DEFAULT_AI,
  DEFAULT_EXPECTATIONS,
  DEFAULT_EXTERNALITY,
  DEFAULT_GAME,
  DEFAULT_HORIZON,
  DEFAULT_MARKET,
  DEFAULT_MICRO,
  DEFAULT_MODEL,
  DEFAULT_SWEEP,
  DEFAULT_ZLB,
  MODELS,
} from "./registry";
import { CUSTOM_FIELDS, SHOCK_PRESETS, type ShockMode, type ShockSpec } from "./shocks";
import { SWEEPABLE } from "./comparativeStatics";
import { GAMES } from "./models/gameTheory";
import { EXPECTATION_MODES } from "./types";
import type {
  AiOptions,
  Economy,
  ExternalityOptions,
  Expectations,
  GameOptions,
  MarketOptions,
  MicroOptions,
  SweepParam,
  ZlbOptions,
} from "./types";

export type CompareMode = "current" | "baseline" | "both";

export interface SimState {
  economy: Economy;
  model: string;
  compare: CompareMode;
  horizon: number;
  ai: AiOptions;
  expectations: Expectations;
  micro: MicroOptions;
  market: MarketOptions;
  externality: ExternalityOptions;
  game: GameOptions;
  zlb: ZlbOptions;
  sweep: SweepParam;
  shocks: ShockSpec[];
}

/** Query-string key holding the packed state. */
export const PERMALINK_PARAM = "s";
const VERSION = 1;
const MAX_SHOCKS = 20;

/** Only the pseudo-model is not in the registry. */
const MODEL_IDS = [...MODELS.map((m) => m.id), "glossary"];
const COMPARE_MODES: CompareMode[] = ["current", "baseline", "both"];
const SHOCK_MODES: ShockMode[] = ["percent", "delta", "absolute"];
const OPENNESS = ["closed", "open"];
const SIZES = ["small", "large"];
const REGIMES = ["floating", "fixed"];
const GAME_IDS: GameOptions["game"][] = GAMES.map((g) => g.id);

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64(token: string): string {
  const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeState(s: SimState): string {
  return toBase64(
    JSON.stringify({
      v: VERSION,
      e: s.economy,
      m: s.model,
      c: s.compare,
      h: s.horizon,
      a: s.ai,
      x: s.expectations,
      mi: s.micro,
      ma: s.market,
      ex: s.externality,
      g: s.game,
      z: s.zlb,
      sw: s.sweep,
      k: s.shocks,
    }),
  );
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null;

/** Keep only the keys the engine knows, with the right primitive type. */
function sanitiseEconomy(raw: unknown): Economy {
  const base = defaultEconomy();
  if (!isRecord(raw)) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, fallback] of Object.entries(base)) {
    const val = raw[key];
    if (typeof val !== typeof fallback) continue;
    if (typeof val === "number" && !Number.isFinite(val)) continue;
    out[key] = val;
  }
  const enumOf = (key: string, allowed: string[]) => {
    const val = raw[key];
    out[key] = typeof val === "string" && allowed.includes(val) ? val : base[key as keyof Economy];
  };
  enumOf("openness", OPENNESS);
  enumOf("size", SIZES);
  enumOf("regime", REGIMES);
  return out as unknown as Economy;
}

/**
 * A number from a URL is clamped to the range the matching slider offers, and
 * anything else falls back to the default. Every scenario dial goes through
 * this, so a hand-edited link cannot reach a state the UI cannot show.
 */
function bounded(val: unknown, lo: number, hi: number, fallback: number): number {
  return typeof val === "number" && Number.isFinite(val) ? Math.min(hi, Math.max(lo, val)) : fallback;
}

function sanitiseAi(raw: unknown): AiOptions {
  if (!isRecord(raw)) return DEFAULT_AI;
  return {
    substitutionPct: bounded(raw.substitutionPct, 0, 95, DEFAULT_AI.substitutionPct),
    capitalIntensity: bounded(raw.capitalIntensity, 0.2, 3, DEFAULT_AI.capitalIntensity),
    capitalProductivity: bounded(raw.capitalProductivity, 0.5, 4, DEFAULT_AI.capitalProductivity),
  };
}

function sanitiseMicro(raw: unknown): MicroOptions {
  if (!isRecord(raw)) return DEFAULT_MICRO;
  return {
    px: bounded(raw.px, 0.2, 5, DEFAULT_MICRO.px),
    py: bounded(raw.py, 0.2, 5, DEFAULT_MICRO.py),
    income: bounded(raw.income, 4, 120, DEFAULT_MICRO.income),
    weight: bounded(raw.weight, 0.1, 0.9, DEFAULT_MICRO.weight),
  };
}

function sanitiseMarket(raw: unknown): MarketOptions {
  if (!isRecord(raw)) return DEFAULT_MARKET;
  return {
    demandA: bounded(raw.demandA, 5, 60, DEFAULT_MARKET.demandA),
    demandB: bounded(raw.demandB, 0.2, 5, DEFAULT_MARKET.demandB),
    mc: bounded(raw.mc, 0, 15, DEFAULT_MARKET.mc),
    fixed: bounded(raw.fixed, 0, 80, DEFAULT_MARKET.fixed),
  };
}

function sanitiseExternality(raw: unknown): ExternalityOptions {
  if (!isRecord(raw)) return DEFAULT_EXTERNALITY;
  return {
    external: bounded(raw.external, -3, 8, DEFAULT_EXTERNALITY.external),
    tax: bounded(raw.tax, 0, 10, DEFAULT_EXTERNALITY.tax),
  };
}

function sanitiseGame(raw: unknown): GameOptions {
  if (!isRecord(raw)) return DEFAULT_GAME;
  return {
    game: GAME_IDS.includes(raw.game as GameOptions["game"])
      ? (raw.game as GameOptions["game"])
      : DEFAULT_GAME.game,
    temptation: bounded(raw.temptation, 4, 10, DEFAULT_GAME.temptation),
  };
}

function sanitiseZlb(raw: unknown): ZlbOptions {
  if (!isRecord(raw)) return DEFAULT_ZLB;
  return { demandShock: bounded(raw.demandShock, 0, 0.6, DEFAULT_ZLB.demandShock) };
}

function sanitiseShocks(raw: unknown): ShockSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: ShockSpec[] = [];
  const seen = new Set<string>();
  for (const item of raw.slice(0, MAX_SHOCKS)) {
    if (!isRecord(item)) continue;
    if (item.kind === "preset" && typeof item.id === "string" && SHOCK_PRESETS.some((p) => p.id === item.id)) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push({ kind: "preset", id: item.id });
      continue;
    }
    const key = item.key;
    const mode = item.mode;
    const amount = item.amount;
    if (
      item.kind === "custom" &&
      typeof key === "string" &&
      CUSTOM_FIELDS.some((f) => f.key === key) &&
      typeof mode === "string" &&
      SHOCK_MODES.includes(mode as ShockMode) &&
      typeof amount === "number" &&
      Number.isFinite(amount)
    ) {
      const id = typeof item.id === "string" ? item.id : `custom-${out.length}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        kind: "custom",
        id,
        label: typeof item.label === "string" && item.label.trim() ? item.label : "Custom shock",
        key: key as keyof Economy,
        mode: mode as ShockMode,
        amount,
      });
    }
  }
  return out;
}

/** Unpack a token. Returns null when there is nothing usable in it. */
export function decodeState(token: string | null | undefined): SimState | null {
  if (!token) return null;
  try {
    const raw: unknown = JSON.parse(fromBase64(token));
    if (!isRecord(raw) || raw.v !== VERSION) return null;
    const horizon = raw.h;
    return {
      economy: sanitiseEconomy(raw.e),
      model: typeof raw.m === "string" && MODEL_IDS.includes(raw.m) ? raw.m : DEFAULT_MODEL,
      compare: COMPARE_MODES.includes(raw.c as CompareMode) ? (raw.c as CompareMode) : "current",
      horizon:
        typeof horizon === "number" && Number.isFinite(horizon)
          ? Math.min(200, Math.max(5, Math.round(horizon)))
          : DEFAULT_HORIZON,
      ai: sanitiseAi(raw.a),
      expectations: EXPECTATION_MODES.includes(raw.x as Expectations)
        ? (raw.x as Expectations)
        : DEFAULT_EXPECTATIONS,
      micro: sanitiseMicro(raw.mi),
      market: sanitiseMarket(raw.ma),
      externality: sanitiseExternality(raw.ex),
      game: sanitiseGame(raw.g),
      zlb: sanitiseZlb(raw.z),
      sweep: SWEEPABLE.includes(raw.sw as keyof Economy) ? (raw.sw as SweepParam) : DEFAULT_SWEEP,
      shocks: sanitiseShocks(raw.k),
    };
  } catch {
    return null;
  }
}

/** Read the packed state out of a query string. */
export function readState(search: string): SimState | null {
  return decodeState(new URLSearchParams(search).get(PERMALINK_PARAM));
}

/** Build the shareable URL for a state, replacing any query and hash. */
export function shareUrl(state: SimState, base: string): string {
  const url = new URL(base);
  url.search = "";
  url.hash = "";
  url.searchParams.set(PERMALINK_PARAM, encodeState(state));
  return url.toString();
}
