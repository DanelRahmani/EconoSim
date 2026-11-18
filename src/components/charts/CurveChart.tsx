"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChartSpec, Point } from "@/lib/econ/panel";
import { fmtNum } from "@/lib/format";
import { axisDomain, niceTicks, clampWindow, pointsInWindow, zoomWindow, type Window } from "@/lib/scale";

/** Series palette tuned to read on both the cool-white and near-black grounds. */
/** The thread first, ink second, then muted supporting hues; all theme tokens. */
export const SERIES_COLORS = [
  "var(--accent)",
  "var(--ink)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-6)",
];

const DEFAULT_WIDTH = 560;

/**
 * Identity of a series or marker across comparison modes. "IS" becomes "IS (new)"
 * when the comparison switches on; it is the same curve, so it keeps its React key
 * and is never redrawn from nothing. A baseline ghost is a different thing and
 * gets its own identity (so it can fade in on its own).
 */
const stableId = (label: string, ghost?: boolean) =>
  `${ghost ? "ghost:" : ""}${label.replace(/ \((shock|new|base)\)$/, "")}`;

/** Rough width of a marker label in viewBox units, at its 11px bold size. */
const labelWidth = (text: string) => text.length * 6.6 + 4;

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

/**
 * Where each marker's label goes. The default is up and to the right of the dot;
 * when that would sit on an earlier label or dot (the Solow "k̂*" and "golden
 * rule" labels collide once the two points are close), the next free corner wins.
 */
function placeLabels(points: { x: number; y: number; label: string; preferLeft?: boolean }[], bounds: Box) {
  const placed: Box[] = points.map((p) => ({ x0: p.x - 5, y0: p.y - 5, x1: p.x + 5, y1: p.y + 5 }));
  return points.map((p) => {
    const w = labelWidth(p.label);
    const right = [
      { dx: 8, dy: -6, anchor: "start" as const },
      { dx: 8, dy: 16, anchor: "start" as const },
    ];
    const left = [
      { dx: -8, dy: -6, anchor: "end" as const },
      { dx: -8, dy: 16, anchor: "end" as const },
    ];
    // A line's own name sits just inside its end; nudged up or down a line's
    // height when another label is already there.
    const nudged = [-20, 30, -34, 44].map((dy) => ({ dx: -8, dy, anchor: "end" as const }));
    const options = p.preferLeft ? [...left, ...nudged, ...right] : [...right, ...left];
    const boxOf = (o: (typeof options)[number]): Box => {
      const x0 = o.anchor === "start" ? p.x + o.dx : p.x + o.dx - w;
      return { x0, y0: p.y + o.dy - 10, x1: x0 + w, y1: p.y + o.dy + 2 };
    };
    const inside = (b: Box) => b.x0 >= bounds.x0 && b.x1 <= bounds.x1 && b.y0 >= bounds.y0 && b.y1 <= bounds.y1;
    const pick =
      options.find((o) => inside(boxOf(o)) && !placed.some((b) => overlaps(b, boxOf(o)))) ??
      options.find((o) => !placed.some((b) => overlaps(b, boxOf(o)))) ??
      options[0];
    placed.push(boxOf(pick));
    return pick;
  });
}

function finite(points: Point[]): Point[] {
  return points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

/** A lightweight SVG chart for economic curve diagrams (curve shifts, phase diagrams, IS-LM). */
export function CurveChart({
  spec,
  height = 300,
  width = DEFAULT_WIDTH,
  colors,
  interactive = true,
  domain,
  label,
}: {
  spec: ChartSpec;
  height?: number;
  /** viewBox width. Text is drawn at a fixed size in these units, so a narrower box reads larger on a phone. */
  width?: number;
  /** Optional label → colour map, so colours stay stable when lines are hidden. */
  colors?: Record<string, string>;
  /** False drops the zoom toolbar and pointer handling: a picture, not a tool. */
  interactive?: boolean;
  /**
   * Fixed axes. Without it the axes fit the data, which is right for a static
   * chart but makes an animated one swim; with it the frame holds still and the
   * curves move inside it (anything outside the plot area is clipped).
   */
  domain?: { x: Window; y: Window };
  /** Accessible name; defaults to "y versus x". */
  label?: string;
}) {
  const clipId = useId();
  // The SVG scales to its box, and its text with it: a 560-unit chart drawn 330px
  // wide set 10-unit tick labels at under 6px. Measuring the box and drawing in
  // its own pixels keeps the text at its intended size on a phone.
  const boxRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<number | null>(null);
  useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setMeasured(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const H = height;
  const W = measured && measured < width ? Math.max(280, measured) : width;
  const pad = { l: 56, r: 18, t: 16, b: 44 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  // The curves present on first render draw themselves in. Anything that arrives
  // later (a baseline ghost when Compare comes on) fades in instead, and a curve
  // whose label merely changed is the same element, so it is not redrawn.
  const [initialIds] = useState(() => new Set(spec.series.map((s) => stableId(s.label, s.ghost))));

  const [zoom, setZoom] = useState<Window | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);

  const all = [...spec.series.flatMap((s) => finite(s.points)), ...(spec.markers ?? [])];
  const full: Window = domain?.x ?? axisDomain(all.map((p) => p.x), undefined, spec.xBounds);
  // A zoom left over from another parameter is clamped, and dropped if the data
  // has since moved out from under it.
  const view = zoom ? clampWindow(zoom, full) : null;
  const [x0, x1] = view ?? full;

  const inWindow = all.filter((p) => p.x >= x0 && p.x <= x1);
  // The y-axis rescales to what is actually in view, which is the whole point of
  // zooming: a concave curve only shows its curvature when the frame is tight.
  const [y0, y1] = domain?.y ?? axisDomain((inWindow.length ? inWindow : all).map((p) => p.y), undefined, spec.yBounds);
  const sx = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * iw;
  const sy = (y: number) => pad.t + ih - ((y - y0) / (y1 - y0)) * ih;

  /** Where a pointer sits along the x-axis, in data units. */
  const dataX = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const units = ((event.clientX - rect.left) * W) / rect.width;
    return x0 + ((units - pad.l) / iw) * (x1 - x0);
  };

  const xTicks = niceTicks(x0, x1);
  const yTicks = niceTicks(y0, y1);
  const shownMarkers = (spec.markers ?? []).filter(
    (m) => Number.isFinite(m.x) && Number.isFinite(m.y) && m.x >= x0 && m.x <= x1,
  );
  // Baselines underneath, so the current curve is never hidden by its own ghost.
  const ordered = [...spec.series].sort((a, b) => Number(!!b.ghost) - Number(!!a.ghost));
  const colorOf = (s: (typeof spec.series)[number]) =>
    colors?.[s.label] ?? SERIES_COLORS[spec.series.indexOf(s) % SERIES_COLORS.length];

  // Each line is named where it ends inside the frame, so a reader does not have
  // to match colours against the legend to tell "SRAS (shock)" from "SRAS (base)".
  const lineEnds = spec.series.flatMap((s) => {
    if (s.label.length > 22) return [];
    const inside = finite(s.points).filter((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
    const end = inside[inside.length - 1];
    return end ? [{ series: s, x: sx(end.x), y: sy(end.y) }] : [];
  });
  const plotBox = { x0: pad.l, y0: pad.t, x1: pad.l + iw, y1: pad.t + ih };
  const placement = placeLabels(
    [
      ...shownMarkers.map((m) => ({ x: sx(m.x), y: sy(m.y), label: m.label })),
      ...lineEnds.map((l) => ({ x: l.x, y: l.y, label: l.series.label, preferLeft: true })),
    ],
    plotBox,
  );
  const labelPlacement = placement.slice(0, shownMarkers.length);
  const linePlacement = placement.slice(shownMarkers.length);

  return (
    <div ref={boxRef}>
      {interactive && (
      <div className="mb-1.5 flex items-center justify-end gap-1.5">
        <span className="mr-auto hidden font-mono text-[0.75rem] text-muted/70 sm:inline">
          {view ? `zoomed ${x0.toFixed(2)} – ${x1.toFixed(2)} (${spec.xLabel})` : "drag across the chart to zoom"}
        </span>
        <ZoomButton label="+" title="Zoom in" onClick={() => setZoom(zoomWindow([x0, x1], full, 0.5))} />
        <ZoomButton label="−" title="Zoom out" onClick={() => setZoom(zoomWindow([x0, x1], full, 2))} />
        <ZoomButton
          label="Full view"
          title="Show the full range"
          disabled={!view}
          onClick={() => setZoom(null)}
        />
      </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto touch-pan-y"
        role="img"
        aria-label={label ?? `${spec.yLabel} versus ${spec.xLabel}${view ? ", zoomed" : ""}`}
        onPointerDown={(e) => {
          if (!interactive) return;
          const at = dataX(e);
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag({ from: at, to: at });
        }}
        onPointerMove={(e) => drag && setDrag({ ...drag, to: dataX(e) })}
        onPointerUp={() => {
          if (drag) {
            const picked = clampWindow([drag.from, drag.to], full);
            if (picked) setZoom(picked);
          }
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
        onDoubleClick={() => interactive && setZoom(null)}
      >
      <defs>
        <clipPath id={clipId}>
          <rect x={pad.l} y={pad.t} width={iw} height={ih} />
        </clipPath>
      </defs>
      <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="none" stroke="var(--hairline)" />
      {xTicks.ticks.map((t, i) => (
        <g key={`x${i}`}>
          <line x1={sx(t)} y1={pad.t} x2={sx(t)} y2={pad.t + ih} stroke="var(--hairline)" />
          <text x={sx(t)} y={H - pad.b + 16} textAnchor="middle" fontSize={10} fill="var(--muted)">
            {fmtNum(t, xTicks.dp)}
          </text>
        </g>
      ))}
      {yTicks.ticks.map((t, i) => (
        <g key={`y${i}`}>
          <line x1={pad.l} y1={sy(t)} x2={pad.l + iw} y2={sy(t)} stroke="var(--hairline)" />
          <text x={pad.l - 8} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="var(--muted)">
            {fmtNum(t, yTicks.dp)}
          </text>
        </g>
      ))}

      {ordered.map((s, i) => {
        const pts = finite(pointsInWindow(s.points, [x0, x1]));
        if (pts.length < 2) return null;
        const d = pts.map((p, j) => `${j === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
        const id = stableId(s.label, s.ghost);
        const drawsIn = !s.dashed && initialIds.has(id);
        return (
          <path
            key={id}
            clipPath={`url(#${clipId})`}
            d={d}
            pathLength={s.dashed ? undefined : 1}
            className={drawsIn ? "chart-line" : "fade-in"}
            style={{
              animationDelay: drawsIn ? `${i * 60}ms` : undefined,
              opacity: s.ghost ? 0.5 : s.dashed ? 0.7 : undefined,
            }}
            fill="none"
            stroke={colorOf(s)}
            strokeWidth={s.ghost ? 1.75 : 2.25}
            strokeLinecap="round"
            strokeDasharray={s.ghost ? "5 5" : s.dashed ? "6 5" : undefined}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {lineEnds.map((l, i) => {
        const at = linePlacement[i];
        return (
          <text
            key={`end-${stableId(l.series.label, l.series.ghost)}`}
            className={l.series.ghost ? "fade-in" : undefined}
            x={l.x + at.dx}
            y={l.y + at.dy}
            textAnchor={at.anchor}
            fontSize={11}
            fontWeight={600}
            fill={colorOf(l.series)}
            opacity={l.series.ghost ? 0.75 : 1}
            paintOrder="stroke"
            stroke="var(--surface)"
            strokeWidth={3}
          >
            {l.series.label}
          </text>
        );
      })}

      {shownMarkers.map((m, i) => {
        const at = labelPlacement[i];
        return (
          <g key={stableId(m.label, m.ghost)} className={m.ghost ? "fade-in" : undefined}>
            {m.ghost ? (
              <circle cx={sx(m.x)} cy={sy(m.y)} r={4.5} fill="var(--surface)" stroke="var(--muted)" strokeWidth={1.75} />
            ) : (
              <circle cx={sx(m.x)} cy={sy(m.y)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
            )}
            <text
              x={sx(m.x) + at.dx}
              y={sy(m.y) + at.dy}
              textAnchor={at.anchor}
              fontSize={11}
              fontWeight={600}
              fill={m.ghost ? "var(--muted)" : "var(--ink)"}
              paintOrder="stroke"
              stroke="var(--surface)"
              strokeWidth={3}
            >
              {m.label}
            </text>
          </g>
        );
      })}

      {drag && Math.abs(sx(drag.to) - sx(drag.from)) > 2 && (
        <rect
          aria-hidden
          x={Math.min(sx(drag.from), sx(drag.to))}
          y={pad.t}
          width={Math.abs(sx(drag.to) - sx(drag.from))}
          height={ih}
          fill="var(--accent)"
          opacity={0.12}
        />
      )}

      <text x={pad.l + iw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
        {spec.xLabel}
      </text>
      <text
        x={14}
        y={pad.t + ih / 2}
        textAnchor="middle"
        fontSize={11}
        fill="var(--muted)"
        transform={`rotate(-90 14 ${pad.t + ih / 2})`}
      >
        {spec.yLabel}
      </text>
    </svg>
    </div>
  );
}

/** A small control in a chart's zoom toolbar. */
function ZoomButton({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-hairline bg-surface px-2 py-0.5 font-mono text-[0.6875rem] text-muted transition-colors hover:border-accent/50 hover:text-accent disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-muted"
    >
      {label}
    </button>
  );
}

export function Legend({
  labels,
  hidden,
  onToggle,
}: {
  labels: { label: string; color: string }[];
  hidden?: string[];
  onToggle?: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.75rem] text-muted">
      {labels.map((l) => {
        const off = hidden?.includes(l.label) ?? false;
        const swatch = (
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full transition-opacity"
            style={{ background: off ? "var(--muted)" : l.color, opacity: off ? 0.45 : 1 }}
          />
        );
        if (!onToggle) {
          return (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              {swatch}
              {l.label}
            </span>
          );
        }
        return (
          <button
            key={l.label}
            type="button"
            aria-pressed={!off}
            title={off ? "Show this line" : "Hide this line"}
            onClick={() => onToggle(l.label)}
            className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-70 ${
              off ? "line-through opacity-55" : ""
            }`}
          >
            {swatch}
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
