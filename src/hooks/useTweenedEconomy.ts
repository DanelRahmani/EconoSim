"use client";

import { useEffect, useRef, useState } from "react";
import type { Economy } from "@/lib/econ/types";

/** The numeric fields worth interpolating (strings/enums switch immediately). */
const NUMERIC_KEYS: (keyof Economy)[] = [
  "A",
  "alpha",
  "L",
  "K0",
  "s",
  "n",
  "g",
  "delta",
  "G",
  "T",
  "M",
  "P",
  "kY",
  "hR",
  "c0",
  "c1",
  "I0",
  "b",
  "rStar",
  "rho",
  "pStar",
  "foreignIncome",
  "X0",
  "importProp",
  "fxSensitivity",
  "kappa",
  "fxPeg",
  "lambda",
  "theta",
  "gamma",
  "piE",
];

/** A cheap, stable signature so the tween only restarts when values really change. */
function keyOf(e: Economy): string {
  return `${NUMERIC_KEYS.map((k) => e[k]).join(",")}|${e.openness}|${e.size}|${e.regime}|${e.name}`;
}

/**
 * Eases the economy's numeric parameters toward their targets so charts and
 * figures morph instead of jumping when a slider moves. Recompute is throttled
 * to ~30fps and only runs while the tween is active.
 */
export function useTweenedEconomy(target: Economy, duration = 280): Economy {
  const [shown, setShown] = useState<Economy>(target);
  const shownRef = useRef(target);
  const key = keyOf(target);

  // The effect only re-runs when `key` changes, so the closed-over `target` is the
  // one that produced this key. (Refs can't be written during render.)
  useEffect(() => {
    const to = target;
    const from = shownRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    if (reduce) {
      shownRef.current = to;
      raf = requestAnimationFrame(() => setShown(to));
      return () => cancelAnimationFrame(raf);
    }

    const start = performance.now();
    let last = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next: Economy = { ...to };
      const bag = next as unknown as Record<string, number>;
      for (const k of NUMERIC_KEYS) {
        const f = from[k] as number;
        const g = to[k] as number;
        bag[k as string] = f + (g - f) * eased;
      }
      if (now - last >= 32 || t === 1) {
        last = now;
        shownRef.current = next;
        setShown(next);
      }
      if (t < 1) raf = requestAnimationFrame(step);
      else {
        shownRef.current = to;
        setShown(to);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [key, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return shown;
}
