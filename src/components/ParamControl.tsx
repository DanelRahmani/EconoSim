"use client";

import { fmtNum } from "@/lib/format";

/** A labelled slider with a synced numeric input. */
export function ParamControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const id = `p-${label.replace(/[^a-z0-9]/gi, "-")}`;
  return (
    <div className="py-1.5">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs text-neutral-600 dark:text-neutral-400">
          {label}
        </label>
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
          className="w-20 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-1.5 py-0.5 text-right font-mono text-xs"
        />
      </div>
      <input
        id={id}
        type="range"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-blue-600"
      />
      <div className="flex justify-between font-mono text-[10px] text-neutral-400">
        <span>{fmtNum(min, 2)}</span>
        <span>{fmtNum(max, 2)}</span>
      </div>
    </div>
  );
}

/** A segmented control for enum-valued parameters (regime, size, openness). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="py-1.5">
      <div className="text-xs text-neutral-600 dark:text-neutral-400 mb-1">{label}</div>
      <div role="group" aria-label={label} className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 text-xs ${
              value === o.value
                ? "bg-blue-600 text-white"
                : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
