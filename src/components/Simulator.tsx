"use client";

import { useMemo, useState } from "react";
import type { CountrySize, Economy, ExchangeRegime, Openness } from "@/lib/econ/types";
import { validateEconomy } from "@/lib/econ/types";
import { defaultEconomy, withDefaults } from "@/lib/econ/defaults";
import { COUNTRIES } from "@/lib/econ/countries";
import { MODELS, MODEL_GROUPS, runModel } from "@/lib/econ/registry";
import { applyShocks } from "@/lib/econ/shocks";
import { mergePanels } from "@/lib/econ/compare";
import { useTweenedEconomy } from "@/hooks/useTweenedEconomy";
import { PanelCard } from "./PanelCard";
import { ParamControl, Segmented } from "./ParamControl";
import { ShockControls } from "./ShockControls";
import { GlossaryPanel } from "./GlossaryPanel";
import { PresetManager } from "./PresetManager";
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
  help: string;
}

const PARAMS: ParamDef[] = [
  { key: "A", label: "Technology A", min: 0.5, max: 2, step: 0.01, group: "Production", simple: true, help: "Total factor productivity — how much output you get from a given amount of capital and labour. A higher A raises potential output." },
  { key: "alpha", label: "Capital share α", min: 0.1, max: 0.6, step: 0.01, group: "Production", simple: true, help: "The share of income that goes to capital (about 0.33 in most countries). The rest, 1−α, is labour's share." },
  { key: "L", label: "Labour L", min: 10, max: 1000, step: 1, group: "Production", help: "The size of the workforce." },
  { key: "K0", label: "Initial capital K₀", min: 10, max: 2000, step: 1, group: "Production", help: "The starting capital stock. The Solow model grows it toward its steady state." },

  { key: "s", label: "Saving rate s", min: 0.05, max: 0.5, step: 0.01, group: "Growth (long run)", simple: true, help: "The share of income households save. More saving builds more capital, but does not raise long-run growth per worker." },
  { key: "n", label: "Population growth n", min: -0.02, max: 0.05, step: 0.001, group: "Growth (long run)", simple: true, help: "How fast the workforce grows. Higher n needs more investment just to keep capital per worker constant." },
  { key: "g", label: "Tech growth g", min: 0, max: 0.05, step: 0.001, group: "Growth (long run)", simple: true, help: "How fast productivity improves over time." },
  { key: "delta", label: "Depreciation δ", min: 0.01, max: 0.15, step: 0.005, group: "Growth (long run)", simple: true, help: "The share of the capital stock that wears out each period." },

  { key: "G", label: "Government G", min: 0, max: 100, step: 1, group: "Fiscal & money", simple: true, help: "Government spending. Raising it shifts the IS curve right." },
  { key: "T", label: "Taxes T", min: 0, max: 100, step: 1, group: "Fiscal & money", simple: true, help: "Lump-sum taxes. They reduce disposable income and shift the IS curve left." },
  { key: "M", label: "Money supply M", min: 10, max: 300, step: 1, group: "Fiscal & money", simple: true, help: "How much money the central bank has supplied. Raising it shifts the LM curve right." },
  { key: "P", label: "Price level P", min: 0.5, max: 2, step: 0.01, group: "Fiscal & money", help: "Average prices. Real money balances are M/P." },

  { key: "c0", label: "Autonomous consumption c₀", min: 0, max: 50, step: 1, group: "Behaviour", help: "Consumption that happens regardless of income." },
  { key: "c1", label: "MPC c₁", min: 0.1, max: 0.95, step: 0.01, group: "Behaviour", help: "The marginal propensity to consume — the fraction of each extra unit of income that is spent. Higher c1 makes the IS curve flatter and the fiscal multiplier bigger." },
  { key: "I0", label: "Autonomous investment I₀", min: 0, max: 200, step: 1, group: "Behaviour", help: "Investment that happens regardless of the interest rate." },
  { key: "b", label: "Investment sensitivity b", min: 10, max: 500, step: 5, group: "Behaviour", help: "How strongly investment reacts to the interest rate." },
  { key: "kY", label: "Money demand k", min: 0.1, max: 1.5, step: 0.01, group: "Behaviour", help: "How much money people want to hold per unit of income. Higher k tilts the LM curve up." },
  { key: "hR", label: "Money demand h", min: 20, max: 500, step: 5, group: "Behaviour", help: "How strongly money demand falls as the interest rate rises. Higher h flattens the LM curve." },

  { key: "rStar", label: "World rate r*", min: 0, max: 0.1, step: 0.001, group: "Open economy", simple: true, help: "The interest rate prevailing in world markets. A small open economy takes it as given." },
  { key: "rho", label: "Risk premium ρ", min: 0, max: 0.1, step: 0.001, group: "Open economy", simple: true, help: "Extra yield investors demand to hold this country's assets, above the world rate." },
  { key: "X0", label: "Exports X₀", min: 0, max: 60, step: 1, group: "Open economy", help: "Autonomous exports — sales abroad independent of income and the exchange rate." },
  { key: "importProp", label: "Import propensity m", min: 0, max: 0.3, step: 0.005, group: "Open economy", help: "The fraction of each extra unit of income spent on imports." },
  { key: "fxSensitivity", label: "FX sensitivity v", min: 1, max: 40, step: 1, group: "Open economy", help: "How strongly net exports react to the real exchange rate." },
  { key: "kappa", label: "Capital mobility κ", min: 1, max: 100, step: 1, group: "Open economy", help: "How freely capital crosses the border. Small κ means a steeper BP curve (less mobile)." },
  { key: "fxPeg", label: "Peg level ε̄", min: 0.5, max: 1.5, step: 0.01, group: "Open economy", help: "The real exchange rate the central bank defends when the regime is Fixed." },

  { key: "lambda", label: "SRAS slope λ", min: 0.1, max: 2, step: 0.05, group: "Adjustment", help: "How strongly prices respond to an output gap — i.e. how flexible short-run supply is." },
  { key: "theta", label: "Expectations speed θ", min: 0.05, max: 1, step: 0.05, group: "Adjustment", help: "How quickly price expectations catch up to realised prices, and so how fast the economy returns to potential output." },
];

const GROUP_ORDER = ["Production", "Growth (long run)", "Fiscal & money", "Behaviour", "Open economy", "Adjustment"];

function LogoMark() {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] font-mono text-sm font-bold text-accentink accent-glow"
      style={{ background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--gain) 65%, var(--accent)))" }}
    >
      Σ
    </span>
  );
}

export function Simulator() {
  const [economy, setEconomy] = useState<Economy>(() => defaultEconomy());
  const [baseline, setBaseline] = useState<Economy>(() => defaultEconomy());
  const [shocks, setShocks] = useState<string[]>([]);
  const [model, setModel] = useState("solow");
  const [expert, setExpert] = useState(false);
  const [compare, setCompare] = useState<CompareMode>("current");

  const update = (patch: Partial<Economy>) => setEconomy((e) => ({ ...e, ...patch }));
  const issues = useMemo(() => validateEconomy(economy), [economy]);

  const { economy: shockedEconomy } = useMemo(() => applyShocks(economy, shocks), [economy, shocks]);
  const hasShocks = shocks.length > 0;

  // Ease the economy so curves and figures morph instead of jumping.
  const tweened = useTweenedEconomy(shockedEconomy);

  // With shocks active the reference is the same economy without them; otherwise
  // it is the pinned baseline.
  const reference = hasShocks ? economy : baseline;
  const shownEconomy = compare === "baseline" ? reference : tweened;

  const panels = useMemo(() => {
    if (model === "glossary") return [];
    try {
      const current = runModel(model, shownEconomy);
      if (compare !== "both") return current;
      return mergePanels(current, runModel(model, reference));
    } catch {
      return null;
    }
  }, [model, shownEconomy, reference, compare]);

  const loadEconomy = (e: Economy) => {
    setEconomy(e);
    setBaseline(e);
    setShocks([]);
    setCompare("current");
  };

  const toggleShock = (id: string) => {
    const next = shocks.includes(id) ? shocks.filter((x) => x !== id) : [...shocks, id];
    setShocks(next);
    setCompare(next.length > 0 ? "both" : "current");
  };

  const clearShocks = () => {
    setShocks([]);
    setCompare("current");
  };

  return (
    <div className="relative min-h-screen">
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
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark />
            <div className="min-w-0 leading-tight">
              <div className="text-base font-bold tracking-tight text-ink">EconoSim</div>
              <div className="truncate font-mono text-[0.6875rem] uppercase tracking-wider text-muted">
                {economy.name}
                {hasShocks && <span className="text-accent"> · {shocks.length} shock{shocks.length > 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggle />
            <div className="w-[13rem]">
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
            <div className="w-[9.5rem]">
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
                setBaseline({ ...economy });
                setShocks([]);
                setCompare("both");
              }}
              title="Freeze the current economy as the comparison baseline"
              className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
            >
              Pin baseline
            </button>
            <button
              type="button"
              onClick={() => loadEconomy(defaultEconomy())}
              className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
            >
              Reset
            </button>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1520px] gap-4 p-4 lg:grid-cols-[230px_minmax(0,1fr)_300px]">
        <aside className="space-y-4">
          <div className="card reveal p-4">
            <h2 className="mb-2.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Country presets</h2>
            <div className="flex flex-wrap gap-1.5">
              {COUNTRIES.map((c) => {
                const active = economy.name === c.name;
                return (
                  <button
                    key={c.id}
                    type="button"
                    title={`${c.note} — ${c.source}`}
                    onClick={() => loadEconomy(withDefaults({ ...c.params, name: c.name }))}
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
            <p className="mt-2.5 text-[0.6875rem] leading-snug text-muted/80">
              Stylised approximations (World Bank / PWT / AMECO), editable. Real-side parameters only.
            </p>
          </div>

          <PresetManager current={economy} onLoad={loadEconomy} />

          <nav className="card reveal p-4" style={{ animationDelay: "110ms" }}>
            <h2 className="mb-2.5 font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Models</h2>
            {MODEL_GROUPS.map((g) => (
              <div key={g} className="mb-3 last:mb-0">
                <div className="mb-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted/70">{g}</div>
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
              <div className="mb-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted/70">Reference</div>
              <button
                type="button"
                onClick={() => setModel("glossary")}
                title="What every symbol and switch means"
                className={`relative w-full rounded-md py-1.5 pl-3 pr-2 text-left text-xs transition-all duration-200 ${
                  model === "glossary" ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface2 hover:text-ink"
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute left-0 top-1/2 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-300 ${
                    model === "glossary" ? "h-4 opacity-100" : "h-0 opacity-0"
                  }`}
                />
                Glossary
              </button>
            </div>
          </nav>
        </aside>

        <main key={model} className="min-w-0 space-y-4">
          {model !== "glossary" && <ShockControls active={shocks} onToggle={toggleShock} onClear={clearShocks} />}

          {compare !== "current" && model !== "glossary" && (
            <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs text-muted">
              <span>
                {hasShocks
                  ? "Showing the economy with the shock(s); dashed lines and the ▲/▼ figures are the same economy without them."
                  : "Showing the comparison against the pinned baseline — baseline curves are dashed and each figure shows its change."}
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

          {model === "glossary" ? (
            <GlossaryPanel />
          ) : panels && panels.length > 0 ? (
            panels.map((p, i) => <PanelCard key={p.id} panel={p} index={i} />)
          ) : (
            <div className="card border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-ink">
              This model could not be computed with the current parameters. Adjust the sliders to bring the economy
              back into range.
            </div>
          )}
        </main>

        <aside className="lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <div className="card reveal p-4">
            <h2 className="mb-1 font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Parameters</h2>

            <Segmented<Openness>
              label="Openness"
              help="Closed switches trade off, so the open-economy models collapse to plain IS-LM. Open lets the country trade and borrow abroad."
              value={economy.openness}
              options={[
                { value: "closed", label: "Closed" },
                { value: "open", label: "Open" },
              ]}
              onChange={(v) => update({ openness: v })}
            />
            <Segmented<CountrySize>
              label="Country size"
              help="Small: perfect capital mobility — the country takes the world interest rate as given and its own policy does not move world rates. Large: its borrowing does move the world rate, so the BP curve slopes and policy spills over."
              value={economy.size}
              options={[
                { value: "small", label: "Small" },
                { value: "large", label: "Large" },
              ]}
              onChange={(v) => update({ size: v })}
            />
            <Segmented<ExchangeRegime>
              label="Exchange rate"
              help="Floating: the exchange rate adjusts, so monetary policy is powerful. Fixed: the peg is defended and the money supply adjusts instead, so fiscal policy is powerful and monetary policy loses its independent effect."
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
                  <div className="mb-1 font-mono text-[0.625rem] uppercase tracking-wider text-muted/70">{g}</div>
                  {defs.map((p) => (
                    <ParamControl
                      key={p.key}
                      label={p.label}
                      help={p.help}
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
