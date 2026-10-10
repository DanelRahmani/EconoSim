"use client";

import { useMemo, useState } from "react";
import type { CountrySize, Economy, ExchangeRegime, Openness, ShockEvent } from "@/lib/econ/types";
import { validateEconomy } from "@/lib/econ/types";
import { defaultEconomy, withDefaults } from "@/lib/econ/defaults";
import { COUNTRIES } from "@/lib/econ/countries";
import { MODELS, MODEL_GROUPS, runModel } from "@/lib/econ/registry";
import { baselineVsScenario } from "@/lib/econ/scenario";
import { mergePanels } from "@/lib/econ/compare";
import { useTweenedEconomy } from "@/hooks/useTweenedEconomy";
import { PanelCard } from "./PanelCard";
import { ParamControl, Segmented } from "./ParamControl";
import { TimeSeriesChart } from "./charts/TimeSeriesChart";
import { ThemeToggle } from "./theme/ThemeToggle";

type CompareMode = "current" | "baseline" | "both";

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

const GROUP_ORDER = ["Production", "Growth (long run)", "Fiscal & money", "Behaviour", "Open economy", "Adjustment"];

const SHOCK_LABELS = [
  { id: "monetary", label: "Monetary expansion (M +10%) at t=20" },
  { id: "fiscal", label: "Fiscal expansion (G +10) at t=35" },
  { id: "oil", label: "Oil shock (P* +20%) at t=50" },
];

function LogoMark() {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 place-items-center rounded-[10px] font-mono text-sm font-bold text-accentink accent-glow"
      style={{ background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--gain) 65%, var(--accent)))" }}
    >
      Σ
    </span>
  );
}

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
    <section className="card card-hover reveal p-5">
      <h3 className="text-base font-semibold tracking-tight text-ink">Shock lab</h3>
      <p className="mt-1 text-sm text-muted">
        Switch shocks on at dated moments and watch output respond, then settle back toward potential.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {SHOCK_LABELS.map((s) => (
          <label
            key={s.id}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              on[s.id] ? "border-accent/50 bg-accent/5 text-ink" : "border-hairline text-muted hover:text-ink"
            }`}
          >
            <input
              type="checkbox"
              checked={!!on[s.id]}
              onChange={(e) => setOn((prev) => ({ ...prev, [s.id]: e.target.checked }))}
              className="accent-[var(--accent)]"
              style={{ accentColor: "var(--accent)" }}
            />
            {s.label}
          </label>
        ))}
      </div>
      <div className="mt-5">
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
  const [baseline, setBaseline] = useState<Economy>(() => defaultEconomy());
  const [model, setModel] = useState("solow");
  const [expert, setExpert] = useState(false);
  const [compare, setCompare] = useState<CompareMode>("current");

  const update = (patch: Partial<Economy>) => setEconomy((e) => ({ ...e, ...patch }));
  const issues = useMemo(() => validateEconomy(economy), [economy]);

  // Ease the economy so curves and figures morph instead of jumping.
  const tweened = useTweenedEconomy(economy);
  const shownEconomy = compare === "baseline" ? baseline : tweened;

  const panels = useMemo(() => {
    if (model === "shocks") return [];
    try {
      const current = runModel(model, shownEconomy);
      if (compare !== "both") return current;
      return mergePanels(current, runModel(model, baseline));
    } catch {
      return null;
    }
  }, [model, shownEconomy, baseline, compare]);

  return (
    <div className="relative min-h-screen">
      {/* Ambient background */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="aurora absolute -left-40 -top-48 h-[28rem] w-[28rem] rounded-full blur-[130px]"
          style={{ background: "color-mix(in oklab, var(--accent) 20%, transparent)" }}
        />
        <div
          className="aurora absolute -top-24 right-0 h-80 w-80 rounded-full blur-[130px]"
          style={{ background: "color-mix(in oklab, var(--gain) 16%, transparent)", animationDelay: "3s" }}
        />
      </div>

      <header className="sticky top-0 z-20 border-b border-hairline bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <LogoMark />
            <div className="leading-tight">
              <div className="text-base font-bold tracking-tight text-ink">EconoSim</div>
              <div className="font-mono text-[0.625rem] uppercase tracking-wider text-muted">{economy.name}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <ThemeToggle />
            <div className="w-56">
              <Segmented<CompareMode>
                value={compare}
                options={[
                  { value: "current", label: "Current" },
                  { value: "baseline", label: "Baseline" },
                  { value: "both", label: "Compare" },
                ]}
                onChange={setCompare}
              />
            </div>
            <div className="w-40">
              <Segmented
                value={expert ? "expert" : "simple"}
                options={[
                  { value: "simple", label: "Simple" },
                  { value: "expert", label: "Expert" },
                ]}
                onChange={(v) => setExpert(v === "expert")}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                const snap = { ...economy };
                setBaseline(snap);
                setCompare("both");
              }}
              title="Pin the current economy as the comparison baseline"
              className="rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
            >
              Pin baseline
            </button>
            <button
              type="button"
              onClick={() => {
                setEconomy(defaultEconomy());
                setBaseline(defaultEconomy());
                setCompare("current");
              }}
              className="rounded-full border border-hairline bg-surface px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1520px] gap-4 p-4 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        {/* Left: presets + models */}
        <aside className="space-y-4">
          <div className="card reveal p-4">
            <h2 className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted">Country presets</h2>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map((c) => {
                const active = economy.name === c.name;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={`${c.note} — ${c.source}`}
                    onClick={() => {
                      const next = withDefaults({ ...c.params, name: c.name });
                      setEconomy(next);
                      setBaseline(next);
                    }}
                    className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-200 ${
                      active
                        ? "border-accent bg-accent text-accentink accent-glow"
                        : "border-hairline text-muted hover:-translate-y-px hover:border-accent/50 hover:text-ink"
                    }`}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-[0.625rem] leading-snug text-muted/80">
              Stylised approximations (World Bank / PWT / AMECO), editable. Real-side parameters only.
            </p>
          </div>

          <nav className="card reveal p-4" style={{ animationDelay: "70ms" }}>
            <h2 className="mb-2.5 font-mono text-[0.625rem] uppercase tracking-wider text-muted">Models</h2>
            {MODEL_GROUPS.map((g) => (
              <div key={g} className="mb-3 last:mb-0">
                <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-muted/70">{g}</div>
                <div className="flex flex-col gap-0.5">
                  {MODELS.filter((m) => m.group === g).map((m) => {
                    const active = model === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        title={m.blurb}
                        onClick={() => setModel(m.id)}
                        className={`relative rounded-md py-1.5 pl-3 pr-2 text-left text-xs transition-all duration-200 ${
                          active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface2 hover:text-ink"
                        }`}
                      >
                        <span
                          aria-hidden
                          className={`absolute left-0 top-1/2 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-300 ${
                            active ? "h-4 opacity-100" : "h-0 opacity-0"
                          }`}
                        />
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-1 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={() => setModel("shocks")}
                className={`relative w-full rounded-md py-1.5 pl-3 pr-2 text-left text-xs transition-all duration-200 ${
                  model === "shocks" ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface2 hover:text-ink"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute left-0 top-1/2 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-300 ${
                    model === "shocks" ? "h-4 opacity-100" : "h-0 opacity-0"
                  }`}
                />
                Shock lab
              </button>
            </div>
          </nav>
        </aside>

        {/* Center: output */}
        <main key={model} className="min-w-0 space-y-4">
          {compare !== "current" && model !== "shocks" && (
            <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs text-muted">
              <span>
                {compare === "both"
                  ? "Comparing against the pinned baseline — baseline curves are dashed and each figure shows its change."
                  : "Showing the pinned baseline economy."}
              </span>
              <button
                type="button"
                onClick={() => setCompare("current")}
                className="shrink-0 rounded-full border border-hairline px-2.5 py-0.5 transition-colors hover:border-accent/50 hover:text-accent"
              >
                Show current
              </button>
            </div>
          )}
          {issues.length > 0 && (
            <div className="card border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-ink">
              Some parameters are out of range: {issues.map((i) => i.message).join("; ")}
            </div>
          )}
          {model === "shocks" ? (
            <ShocksView economy={economy} />
          ) : panels && panels.length > 0 ? (
            panels.map((p, i) => <PanelCard key={p.id} panel={p} index={i} />)
          ) : (
            <div className="card border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-ink">
              This model could not be computed with the current parameters. Adjust the sliders to bring the economy
              back into range.
            </div>
          )}
        </main>

        {/* Right: parameters */}
        <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
          <div className="card reveal p-4">
            <h2 className="mb-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted">Parameters</h2>

            <Segmented<Openness>
              label="Openness"
              value={economy.openness}
              options={[
                { value: "closed", label: "Closed" },
                { value: "open", label: "Open" },
              ]}
              onChange={(v) => update({ openness: v })}
            />
            <Segmented<CountrySize>
              label="Country size"
              value={economy.size}
              options={[
                { value: "small", label: "Small" },
                { value: "large", label: "Large" },
              ]}
              onChange={(v) => update({ size: v })}
            />
            <Segmented<ExchangeRegime>
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
                <div key={g} className="mt-3 border-t border-hairline pt-3">
                  <div className="mb-1 font-mono text-[0.5625rem] uppercase tracking-wider text-muted/70">{g}</div>
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
          </div>
        </aside>
      </div>
    </div>
  );
}
