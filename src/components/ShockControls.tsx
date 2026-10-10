"use client";

import { SHOCK_PRESETS } from "@/lib/econ/shocks";

/**
 * The per-model shock control. Every model shows the economy with the active
 * shocks and — in Compare mode — the same economy without them.
 */
export function ShockControls({
  active,
  onToggle,
  onClear,
}: {
  active: string[];
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <section className="card reveal p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight text-ink">Shock this economy</h3>
        {active.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-hairline px-2.5 py-0.5 text-[0.6875rem] text-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            Clear {active.length} shock{active.length > 1 ? "s" : ""}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">
        Click a shock to apply it. The panels below then show the economy <span className="text-ink">with</span> the
        shock, and — in Compare — the same economy <span className="text-ink">without</span> it, with the difference
        called out on every figure.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SHOCK_PRESETS.map((s) => {
          const on = active.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              title={s.help}
              aria-pressed={on}
              onClick={() => onToggle(s.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
                on
                  ? "border-accent bg-accent text-accentink accent-glow"
                  : "border-hairline text-muted hover:-translate-y-px hover:border-accent/50 hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
      {active.length === 0 && (
        <p className="mt-2 font-mono text-[0.625rem] uppercase tracking-wider text-muted/70">no shocks applied</p>
      )}
    </section>
  );
}
