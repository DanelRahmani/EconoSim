"use client";

import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { fmtScalar } from "@/lib/format";

/** A number that eases to its new value instead of jumping. */
export function AnimatedNumber({ value, dp = 4, percent = false }: { value: number; dp?: number; percent?: boolean }) {
  const shown = useAnimatedNumber(value);
  return <span className="tabular-nums">{fmtScalar(shown, percent, dp)}</span>;
}
