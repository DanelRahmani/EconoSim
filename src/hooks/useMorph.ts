"use client";

import { useEffect, useRef, useState } from "react";
import type { Point } from "@/lib/econ/panel";

/**
 * Morph a set of lines from what is on screen to their new shape.
 *
 * The model is computed once per change; only the drawn geometry is
 * interpolated, every animation frame, between the previous picture and the
 * new one. That keeps a slider drag smooth: the old approach eased the whole
 * economy and re-ran the model about 30 times a second, which was both
 * expensive and visibly stepped.
 *
 * A line is matched to its predecessor by `keyOf`. When both have the same
 * number of points they are interpolated point by point; otherwise (a line that
 * just appeared, or a different sampling) the new line is shown as it is.
 * All state updates happen inside animation frames, as the hooks lint requires.
 */
export function useMorph<T extends { points: Point[] }>(items: T[], keyOf: (item: T) => string, duration = 220): T[] {
  const [shown, setShown] = useState<T[]>(items);
  const shownRef = useRef<T[]>(items);

  useEffect(() => {
    const from = new Map(shownRef.current.map((item) => [keyOf(item), item.points]));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();

    const frame = (now: number) => {
      const t = reduce || duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = items.map((item) => {
        const prev = from.get(keyOf(item));
        if (t >= 1 || !prev || prev.length !== item.points.length) return item;
        return {
          ...item,
          points: item.points.map((p, i) => {
            const q = prev[i];
            if (!Number.isFinite(q.x) || !Number.isFinite(q.y) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return p;
            return { x: q.x + (p.x - q.x) * eased, y: q.y + (p.y - q.y) * eased };
          }),
        };
      });
      shownRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // keyOf is a stable module-level function at every call site.
  }, [items, duration]); // eslint-disable-line react-hooks/exhaustive-deps

  return shown;
}
