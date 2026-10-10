"use client";

import { fmtNum } from "@/lib/format";
import { InfoNote } from "./ui/InfoNote";

/** A labelled slider with a synced numeric input and a click-to-open explanation. */
export function ParamControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  help,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  help?: string;
}) {
  const id = `p-${label.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <div className="py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <label htmlFor={id} className="text-[0.75rem] leading-snug text-muted">
          {label}
        </label>
        {help && <InfoNote help={help} label={label} />}
        <input
          type="number"
          value={Number.isFinite(value) ? value : 0}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
          }}
          className="ml-auto w-20 shrink-0 rounded-md border border-hairline bg-surface2 px-1.5 py-0.5 text-right font-mono text-[0.6875rem] text-ink transition-colors focus:border-accent focus:outline-none"
        />
      </div>
      <input
        id={id}
        type="range"
        className="slider mt-1.5"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
      <div className="flex justify-between font-mono text-[0.6875rem] text-muted/70">
        <span>{fmtNum(min, 2)}</span>
        <span>{fmtNum(max, 2)}</span>
      </div>
    </div>
  );
}

/** A segmented control with a sliding indicator and an optional explanation. */
export function Segmented<T extends string>({
  label,
  help,
  value,
  options,
  onChange,
  className,
}: {
  label?: string;
  help?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div className={`py-1.5 ${className ?? ""}`}>
      {label && (
        <div className="mb-1 flex flex-wrap items-center gap-x-2">
          <span className="text-[0.75rem] text-muted">{label}</span>
          {help && <InfoNote help={help} label={label} />}
        </div>
      )}
      <div
        role="group"
        aria-label={label ?? "options"}
        className="relative inline-grid w-full rounded-full border border-hairline bg-surface2 p-0.5"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        <span
          aria-hidden
          className="absolute top-0.5 bottom-0.5 rounded-full bg-accent accent-glow transition-[left] duration-300 ease-out"
          style={{
            width: `calc((100% - 4px) / ${options.length})`,
            left: `calc(2px + (100% - 4px) / ${options.length} * ${index})`,
          }}
        />
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`relative z-10 truncate rounded-full px-2 py-1 text-[0.75rem] transition-colors duration-200 ${
              value === o.value ? "text-accentink" : "text-muted hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
