"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { ChartSpec, LineSpec, MarkerSpec, Point } from "@/lib/econ/panel";
import { fmtNum } from "@/lib/format";
import { axisDomain, niceTicks, clampWindow, pointsInWindow, zoomWindow, type Window } from "@/lib/scale";
import { useMorph } from "@/hooks/useMorph";
import { splitTag, stableId } from "./series-label";

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

/** Rough width of 11px text in viewBox units: bold names, regular tags. */
const textWidth = (text: string, bold = true) => text.length * (bold ? 6.7 : 6.0);

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const insideBox = (a: Box, b: Box) => a.x0 >= b.x0 && a.x1 <= b.x1 && a.y0 >= b.y0 && a.y1 <= b.y1;

/** Swatch (a short stroke in the line's own colour and dash) + name + quiet tag. */
export const SWATCH = 14;
const LABEL_H = 15;
export function lineLabelWidth(label: string) {
  const { name, tag } = splitTag(label);
  return SWATCH + 5 + textWidth(name) + (tag ? 4 + textWidth(tag, false) : 0) + 6;
}

/**
 * Where to name each line. The name sits beside a point on the line itself: its
 * end first, then further back along it, above or below and to either side,
 * whichever is inside the frame and clear of every label already placed. The
 * current curves are placed before their dashed baselines, so when space is
 * short it is the baseline's name that moves.
 */
function placeLineLabels(
  lines: { key: string; label: string; anchors: Point[] }[],
  taken: Box[],
  frame: Box,
): ({ box: Box; at: Point } | null)[] {
  const placed = [...taken];
  return lines.map((line) => {
    const w = lineLabelWidth(line.label);
    for (const at of line.anchors) {
      const candidates: Box[] = [
        { x0: at.x - w - 6, y0: at.y - LABEL_H - 4, x1: at.x - 6, y1: at.y - 4 },
        { x0: at.x - w - 6, y0: at.y + 4, x1: at.x - 6, y1: at.y + 4 + LABEL_H },
        { x0: at.x + 6, y0: at.y - LABEL_H - 4, x1: at.x + 6 + w, y1: at.y - 4 },
        { x0: at.x + 6, y0: at.y + 4, x1: at.x + 6 + w, y1: at.y + 4 + LABEL_H },
      ];
      const box = candidates.find((b) => insideBox(b, frame) && !placed.some((p) => overlaps(p, b)));
      if (box) {
        placed.push(box);
        return { box, at };
      }
    }
    return null;
  });
}

/** Marker labels: up-right of the dot by default, else the next free corner. */
function placeMarkerLabels(points: { x: number; y: number; label: string }[], frame: Box) {
  const placed: Box[] = points.map((p) => ({ x0: p.x - 5, y0: p.y - 5, x1: p.x + 5, y1: p.y + 5 }));
  const boxes: Box[] = [];
  const picks = points.map((p) => {
    const w = textWidth(p.label) + 4;
    const options = [
      { dx: 8, dy: -6, anchor: "start" as const },
      { dx: 8, dy: 16, anchor: "start" as const },
      { dx: -8, dy: -6, anchor: "end" as const },
      { dx: -8, dy: 16, anchor: "end" as const },
    ];
    const boxOf = (o: (typeof options)[number]): Box => {
      const x0 = o.anchor === "start" ? p.x + o.dx : p.x + o.dx - w;
      return { x0, y0: p.y + o.dy - 10, x1: x0 + w, y1: p.y + o.dy + 2 };
    };
    const pick =
      options.find((o) => insideBox(boxOf(o), frame) && !placed.some((b) => overlaps(b, boxOf(o)))) ??
      options.find((o) => !placed.some((b) => overlaps(b, boxOf(o)))) ??
      options[0];
    placed.push(boxOf(pick));
    boxes.push(boxOf(pick));
    return pick;
  });
  return { picks, boxes: [...boxes, ...points.map((p) => ({ x0: p.x - 6, y0: p.y - 6, x1: p.x + 6, y1: p.y + 6 }))] };
}

function finite(points: Point[]): Point[] {
  return points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

const seriesKey = (s: LineSpec) => stableId(s.label, s.ghost);
const markerKey = (m: { label: string; ghost?: boolean }) => stableId(m.label, m.ghost);

/** The stroke dash a line is drawn with; the label swatch copies it. */
const dashOf = (s: LineSpec) => (s.ghost ? "5 5" : s.dashed ? "6 5" : undefined);

/** A lightweight SVG chart for economic curve diagrams (curve shifts, phase diagrams, IS-LM). */
export function CurveChart({
  spec,
  height = 300,
  width = DEFAULT_WIDTH,
  colors,
  interactive = true,
  domain,
  label,
  tools,
  readout = false,
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
  /** Extra controls shown at the start of the toolbar. */
  tools?: ReactNode;
  /** Show each line's value under the pointer (for time paths, whose x is time). */
  readout?: boolean;
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
  const [initialIds] = useState(() => new Set(spec.series.map(seriesKey)));

  // What is drawn eases from the old picture to the new one: lines, markers and,
  // because the axes fit the drawn data, the axes too.
  const series = useMorph(spec.series, seriesKey);
  const markerInput = useMemo(() => (spec.markers ?? []).map((m) => ({ ...m, points: [{ x: m.x, y: m.y }] })), [spec.markers]);
  const markerItems = useMorph(markerInput, markerKey);
  const markers: MarkerSpec[] = markerItems.map(({ points, ...m }) => ({ ...m, x: points[0].x, y: points[0].y }));

  const [zoom, setZoom] = useState<Window | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  const all = [...series.flatMap((s) => finite(s.points)), ...markers];
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
  const shownMarkers = markers.filter((m) => Number.isFinite(m.x) && Number.isFinite(m.y) && m.x >= x0 && m.x <= x1);
  // Baselines underneath, so the current curve is never hidden by its own ghost.
  const ordered = [...series].sort((a, b) => Number(!!b.ghost) - Number(!!a.ghost));
  const colorOf = (s: LineSpec) => colors?.[s.label] ?? SERIES_COLORS[series.indexOf(s) % SERIES_COLORS.length];

  const frame = { x0: pad.l + 2, y0: pad.t + 2, x1: pad.l + iw - 2, y1: pad.t + ih - 2 };
  const markerLabels = shownMarkers.map((m) => {
    const { name, tag } = splitTag(m.label);
    // The equilibrium now is just "E"; the one it moved from says so.
    return m.ghost ? `${name} ${tag ?? "base"}` : name;
  });
  const markerPlacement = placeMarkerLabels(
    shownMarkers.map((m, i) => ({ x: sx(m.x), y: sy(m.y), label: markerLabels[i] })),
    frame,
  );

  // Each line is named beside a point on the line itself, current curves first.
  const labelled = [...series]
    .filter((s) => splitTag(s.label).name.length <= 34)
    .sort((a, b) => Number(!!a.ghost) - Number(!!b.ghost))
    .map((s) => {
      const inside = finite(s.points).filter((p) => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1);
      const n = inside.length;
      const anchors = n
        ? [1, 0.85, 0.7, 0.55, 0.4, 0.25].map((f) => inside[Math.max(0, Math.round((n - 1) * f))]).map((p) => ({ x: sx(p.x), y: sy(p.y) }))
        : [];
      return { series: s, key: seriesKey(s), label: s.label, anchors };
    });
  const linePlacement = placeLineLabels(labelled, markerPlacement.boxes, frame);

  return (
    <div ref={boxRef}>
      {interactive && (
        <div className="mb-1.5 flex items-center justify-end gap-1.5">
          {tools}
          <span className="mr-auto hidden font-mono text-[0.75rem] text-muted/70 sm:inline">
            {view ? `zoomed ${x0.toFixed(2)} – ${x1.toFixed(2)} (${spec.xLabel})` : "drag across the chart to zoom"}
          </span>
          <ZoomButton label="+" title="Zoom in" onClick={() => setZoom(zoomWindow([x0, x1], full, 0.5))} />
          <ZoomButton label="−" title="Zoom out" onClick={() => setZoom(zoomWindow([x0, x1], full, 2))} />
          <ZoomButton label="Full view" title="Show the full range" disabled={!view} onClick={() => setZoom(null)} />
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
        onPointerMove={(e) => {
          if (drag) setDrag({ ...drag, to: dataX(e) });
          else if (readout) setHoverX(dataX(e));
        }}
        onPointerLeave={() => setHoverX(null)}
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
          const id = seriesKey(s);
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
                opacity: s.ghost ? 0.55 : s.dashed ? 0.75 : undefined,
              }}
              fill="none"
              stroke={colorOf(s)}
              strokeWidth={s.ghost ? 1.75 : 2.25}
              strokeLinecap="round"
              strokeDasharray={dashOf(s)}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {labelled.map((l, i) => {
          const place = linePlacement[i];
          if (!place) return null;
          const { name, tag } = splitTag(l.label);
          const { box } = place;
          const midY = (box.y0 + box.y1) / 2;
          const color = colorOf(l.series);
          return (
            <g key={`label-${l.key}`} className={l.series.ghost ? "fade-in" : undefined} aria-hidden>
              <rect x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} rx={4} fill="var(--surface)" opacity={0.88} />
              <line
                x1={box.x0 + 3}
                y1={midY}
                x2={box.x0 + 3 + SWATCH}
                y2={midY}
                stroke={color}
                strokeWidth={2.5}
                strokeDasharray={l.series.ghost ? "3 3" : l.series.dashed ? "4 3" : undefined}
                opacity={l.series.ghost ? 0.7 : 1}
              />
              <text x={box.x0 + 3 + SWATCH + 5} y={midY + 4} fontSize={11} fontWeight={600} fill="var(--ink)">
                {name}
                {tag && (
                  <tspan fontWeight={500} fill="var(--muted)">
                    {" "}
                    {tag}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}

        {shownMarkers.map((m, i) => {
          const at = markerPlacement.picks[i];
          return (
            <g key={markerKey(m)} className={m.ghost ? "fade-in" : undefined}>
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
                fontWeight={m.ghost ? 500 : 700}
                fill={m.ghost ? "var(--muted)" : "var(--ink)"}
                paintOrder="stroke"
                stroke="var(--surface)"
                strokeWidth={3}
              >
                {markerLabels[i]}
              </text>
            </g>
          );
        })}

        {readout && hoverX !== null && !drag && hoverX >= x0 && hoverX <= x1 && (() => {
          // Each line's value at the time under the pointer: the sample nearest in x.
          const rows = series
            .map((s) => {
              const pts = finite(s.points);
              if (!pts.length) return null;
              let best = pts[0];
              for (const p of pts) if (Math.abs(p.x - hoverX) < Math.abs(best.x - hoverX)) best = p;
              return { s, p: best };
            })
            .filter((r): r is { s: LineSpec; p: Point } => !!r);
          if (!rows.length) return null;
          const at = rows[0].p.x;
          const lines = [`${spec.xLabel} ${fmtNum(at, 2)}`, ...rows.map((r) => `${splitTag(r.s.label).name}${r.s.ghost ? " base" : ""}  ${fmtNum(r.p.y, 3)}`)];
          const w = Math.max(...lines.map((t) => textWidth(t, false))) + SWATCH + 16;
          const h = lines.length * 15 + 8;
          const left = sx(at) > pad.l + iw / 2;
          const bx = left ? pad.l + 6 : pad.l + iw - w - 6;
          return (
            <g aria-hidden pointerEvents="none">
              <line x1={sx(at)} y1={pad.t} x2={sx(at)} y2={pad.t + ih} stroke="var(--muted)" strokeDasharray="2 3" opacity={0.6} />
              {rows.map((r) =>
                r.p.y >= y0 && r.p.y <= y1 ? (
                  <circle key={seriesKey(r.s)} cx={sx(r.p.x)} cy={sy(r.p.y)} r={3} fill={colorOf(r.s)} stroke="var(--surface)" strokeWidth={1.5} />
                ) : null,
              )}
              <rect x={bx} y={pad.t + 6} width={w} height={h} rx={6} fill="var(--surface)" stroke="var(--hairline)" opacity={0.95} />
              <text x={bx + 8} y={pad.t + 20} fontSize={10.5} fill="var(--muted)">
                {lines[0]}
              </text>
              {rows.map((r, k) => (
                <g key={`ro-${seriesKey(r.s)}`}>
                  <line
                    x1={bx + 8}
                    x2={bx + 8 + SWATCH}
                    y1={pad.t + 31 + k * 15}
                    y2={pad.t + 31 + k * 15}
                    stroke={colorOf(r.s)}
                    strokeWidth={2.5}
                    strokeDasharray={r.s.ghost ? "3 3" : undefined}
                  />
                  <text x={bx + 13 + SWATCH} y={pad.t + 35 + k * 15} fontSize={10.5} fill="var(--ink)">
                    {lines[k + 1]}
                  </text>
                </g>
              ))}
            </g>
          );
        })()}

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

/** A small control in a chart's toolbar. */
export function ZoomButton({
  label,
  title,
  onClick,
  disabled,
  pressed,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={`rounded-full border px-2 py-0.5 font-mono text-[0.6875rem] transition-colors disabled:opacity-40 disabled:hover:border-hairline disabled:hover:text-muted ${
        pressed
          ? "border-accent bg-accent text-accentink"
          : "border-hairline bg-surface text-muted hover:border-accent/50 hover:text-accent"
      }`}
    >
      {label}
    </button>
  );
}

/** A legend entry's swatch: a short stroke in the line's colour and dash, as drawn. */
function Swatch({ color, dashed, off }: { color: string; dashed?: boolean; off?: boolean }) {
  return (
    <svg aria-hidden width={16} height={8} className="shrink-0">
      <line
        x1={1}
        y1={4}
        x2={15}
        y2={4}
        stroke={off ? "var(--muted)" : color}
        strokeWidth={2.5}
        strokeDasharray={dashed ? "3 3" : undefined}
        opacity={off ? 0.45 : 1}
      />
    </svg>
  );
}

export function Legend({
  labels,
  hidden,
  onToggle,
}: {
  labels: { label: string; color: string; dashed?: boolean }[];
  hidden?: string[];
  onToggle?: (label: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[0.75rem] text-muted">
      {labels.map((l) => {
        const off = hidden?.includes(l.label) ?? false;
        const { name, tag } = splitTag(l.label);
        const text = (
          <span>
            <span className="text-ink">{name}</span>
            {tag && <span className="text-muted"> {tag}</span>}
          </span>
        );
        if (!onToggle) {
          return (
            <span key={l.label} className="inline-flex items-center gap-1.5">
              <Swatch color={l.color} dashed={l.dashed} />
              {text}
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
            className={`inline-flex items-center gap-1.5 transition-opacity hover:opacity-70 ${off ? "line-through opacity-55" : ""}`}
          >
            <Swatch color={l.color} dashed={l.dashed} off={off} />
            {text}
          </button>
        );
      })}
    </div>
  );
}
