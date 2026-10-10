"use client";

import { useAnimatedNumber } from "@/hooks/useAnimatedNumber";
import { fmtNum } from "@/lib/format";

/** A number that eases to its new value instead of jumping. */
export function AnimatedNumber({ value, dp = 4 }: { value: number; dp?: number }) {
  const shown = useAnimatedNumber(value);
  return <span className="tabular-nums">{fmtNum(shown, dp)}</span>;
}
