"use client";

import { useMemo, useState } from "react";
import type { Economy } from "@/lib/econ/types";
import { validateEconomy } from "@/lib/econ/types";
import { defaultEconomy, withDefaults } from "@/lib/econ/defaults";
import { COUNTRIES } from "@/lib/econ/countries";
import { MODELS, MODEL_GROUPS, runModel } from "@/lib/econ/registry";
import { baselineVsScenario } from "@/lib/econ/scenario";
import type { ShockEvent } from "@/lib/econ/types";
import { PanelCard } from "./PanelCard";
import { ParamControl, Segmented } from "./ParamControl";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";

interface ParamDef {
  key: keyof Economy;
  label: string;
  min: number;
  max: number;
  step: number;
  group: string;
  simple?: boolean;
}

const PARAMS: ParamDef[] = [
  { key: "A", label: "Technology A", min: 0.5, max: 2, step: 0.01, group: "Production", simple: true },
  { key: "alpha", label: "Capital share α", min: 0.1, max: 0.6, step: 0.01, group: "Production", simple: true },
  { key: "L", label: "Labour L", min: 10, max: 1000, step: 1, group: "Production" },
  { key: "K0", label: "Initial capital K₀", min: 10, max: 2000, step: 1, group: "Production" },

  { key: "s", label: "Saving rate s", min: 0.05, max: 0.5, step: 0.01, group: "Growth (long run)", simple: true },
  { key: "n", label: "Population growth n", min: -0.02, max: 0.05, step: 0.001, group: "Growth (long run)", simple: true },
  { key: "g", label: "Tech growth g", min: 0, max: 0.05, step: 0.001, group: "Growth (long run)", simple: true },
  { key: "delta", label: "Depreciation δ", min: 0.01, max: 0.15, step: 0.005, group: "Growth (long run)", simple: true },

  { key: "G", label: "Government G", min: 0, max: 100, step: 1, group: "Fiscal & money", simple: true },
  { key: "T", label: "Taxes T", min: 0, max: 100, step: 1, group: "Fiscal & money", simple: true },
  { key: "M", label: "Money supply M", min: 10, max: 300, step: 1, group: "Fiscal & money", simple: true },
  { key: "P", label: "Price level P", min: 0.5, max: 2, step: 0.01, group: "Fiscal & money" },

  { key: "c0", label: "Autonomous consumption c₀", min: 0, max: 50, step: 1, group: "Behaviour" },
  { key: "c1", label: "MPC c₁", min: 0.1, max: 0.95, step: 0.01, group: "Behaviour" },
  { key: "I0", label: "Autonomous investment I₀", min: 0, max: 200, step: 1, group: "Behaviour" },
  { key: "b", label: "Investment sensitivity b", min: 10, max: 500, step: 5, group: "Behaviour" },
  { key: "kY", label: "Money demand k", min: 0.1, max: 1.5, step: 0.01, group: "Behaviour" },
  { key: "hR", label: "Money demand h", min: 20, max: 500, step: 5, group: "Behaviour" },

  { key: "rStar", label: "World rate r*", min: 0, max: 0.1, step: 0.001, group: "Open economy", simple: true },
  { key: "rho", label: "Risk premium ρ", min: 0, max: 0.1, step: 0.001, group: "Open economy", simple: true },
  { key: "X0", label: "Exports X₀", min: 0, max: 60, step: 1, group: "Open economy" },
  { key: "importProp", label: "Import propensity m", min: 0, max: 0.3, step: 0.005, group: "Open economy" },
  { key: "fxSensitivity", label: "FX sensitivity v", min: 1, max: 40, step: 1, group: "Open economy" },
  { key: "kappa", label: "Capital mobility κ", min: 1, max: 100, step: 1, group: "Open economy" },
  { key: "fxPeg", label: "Peg level ε̄", min: 0.5, max: 1.5, step: 0.01, group: "Open economy" },

  { key: "lambda", label: "SRAS slope λ", min: 0.1, max: 2, step: 0.05, group: "Adjustment" },
  { key: "theta", label: "Expectations speed θ", min: 0.05, max: 1, step: 0.05, group: "Adjustment" },
];

const GROUP_ORDER = [
  "Production",
  "Growth (long run)",
  "Fiscal & money",
  "Behaviour",
  "Open economy",
  "Adjustment",
];

const SHOCK_LABELS = [
  { id: "monetary", label: "Monetary expansion (M +10%) at t=20" },
  { id: "fiscal", label: "Fiscal expansion (G +10) at t=35" },
  { id: "oil", label: "Oil shock (P* +20%) at t=50" },
];

function ShocksView({ economy }: { economy: Economy }) {
  const [on, setOn] = useState<Record<string, boolean>>({ monetary: true, fiscal: true, oil: false });

  const scenario = useMemo(() => {
    const shocks: ShockEvent[] = [];
    if (on.monetary) shocks.push({ id: "m", t: 20, label: "Monetary expansion", changes: { M: economy.M * 1.1 } });
    if (on.fiscal) shocks.push({ id: "f", t: 35, label: "Fiscal expansion", changes: { G: economy.G + 10 } });
    if (on.oil) shocks.push({ id: "o", t: 50, label: "Oil shock", changes: { pStar: economy.pStar * 1.2 } });
    return { economy, shocks, horizon: 90, steps: 360 };
  }, [on, economy]);

  const cmp = useMemo(() => baselineVsScenario(scenario), [scenario]);

  return (
    <section className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 shadow-sm">
      <h3 className="text-base font-semibold">Shock lab</h3>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Turn shocks on at dated moments and watch output respond, then settle back toward potential.
      </p>
      <div className="mt-3 flex flex-col gap-1.5">
        {SHOCK_LABELS.map((s) => (
          <label key={s.id} className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!on[s.id]}
              onChange={(e) => setOn((prev) => ({ ...prev, [s.id]: e.target.checked }))}
              className="accent-blue-600"
            />
            {s.label}
          </label>
        ))}
      </div>
      <div className="mt-4">
        <TimeSeriesChart
          spec={{
            xLabel: "Time",
            yLabel: "Output (Y)",
            series: [
              { label: "Shocked economy", points: cmp.map((p) => ({ x: p.t, y: p.shocked })) },
              { label: "Baseline", points: cmp.map((p) => ({ x: p.t, y: p.base })) },
            ],
          }}
        />
      </div>
    </section>
  );
}

export function Simulator() {
  const [economy, setEconomy] = useState<Economy>(() => defaultEconomy());
  const [model, setModel] = useState("solow");
  const [expert, setExpert] = useState(false);

  const update = (patch: Partial<Economy>) => setEconomy((e) => ({ ...e, ...patch }));

  const issues = useMemo(() => validateEconomy(economy), [economy]);

  const panels = useMemo(() => {
    if (model === "shocks") return [];
    try {
      return runModel(model, economy);
    } catch {
      return null;
    }
  }, [model, economy]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100">
      <header className="sticky top-0 z-10 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-lg font-bold tracking-tight">EconoSim</span>
            <span className="text-sm text-neutral-500">economics simulator</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-xs text-neutral-500">{economy.name}</span>
            <div role="group" aria-label="Detail level" className="inline-flex rounded-lg border border-neutral-300 dark:border-neutral-700 overflow-hidden">
              {[
                { v: false, l: "Simple" },
                { v: true, l: "Expert" },
              ].map((o) => (
                <button
                  key={o.l}
                  type="button"
                  aria-pressed={expert === o.v}
                  onClick={() => setExpert(o.v)}
                  className={`px-3 py-1 text-xs ${expert === o.v ? "bg-blue-600 text-white" : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300"}`}
                >
                  {o.l}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setEconomy(defaultEconomy())}
              className="rounded-lg border border-neutral-300 dark:border-neutral-700 px-3 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[220px_minmax(0,1fr)_300px]">
        {/* Left: presets + model navigation */}
        <aside className="space-y-4">
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Country presets</h2>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={`${c.note} — ${c.source}`}
                  onClick={() => setEconomy(withDefaults({ ...c.params, name: c.name }))}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    economy.name === c.name
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-neutral-300 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-neutral-400">
              Stylised approximations (World Bank / PWT / AMECO), editable. Real-side parameters only.
            </p>
          </div>

          <nav className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">Models</h2>
            {MODEL_GROUPS.map((g) => (
              <div key={g} className="mb-2">
                <div className="text-[10px] uppercase tracking-wide text-neutral-400 mb-0.5">{g}</div>
                <div className="flex flex-col">
                  {MODELS.filter((m) => m.group === g).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      title={m.blurb}
                      onClick={() => setModel(m.id)}
                      className={`rounded-md px-2 py-1 text-left text-xs ${
                        model === m.id ? "bg-blue-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-1 border-t border-neutral-200 dark:border-neutral-800 pt-2">
              <button
                type="button"
                onClick={() => setModel("shocks")}
                className={`w-full rounded-md px-2 py-1 text-left text-xs ${
                  model === "shocks" ? "bg-blue-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                }`}
              >
                Shock lab
              </button>
            </div>
          </nav>
        </aside>

        {/* Center: output */}
        <main className="space-y-4 min-w-0">
          {issues.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              Some parameters are out of range: {issues.map((i) => i.message).join("; ")}
            </div>
          )}
          {model === "shocks" ? (
            <ShocksView economy={economy} />
          ) : panels && panels.length > 0 ? (
            panels.map((p) => <PanelCard key={p.id} panel={p} />)
          ) : (
            <div className="rounded-lg border border-rose-300 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-sm text-rose-800 dark:text-rose-200">
              This model could not be computed with the current parameters. Adjust the sliders to bring the economy back into range.
            </div>
          )}
        </main>

        {/* Right: parameters */}
        <aside className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">Parameters</h2>

          <Segmented
            label="Openness"
            value={economy.openness}
            options={[
              { value: "closed", label: "Closed" },
              { value: "open", label: "Open" },
            ]}
            onChange={(v) => update({ openness: v })}
          />
          <Segmented
            label="Country size"
            value={economy.size}
            options={[
              { value: "small", label: "Small" },
              { value: "large", label: "Large" },
            ]}
            onChange={(v) => update({ size: v })}
          />
          <Segmented
            label="Exchange rate"
            value={economy.regime}
            options={[
              { value: "floating", label: "Floating" },
              { value: "fixed", label: "Fixed" },
            ]}
            onChange={(v) => update({ regime: v })}
          />

          {GROUP_ORDER.map((g) => {
            const defs = PARAMS.filter((p) => p.group === g && (expert || p.simple));
            if (!defs.length) return null;
            return (
              <div key={g} className="mt-3 border-t border-neutral-200 dark:border-neutral-800 pt-2">
                <div className="text-[10px] uppercase tracking-wide text-neutral-400 mb-1">{g}</div>
                {defs.map((p) => (
                  <ParamControl
                    key={p.key}
                    label={p.label}
                    value={economy[p.key] as number}
                    min={p.min}
                    max={p.max}
                    step={p.step}
                    onChange={(v) => update({ [p.key]: v } as Partial<Economy>)}
                  />
                ))}
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
