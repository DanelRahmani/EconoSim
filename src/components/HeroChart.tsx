"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CurveChart, Legend, SERIES_COLORS } from "@/components/charts/CurveChart";
import { defaultEconomy } from "@/lib/econ/defaults";
import { islm } from "@/lib/econ/models/islm";
import type { ChartSpec, Panel, Point } from "@/lib/econ/panel";
import { fmtNum } from "@/lib/format";

/**
 * The landing page's one live diagram: the real IS-LM model, run on the default
 * economy, with government spending eased up and back down so the IS curve can be
 * seen shifting right. Every frame is a fresh `islm()` run, so the picture is the
 * engine's own output, not an illustration of it.
 */

const BASE = defaultEconomy();
const DG = 30;

const before = islm(BASE)[0];
const after = islm({ ...BASE, G: BASE.G + DG })[0];

function curve(p: Panel, label: string): Point[] {
  return p.chart?.series.find((s) => s.label === label)?.points ?? [];
}

function figure(p: Panel, label: string): number {
  return p.scalars?.find((s) => s.label === label)?.value ?? 0;
}

const Y0 = figure(before, "Output (Y*)");
const Y1 = figure(after, "Output (Y*)");
const R0 = figure(before, "Interest rate (r*)");
const R1 = figure(after, "Interest rate (r*)");
const I0 = figure(before, "Investment I");
const I1 = figure(after, "Investment I");

// A fixed frame around the two equilibria, on round numbers, so the curves move
// and the axes do not.
const XLO = Math.floor((Y0 * 0.75) / 50) * 50;
const XHI = XLO + Math.ceil((Y1 * 1.25 - XLO) / 50) * 50;
const YHI = Math.ceil((R1 * 1.8) / 0.05) * 0.05;
const DOMAIN = { x: [XLO, XHI] as [number, number], y: [0, YHI] as [number, number] };

const COLORS = { "IS₀": SERIES_COLORS[0], IS: SERIES_COLORS[0], LM: SERIES_COLORS[1] };
const LEGEND = [
  { label: "IS₀ (before)", color: SERIES_COLORS[0] },
  { label: "IS (G raised)", color: SERIES_COLORS[0] },
  { label: "LM", color: SERIES_COLORS[1] },
];

/** Played once, in ms: rest on the old equilibrium, then ease out to the new one and stay. */
const REST = 900;
const OUT = 1800;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function shiftAt(t: number): number {
  if (t < REST) return 0;
  if (t < REST + OUT) return ease((t - REST) / OUT);
  return 1;
}

const REDUCE = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const reducedMotion = () => window.matchMedia(REDUCE).matches;

const pct = (r: number) => `${fmtNum(r * 100, 1)}%`;

export function HeroChart() {
  // The server renders the shifted end state, which is also what a reader who has
  // asked for reduced motion keeps: the whole story in one still frame.
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
  const [shift, setShift] = useState(1);
  const box = useRef<HTMLDivElement>(null);
  const visible = useRef(true);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) {
      const raf = requestAnimationFrame(() => setShift(1));
      return () => cancelAnimationFrame(raf);
    }
    let raf = 0;
    let start = 0;
    let shown = -1;
    const tick = (now: number) => {
      if (!start) start = now;
      const next = shiftAt(now - start);
      // Off screen there is nothing to draw; on screen, skip sub-pixel changes.
      if (visible.current && Math.abs(next - shown) > 0.002) {
        shown = next;
        setShift(next);
      }
      // Nothing loops: once the curve has settled the figure holds still.
      if (now - start < REST + OUT) raf = requestAnimationFrame(tick);
      else if (shown !== 1) setShift(1);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);

  const spec = useMemo<ChartSpec>(() => {
    const now = islm({ ...BASE, G: BASE.G + shift * DG })[0];
    const moved = shift > 0.02;
    return {
      xLabel: "Output (Y)",
      yLabel: "Interest rate (r)",
      series: [
        { label: "IS₀", points: curve(before, "IS"), dashed: true },
        { label: "IS", points: curve(now, "IS") },
        { label: "LM", points: curve(now, "LM") },
      ],
      markers: moved
        ? [
            { x: Y0, y: R0, label: "E₀" },
            { x: figure(now, "Output (Y*)"), y: figure(now, "Interest rate (r*)"), label: "E₁" },
          ]
        : [{ x: Y0, y: R0, label: "E₀" }],
    };
  }, [shift]);

  const label = `IS-LM diagram of a fiscal expansion: government spending rises from ${BASE.G} to ${BASE.G + DG}, the IS curve shifts right, output rises from ${fmtNum(Y0, 0)} to ${fmtNum(Y1, 0)} and the interest rate from ${pct(R0)} to ${pct(R1)}.`;

  return (
    <figure ref={box} className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[0.8125rem] text-accent">
          IS-LM, a fiscal expansion
        </span>
        <span className="font-mono text-[0.8125rem] text-muted">
          G {fmtNum(BASE.G, 0)} → {fmtNum(BASE.G + DG, 0)}
        </span>
      </div>
      {/* Two frames: a narrower viewBox on phones keeps the axis text readable. */}
      <div className="sm:hidden">
        <CurveChart spec={spec} width={340} height={280} colors={COLORS} interactive={false} domain={DOMAIN} label={label} />
      </div>
      <div className="hidden sm:block">
        <CurveChart spec={spec} height={300} colors={COLORS} interactive={false} domain={DOMAIN} label={label} />
      </div>
      <div className="mt-3">
        <Legend labels={LEGEND} />
      </div>
      <figcaption className="mt-3 text-sm leading-relaxed text-muted">
        Raising government spending shifts IS to the right. Output rises from {fmtNum(Y0, 0)} to {fmtNum(Y1, 0)}, the
        interest rate from {pct(R0)} to {pct(R1)}, and the higher rate crowds investment down from {fmtNum(I0, 0)} to{" "}
        {fmtNum(I1, 0)}. Computed live by the same IS-LM model the simulator runs.
      </figcaption>
    </figure>
  );
}
