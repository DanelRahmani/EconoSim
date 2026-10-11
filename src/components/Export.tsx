"use client";

import type { RefObject } from "react";
import { exportName, panelToCsv, panelsToCsv } from "@/lib/econ/export";
import type { Panel } from "@/lib/econ/panel";

/**
 * Export controls: a panel's figures and working as CSV, and a chart as SVG.
 *
 * Both are built on click rather than during render — a download needs a Blob
 * and a DOM node, neither of which exists on the server.
 */

/** Tokens the charts draw with, so an exported file still looks like the app. */
const CHART_TOKENS = [
  "--bg",
  "--surface",
  "--surface-2",
  "--ink",
  "--muted",
  "--accent",
  "--accentink",
  "--hairline",
  "--gain",
];

function download(content: string, filename: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Serialise a live chart to a standalone SVG.
 *
 * The charts colour themselves with the theme's CSS custom properties, which a
 * detached file cannot resolve — an exported SVG would come out with black text
 * and no axes. So the tokens as they are *now* are pasted into the file as a
 * style block, which also means the export matches the theme it was taken in.
 */
function svgText(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const root = getComputedStyle(document.documentElement);
  const tokens = CHART_TOKENS.map((token) => `${token}:${root.getPropertyValue(token).trim()}`).join(";");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `:root{${tokens}}text{font-family:${getComputedStyle(svg).fontFamily || "sans-serif"}}`;
  clone.insertBefore(style, clone.firstChild);

  // It is laid out responsively, so pin the size it currently occupies.
  const box = svg.getBoundingClientRect();
  if (box.width) clone.setAttribute("width", String(Math.round(box.width)));
  if (box.height) clone.setAttribute("height", String(Math.round(box.height)));

  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}

const BUTTON =
  "rounded-full border border-hairline bg-surface px-2.5 py-0.5 font-mono text-[0.6875rem] text-muted transition-colors hover:border-accent/50 hover:text-accent";

/** CSV of every panel in the view — the whole model's working in one file. */
export function ExportAllCsv({ panels, name }: { panels: Panel[]; name: string }) {
  return (
    <button
      type="button"
      onClick={() => download(panelsToCsv(panels), `${exportName(name)}.csv`, "text/csv;charset=utf-8")}
      title="Download every figure, series, table and calculation step in this view as a CSV"
      className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
    >
      CSV
    </button>
  );
}

/** CSV and SVG for one panel, at the foot of its card. */
export function PanelExport({
  panel,
  name,
  chartRef,
}: {
  panel: Panel;
  name: string;
  chartRef: RefObject<HTMLDivElement | null>;
}) {
  const stem = exportName(name, panel.id);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => download(panelToCsv(panel), `${stem}.csv`, "text/csv;charset=utf-8")}
        title="This panel's figures, series and calculation steps as a CSV"
        className={BUTTON}
      >
        CSV
      </button>
      {(panel.chart || panel.timeseries) && (
        <button
          type="button"
          onClick={() => {
            const svg = chartRef.current?.querySelector("svg");
            if (svg) download(svgText(svg), `${stem}.svg`, "image/svg+xml;charset=utf-8");
          }}
          title="This chart as a standalone SVG, in the theme you are looking at"
          className={BUTTON}
        >
          SVG
        </button>
      )}
    </div>
  );
}
