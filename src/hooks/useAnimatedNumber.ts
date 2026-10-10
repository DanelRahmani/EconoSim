"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tweens a displayed number toward `value` so figures ease rather than jump.
 * All state updates happen inside animation frames. Respects prefers-reduced-motion.
 */
export function useAnimatedNumber(value: number, duration = 500): number {
  const [display, setDisplay] = useState(value);
  const shownRef = useRef(value);

  useEffect(() => {
    const target = value;
    const from = shownRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;

    if (reduce || !Number.isFinite(target) || from === target) {
      raf = requestAnimationFrame(() => {
        shownRef.current = target;
        setDisplay(target);
      });
      return () => cancelAnimationFrame(raf);
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = from + (target - from) * eased;
      shownRef.current = next;
      setDisplay(next);
      if (t < 1) raf = requestAnimationFrame(step);
      else shownRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}
