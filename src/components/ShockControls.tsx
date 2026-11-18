"use client";

import { useState } from "react";
import { type CustomField, type ShockDef, type ShockMode, type ShockSpec, type ResolvedShock } from "@/lib/econ/shocks";

const MODES: { value: ShockMode; label: string; hint: string }[] = [
  { value: "percent", label: "%", hint: "Change by a percentage" },
  { value: "delta", label: "±", hint: "Add or subtract an amount" },
  { value: "absolute", label: "=", hint: "Set to a value" },
];

/**
 * Per-model shock control. Presets are one click; the builder below lets you
 * shock any field yourself — raising technology, cutting the birth rate, and so on.
 */
export function ShockControls({
  presets,
  fields,
  specs,
  applied,
  onTogglePreset,
  onAddCustom,
  onRemove,
  onClear,
  bare = false,
}: {
  /** Drop the card frame and heading, for use inside a sidebar tab. */
  bare?: boolean;
  /** The presets that can move the current model. */
  presets: ShockDef[];
  /** The fields the current model reads, for the custom builder. */
  fields: CustomField[];
  specs: ShockSpec[];
  applied: ResolvedShock[];
  onTogglePreset: (id: string) => void;
  onAddCustom: (s: Omit<Extract<ShockSpec, { kind: "custom" }>, "id" | "kind">) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [key, setKey] = useState<string>((fields[0]?.key as string) ?? "");
  const [mode, setMode] = useState<ShockMode>("percent");
  const [amount, setAmount] = useState("10");

  const field = fields.find((f) => (f.key as string) === key) ?? fields[0];
  const isPresetOn = (id: string) => specs.some((s) => s.kind === "preset" && s.id === id);

  const add = () => {
    const value = Number(amount.replace(",", "."));
    if (!field || !Number.isFinite(value)) return;
    onAddCustom({
      label: name.trim() || `${field.label} ${mode === "absolute" ? "=" : mode === "percent" ? `${value}%` : `${value > 0 ? "+" : ""}${value}`}`,
      key: field.key,
      mode,
      amount: value,
    });
    setName("");
    setAmount(mode === "percent" ? "10" : "1");
    setOpen(false);
  };

  return (
    <section className={bare ? "" : "card reveal p-4"}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        {bare ? (
          <span className="text-[0.75rem] text-muted">Click to apply; click again to remove.</span>
        ) : (
          <h3 className="font-display text-base font-semibold tracking-[-0.01em] text-ink">Shock this economy</h3>
        )}
        {specs.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-full border border-hairline px-2.5 py-0.5 text-[0.6875rem] text-muted transition-colors hover:border-accent/50 hover:text-accent"
          >
            Clear all
          </button>
        )}
      </div>
      {!bare && (
        <p className="mt-1 text-xs leading-relaxed text-muted">
          The panels show the economy <span className="text-ink">with</span> the shock selected, and in Compare the
          same economy <span className="text-ink">without</span> it, with the difference on every figure.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {presets.map((s) => {
          const on = isPresetOn(s.id);
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              title={s.help}
              onClick={() => onTogglePreset(s.id)}
              className={`rounded-full border px-3 py-1 text-xs transition-all duration-200 ${
                on
                  ? "border-accent bg-accent text-accentink"
                  : "border-hairline text-muted hover:-translate-y-px hover:border-accent/50 hover:text-ink"
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Active shocks, including the ones you built yourself. */}
      {applied.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {applied.map((s) => (
            <li key={s.id}>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[0.6875rem] text-ink">
                <span className="font-medium">{s.label}</span>
                {s.detail && <span className="font-mono text-muted">{s.detail}</span>}
                <button
                  type="button"
                  onClick={() => onRemove(s.id)}
                  aria-label={`Remove ${s.label}`}
                  className="text-muted transition-colors hover:text-accent"
                >
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Custom shock builder */}
      <div className="mt-3 border-t border-hairline pt-3">
        {fields.length === 0 ? null : !open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-full border border-dashed border-hairline px-3 py-1 text-xs text-muted transition-colors hover:border-accent/60 hover:text-accent"
          >
            + Build your own shock
          </button>
        ) : (
          <div className="rounded-xl border border-hairline bg-surface2/50 p-3">
            <div className="font-mono text-[0.75rem]  text-muted">Your shock</div>

            <div className="mt-2 grid gap-2">
              <label className="text-[0.75rem] text-muted">
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Baby bust"
                  className="mt-1 w-full rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-muted/60 focus:border-accent focus:outline-none"
                />
              </label>

              <label className="text-[0.75rem] text-muted">
                What changes
                <select
                  value={(field?.key as string) ?? ""}
                  onChange={(e) => setKey(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
                >
                  {["Production", "Growth", "Fiscal", "Monetary", "External"]
                    .filter((g) => fields.some((f) => f.group === g))
                    .map((g) => (
                    <optgroup key={g} label={g}>
                      {fields.filter((f) => f.group === g).map((f) => (
                        <option key={f.key as string} value={f.key as string}>
                          {f.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-2 flex flex-wrap items-end gap-2">
              <div>
                <div className="text-[0.75rem] text-muted">How</div>
                <div role="group" aria-label="Change type" className="mt-1 inline-flex overflow-hidden rounded-full border border-hairline">
                  {MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      title={m.hint}
                      aria-pressed={mode === m.value}
                      onClick={() => setMode(m.value)}
                      className={`px-3 py-1 font-mono text-xs transition-colors ${
                        mode === m.value ? "bg-accent text-accentink" : "text-muted hover:text-ink"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="text-[0.75rem] text-muted">
                Amount
                <input
                  type="text"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="mt-1 w-24 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-right font-mono text-xs text-ink focus:border-accent focus:outline-none"
                />
              </label>

              <button
                type="button"
                onClick={add}
                className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-accentink transition-colors hover:bg-accenthover"
              >
                Add shock
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-hairline px-3 py-1.5 text-xs text-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </div>

            <p className="mt-2 text-[0.6875rem] leading-relaxed text-muted">
              <span className="font-mono">%</span> change by a percentage · <span className="font-mono">±</span> add or
              subtract · <span className="font-mono">=</span> set to a value. Rises above are relative to whatever the
              sliders currently say.
            </p>
          </div>
        )}
      </div>

      <details className="mt-3 rounded-xl border border-hairline bg-surface2/50">
        <summary className="cursor-pointer select-none list-none px-3 py-2 text-[0.75rem] text-muted marker:content-none hover:text-ink">
          What does each preset do?
        </summary>
        <dl className="space-y-2 px-3 pb-3 pt-1">
          {presets.map((s) => (
            <div key={s.id}>
              <dt className="text-[0.75rem] font-medium text-ink">{s.label}</dt>
              <dd className="text-[0.6875rem] leading-relaxed text-muted">{s.help}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}
