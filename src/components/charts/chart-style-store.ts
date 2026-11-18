/**
 * Chart style: drawn in the site's theme, or on plain white paper (black axes,
 * print-safe colours), whatever the site theme is. A per-browser preference, read
 * through useSyncExternalStore like the theme, so no setState runs in an effect.
 */

export type ChartStyle = "theme" | "white";

const STORAGE_KEY = "econosim-chart-style";
let style: ChartStyle = "theme";
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  try {
    style = localStorage.getItem(STORAGE_KEY) === "white" ? "white" : "theme";
  } catch {
    style = "theme";
  }
}

export const chartStyleStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  get(): ChartStyle {
    return style;
  },
  getServer(): ChartStyle {
    return "theme";
  },
  set(next: ChartStyle): void {
    style = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private mode: the choice lasts for this page only.
    }
    for (const l of listeners) l();
  },
};
