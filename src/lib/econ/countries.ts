import type { Economy } from "./types";

export interface CountryPreset {
  id: string;
  name: string;
  note: string;
  source: string;
  params: Partial<Economy>;
}

/**
 * Stylised country presets. Figures are rounded approximations drawn from
 * World Bank / Penn World Table / AMECO style sources for a recent year, and
 * are meant as starting points the user can edit — not precise calibrations.
 * Real-side parameters only; monetary variables stay at the indexed default.
 */
export const COUNTRIES: CountryPreset[] = [
  {
    id: "us",
    name: "United States",
    note: "Large, floating, low saving, moderate growth.",
    source: "World Bank / PWT (approx.)",
    params: { alpha: 0.33, s: 0.21, n: 0.005, g: 0.015, delta: 0.05, size: "large", regime: "floating", openness: "open", rStar: 0.02, rho: 0 },
  },
  {
    id: "de",
    name: "Germany",
    note: "Open euro economy, floating, low population growth.",
    source: "World Bank / AMECO (approx.)",
    params: { alpha: 0.33, s: 0.22, n: 0.0, g: 0.012, delta: 0.05, size: "small", regime: "floating", openness: "open", rStar: 0.02, rho: 0 },
  },
  {
    id: "jp",
    name: "Japan",
    note: "Large, high saving, shrinking population.",
    source: "World Bank / PWT (approx.)",
    params: { alpha: 0.35, s: 0.26, n: -0.005, g: 0.01, delta: 0.05, size: "large", regime: "floating", openness: "open", rStar: 0.01, rho: 0.005 },
  },
  {
    id: "nl",
    name: "Netherlands",
    note: "Very open small economy, floating (euro), trade surplus.",
    source: "World Bank / AMECO (approx.)",
    params: { alpha: 0.32, s: 0.21, n: 0.004, g: 0.013, delta: 0.05, size: "small", regime: "floating", openness: "open", rStar: 0.02, rho: 0.002, X0: 15 },
  },
  {
    id: "ch",
    name: "Switzerland",
    note: "Small, high saving, safe-haven currency.",
    source: "World Bank / PWT (approx.)",
    params: { alpha: 0.32, s: 0.26, n: 0.007, g: 0.011, delta: 0.05, size: "small", regime: "floating", openness: "open", rStar: 0.01, rho: 0 },
  },
  {
    id: "sg",
    name: "Singapore",
    note: "Small, very open, high saving and fast growth.",
    source: "World Bank / PWT (approx.)",
    params: { alpha: 0.34, s: 0.3, n: 0.007, g: 0.02, delta: 0.05, size: "small", regime: "floating", openness: "open", rStar: 0.02, rho: 0.003, X0: 20 },
  },
  {
    id: "cn",
    name: "China",
    note: "Large, very high saving, managed/pegged exchange rate.",
    source: "World Bank / PWT (approx.)",
    params: { alpha: 0.4, s: 0.43, n: 0.002, g: 0.03, delta: 0.05, size: "large", regime: "fixed", openness: "open", rStar: 0.03, rho: 0.01, fxPeg: 1 },
  },
  {
    id: "in",
    name: "India",
    note: "Large emerging economy, floating, high growth, risk premium.",
    source: "World Bank / PWT (approx.)",
    params: { alpha: 0.38, s: 0.31, n: 0.009, g: 0.03, delta: 0.05, size: "large", regime: "floating", openness: "open", rStar: 0.04, rho: 0.025 },
  },
  {
    id: "br",
    name: "Brazil",
    note: "Large emerging economy, floating, high risk premium, low saving.",
    source: "World Bank / PWT (approx.)",
    params: { alpha: 0.38, s: 0.18, n: 0.005, g: 0.01, delta: 0.05, size: "large", regime: "floating", openness: "open", rStar: 0.04, rho: 0.04 },
  },
  {
    id: "sa",
    name: "Saudi Arabia",
    note: "Oil exporter, pegged rate, resource-driven exports.",
    source: "World Bank / PWT (approx.)",
    params: { alpha: 0.42, s: 0.3, n: 0.015, g: 0.02, delta: 0.05, size: "small", regime: "fixed", openness: "open", rStar: 0.04, rho: 0.015, X0: 30, fxPeg: 1, fxSensitivity: 14 },
  },
];

export function findCountry(id: string): CountryPreset | undefined {
  return COUNTRIES.find((c) => c.id === id);
}
