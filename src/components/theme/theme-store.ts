/**
 * Theme state lives outside React (localStorage + the OS media query), read via
 * useSyncExternalStore. This keeps the theme in sync with the pre-paint script
 * without any setState-inside-an-effect.
 */

export type Theme = "system" | "light" | "dark";
export type Resolved = "light" | "dark";

const STORAGE_KEY = "econosim-theme";

let theme: Theme = "system";
let resolved: Resolved = "light";
const listeners = new Set<() => void>();

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

function systemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function computeResolved(t: Theme): Resolved {
  return t === "dark" || (t === "system" && systemDark()) ? "dark" : "light";
}

function paint(): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  root.style.colorScheme = resolved;
}

function emit(): void {
  for (const l of listeners) l();
}

// Browser-only initialisation. The inline script has already painted the theme,
// so we only mirror that state here.
if (typeof window !== "undefined") {
  theme = readStored();
  resolved = computeResolved(theme);
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (theme !== "system") return;
    resolved = computeResolved("system");
    paint();
    emit();
  });
}

export const themeStore = {
  subscribe(cb: () => void): () => void {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
  getTheme(): Theme {
    return theme;
  },
  getResolved(): Resolved {
    return resolved;
  },
  getServerTheme(): Theme {
    return "system";
  },
  getServerResolved(): Resolved {
    return "light";
  },
  set(next: Theme): void {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* storage unavailable — fall through and still apply the theme */
    }
    theme = next;
    resolved = computeResolved(next);
    paint();
    emit();
  },
};
