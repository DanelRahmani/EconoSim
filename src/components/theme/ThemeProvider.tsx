"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { type Resolved, type Theme, themeStore } from "./theme-store";

interface ThemeContextValue {
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(themeStore.subscribe, themeStore.getTheme, themeStore.getServerTheme);
  const resolved = useSyncExternalStore(themeStore.subscribe, themeStore.getResolved, themeStore.getServerResolved);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolved, setTheme: themeStore.set }),
    [theme, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside a ThemeProvider");
  return ctx;
}

export type { Resolved, Theme };
