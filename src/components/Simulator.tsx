"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AiOptions,
  CountrySize,
  Economy,
  ExchangeRegime,
  ExternalityOptions,
  Expectations,
  GameOptions,
  MarketOptions,
  MicroOptions,
  Openness,
  SweepParam,
  ZlbOptions,
} from "@/lib/econ/types";
import { validateEconomy } from "@/lib/econ/types";
import { defaultEconomy, withDefaults } from "@/lib/econ/defaults";
import { COUNTRIES } from "@/lib/econ/countries";
import { DEFAULT_AI, DEFAULT_EXTERNALITY, DEFAULT_EXPECTATIONS, DEFAULT_GAME, DEFAULT_HORIZON, DEFAULT_MARKET, DEFAULT_MICRO, DEFAULT_MODEL, DEFAULT_SWEEP, DEFAULT_SWEEP_AXIS, DEFAULT_SWEEP_FIGURE, DEFAULT_ZLB, HORIZON_PRESETS, MODELS, MODEL_GROUPS, getModel, runModel } from "@/lib/econ/registry";
import { readState, shareUrl, type CompareMode } from "@/lib/econ/permalink";
import { resolveShocks, type ShockSpec } from "@/lib/econ/shocks";
import { mergePanels } from "@/lib/econ/compare";
import { sweepAxisPanel, sweepPanel } from "@/lib/econ/comparativeStatics";
import type { Panel } from "@/lib/econ/panel";
import { useTweenedEconomy } from "@/hooks/useTweenedEconomy";
import { PanelCard } from "./PanelCard";
import { ParamControl, Segmented } from "./ParamControl";
import { ShareLink } from "./ShareLink";
import { ExportAllCsv } from "./Export";
import { ShockControls } from "./ShockControls";
import { GlossaryPanel } from "./GlossaryPanel";
import { PresetManager } from "./PresetManager";
import { ThemeToggle } from "./theme/ThemeToggle";
import { InfoNote } from "./ui/InfoNote";

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
  { key: "theta", label: "Expectations speed θ", min: 0.05, max: 1, step: 0.05, group: "Adjustment", help: "How quickly price expectations catch up to realised prices, and so how fast the economy returns to potential output. In the Phillips curve it also sets the sacrifice ratio 1/(βθ)." },

  { key: "piE", label: "Expected inflation πᵉ", min: 0, max: 0.2, step: 0.005, group: "Inflation & labour", simple: true, help: "The inflation rate people expect, and the rate the economy starts at. A high πᵉ makes a disinflation expensive." },
  { key: "piTarget", label: "Inflation target π*", min: 0, max: 0.15, step: 0.005, group: "Inflation & labour", simple: true, help: "What the central bank announces and delivers. The gap between πᵉ and π* is the size of the disinflation." },
  { key: "pcBeta", label: "Phillips slope β", min: 0.1, max: 1.5, step: 0.05, group: "Inflation & labour", simple: true, help: "How strongly unemployment pushes inflation away from expectations. A steeper curve means a cheaper disinflation." },
  { key: "un", label: "Natural unemployment uₙ", min: 0.01, max: 0.2, step: 0.005, group: "Inflation & labour", help: "The unemployment rate that leaves inflation unchanged. The WS-PS model derives it; this slider overrides it for the Phillips curve." },
  { key: "wagePush", label: "Wage push z", min: 0, max: 0.15, step: 0.005, group: "Inflation & labour", help: "Benefits, union strength, minimum wages — anything that lets workers win a higher real wage at a given unemployment rate." },
  { key: "markup", label: "Firms' mark-up m", min: 0, max: 0.4, step: 0.005, group: "Inflation & labour", help: "The mark-up firms charge over marginal cost. It fixes the real wage they can pay, and so helps set the natural rate." },
  { key: "wageSlope", label: "Wage-setting slope γ", min: 0.3, max: 3, step: 0.05, group: "Inflation & labour", help: "How sharply the real wage workers can win falls as unemployment rises. A steeper curve means a lower natural rate." },

  { key: "debtRatio", label: "Debt ratio b₀", min: 0, max: 2, step: 0.05, group: "Debt & balance of payments", simple: true, help: "Government debt as a share of GDP at the start." },
  { key: "primaryBalance", label: "Primary balance pb", min: -0.1, max: 0.1, step: 0.005, group: "Debt & balance of payments", simple: true, help: "The budget balance excluding interest payments, as a share of GDP. Positive is a surplus; debt is stable only if pb covers (r − g)·b." },
  { key: "reservesShare", label: "Reserves (share of M)", min: 0.05, max: 0.95, step: 0.05, group: "Debt & balance of payments", help: "Foreign reserves as a share of the money supply. The rest of the money supply is domestic credit, which is what drains the reserves." },
  { key: "creditGrowth", label: "Domestic credit growth μ", min: 0, max: 0.4, step: 0.005, group: "Debt & balance of payments", help: "How fast the government borrows from the central bank. Financing a deficit this way is what dates the collapse of a peg." },
];

const GROUP_ORDER = ["Production", "Growth (long run)", "Fiscal & money", "Behaviour", "Open economy", "Adjustment", "Inflation & labour", "Debt & balance of payments"];

/** Parameter labels by key, for prose outside the sidebar. */
const PARAM_LABEL: Partial<Record<keyof Economy, string>> = Object.fromEntries(
  PARAMS.map((p) => [p.key, p.label]),
);

/** The slider range of each parameter, so a sweep can cover what the UI can reach. */
const PARAM_RANGE: Partial<Record<keyof Economy, [number, number]>> = Object.fromEntries(
  PARAMS.map((p) => [p.key, [p.min, p.max] as [number, number]]),
);

/** The parameter list as grouped `<option>`s, shared by both sweep pickers. */
const PARAM_GROUPS = GROUP_ORDER.map((g) => (
  <optgroup key={g} label={g}>
    {PARAMS.filter((p) => p.group === g).map((p) => (
      <option key={p.key} value={p.key}>
        {p.label}
      </option>
    ))}
  </optgroup>
));

/** Scenario controls for the AI boom model. */
function AiControls({ value, onChange }: { value: AiOptions; onChange: (v: AiOptions) => void }) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-3">
      <ParamControl
        label="Labour replaced by AI (%)"
        help="The share of labour tasks AI performs. Displaced workers are not re-employed — the work moves to capital."
        value={value.substitutionPct}
        min={0}
        max={95}
        step={5}
        onChange={(v) => onChange({ ...value, substitutionPct: v })}
      />
      <ParamControl
        label="AI capital per displaced worker (×)"
        help="How much AI capital is installed per displaced worker, as a multiple of the economy's existing capital–labour ratio. 1× means like-for-like."
        value={value.capitalIntensity}
        min={0.2}
        max={3}
        step={0.1}
        onChange={(v) => onChange({ ...value, capitalIntensity: v })}
      />
      <ParamControl
        label="AI capital productivity (×)"
        help="How productive AI capital is relative to ordinary capital. Below the break-even, replacing labour with AI shrinks the economy."
        value={value.capitalProductivity}
        min={0.5}
        max={4}
        step={0.1}
        onChange={(v) => onChange({ ...value, capitalProductivity: v })}
      />
    </div>
  );
}

/** Scenario switch for the Phillips curve: is a disinflation believed or earned? */
function ExpectationsControl({ value, onChange }: { value: Expectations; onChange: (v: Expectations) => void }) {
  return (
    <Segmented<Expectations>
      label="Expectations"
      help="Adaptive: people learn from realised inflation, so the bank has to hold inflation below expectations and unemployment rises. Credible: the announcement is believed at once, expectations jump to the target, and the disinflation costs nothing."
      value={value}
      options={[
        { value: "adaptive", label: "Adaptive" },
        { value: "credible", label: "Credible" },
      ]}
      onChange={onChange}
    />
  );
}

/** Size of the demand shock in the zero-lower-bound model. */
function ZlbControls({ value, onChange }: { value: ZlbOptions; onChange: (v: ZlbOptions) => void }) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      <ParamControl
        label="Demand shock (% of potential output)"
        help="How hard demand is hit, as a share of potential output. Increase it until the natural rate of interest goes negative — that is when the zero bound starts to bind."
        value={value.demandShock * 100}
        min={0}
        max={60}
        step={5}
        onChange={(v) => onChange({ ...value, demandShock: v / 100 })}
      />
    </div>
  );
}

/** Textbook micro dials: prices, income and preference weight. */
function MicroControls({ value, onChange }: { value: MicroOptions; onChange: (v: MicroOptions) => void }) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-4">
      <ParamControl
        label="Price of x pₓ"
        help="The price of the good on the horizontal axis. Raising it rotates the budget line inwards."
        value={value.px}
        min={0.2}
        max={5}
        step={0.1}
        onChange={(v) => onChange({ ...value, px: v })}
      />
      <ParamControl
        label="Price of y p_y"
        help="The price of the good on the vertical axis. Raising it makes the budget line steeper."
        value={value.py}
        min={0.2}
        max={5}
        step={0.1}
        onChange={(v) => onChange({ ...value, py: v })}
      />
      <ParamControl
        label="Income I"
        help="Total income to spend. With Cobb-Douglas preferences, more income scales the whole bundle up proportionally."
        value={value.income}
        min={4}
        max={120}
        step={1}
        onChange={(v) => onChange({ ...value, income: v })}
      />
      <ParamControl
        label="Preference weight α"
        help="How much the consumer cares about x relative to y. It also fixes the share of income spent on x, whatever the prices are."
        value={value.weight}
        min={0.1}
        max={0.9}
        step={0.05}
        onChange={(v) => onChange({ ...value, weight: v })}
      />
    </div>
  );
}

/** One market's demand and cost — shared by the competition and externality models. */
function MarketControls({ value, onChange }: { value: MarketOptions; onChange: (v: MarketOptions) => void }) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-4">
      <ParamControl
        label="Demand intercept a"
        help="The price at which demand falls to zero, in P = a − b·Q. Higher means a bigger market."
        value={value.demandA}
        min={5}
        max={60}
        step={1}
        onChange={(v) => onChange({ ...value, demandA: v })}
      />
      <ParamControl
        label="Demand slope b"
        help="How quickly the price falls as quantity rises. A flatter curve means consumers are more price-sensitive."
        value={value.demandB}
        min={0.2}
        max={5}
        step={0.1}
        onChange={(v) => onChange({ ...value, demandB: v })}
      />
      <ParamControl
        label="Marginal cost c"
        help="The cost of producing one more unit, constant by assumption. Under competition price is driven down to this."
        value={value.mc}
        min={0}
        max={15}
        step={0.5}
        onChange={(v) => onChange({ ...value, mc: v })}
      />
      <ParamControl
        label="Fixed cost F"
        help="A cost that does not vary with output. Under competition it is a loss; for a monopolist it is what the operating profit has to cover."
        value={value.fixed}
        min={0}
        max={80}
        step={1}
        onChange={(v) => onChange({ ...value, fixed: v })}
      />
    </div>
  );
}

/** The externality dials: how big the harm is, and how much tax is in place. */
function ExternalityControls({
  value,
  onChange,
}: {
  value: ExternalityOptions;
  onChange: (v: ExternalityOptions) => void;
}) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-2">
      <ParamControl
        label="Marginal external cost"
        help="The harm each unit imposes on people outside the market. Set it to zero for a market with no externality, or negative for an external benefit that would call for a subsidy."
        value={value.external}
        min={-3}
        max={8}
        step={0.5}
        onChange={(v) => onChange({ ...value, external: v })}
      />
      <ParamControl
        label="Tax per unit t"
        help="The tax actually in place. Set it equal to the marginal external cost — the Pigouvian tax — and the distortion disappears entirely. Either side of that costs surplus."
        value={value.tax}
        min={0}
        max={10}
        step={0.5}
        onChange={(v) => onChange({ ...value, tax: v })}
      />
    </div>
  );
}

/** Which 2×2 game to play. The temptation dial only bites in the dilemma. */
function GameControls({ value, onChange }: { value: GameOptions; onChange: (v: GameOptions) => void }) {
  const options: { id: GameOptions["game"]; label: string }[] = [
    { id: "prisoners", label: "Prisoner's dilemma" },
    { id: "coordination", label: "Coordination" },
    { id: "chicken", label: "Chicken" },
    { id: "matching", label: "Matching pennies" },
  ];
  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1 font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Game</div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={value.game === o.id}
              onClick={() => onChange({ ...value, game: o.id })}
              className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-200 ${
                value.game === o.id
                  ? "border-accent bg-accent text-accentink accent-glow"
                  : "border-hairline text-muted hover:-translate-y-px hover:border-accent/50 hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {value.game === "prisoners" && (
        <div className="grid gap-x-4 sm:grid-cols-2">
          <ParamControl
            label="Temptation payoff T"
            help="What defecting pays against a cooperator. Above the cooperation payoff of 3 this is a dilemma: defecting dominates, so both end up with 1 each instead of 3."
            value={value.temptation}
            min={4}
            max={10}
            step={0.5}
            onChange={(v) => onChange({ ...value, temptation: v })}
          />
        </div>
      )}
    </div>
  );
}

/** Pick which parameter a comparative-statics table nudges, and which parameter/figure the sweep curve plots. */
function SweepControl({
  value,
  onChange,
  axis,
  onAxisChange,
  figure,
  onFigureChange,
  figures,
}: {
  value: SweepParam;
  onChange: (v: SweepParam) => void;
  axis: SweepParam;
  onAxisChange: (v: SweepParam) => void;
  figure: string;
  onFigureChange: (v: string) => void;
  figures: string[];
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="sweep-param" className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">
          Comparative statics
        </label>
        <select
          id="sweep-param"
          value={value}
          onChange={(e) => onChange(e.target.value as SweepParam)}
          className="max-w-[16rem] rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[0.6875rem] text-ink"
        >
          <option value="none">Off</option>
          {PARAM_GROUPS}
        </select>
        <InfoNote
          label="comparative statics"
          help="Re-runs this model twice, with the chosen parameter nudged 1% down and 1% up, and tabulates every figure the model reports against its base value. That is the classic 'G up ⇒ Y up, r up, I down' grid, read off real runs instead of hand-written."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="sweep-axis" className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">
          Sweep the curve
        </label>
        <select
          id="sweep-axis"
          value={axis}
          onChange={(e) => onAxisChange(e.target.value as SweepParam)}
          className="max-w-[16rem] rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[0.6875rem] text-ink"
        >
          <option value="none">Off</option>
          {PARAM_GROUPS}
        </select>
        <select
          id="sweep-figure"
          value={figure}
          disabled={axis === "none"}
          onChange={(e) => onFigureChange(e.target.value)}
          className="max-w-[16rem] rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[0.6875rem] text-ink disabled:opacity-40"
        >
          <option value="">First figure</option>
          {figures.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <InfoNote
          label="sweep the curve"
          help="Re-runs this model across the whole range of one parameter, holding everything else fixed, and plots a single figure against it. This is the 'which saving rate maximises steady-state consumption' question — a curve that turns has its high point marked, because that high point is the answer."
        />
      </div>
    </div>
  );
}

/** Compact time-window picker, shown above a time-path chart. */function HorizonControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">Time window</span>
      <div className="inline-flex overflow-hidden rounded-full border border-hairline">
        {HORIZON_PRESETS.map((h) => (
          <button
            key={h}
            type="button"
            aria-pressed={value === h}
            onClick={() => onChange(h)}
            className={`px-3 py-1 font-mono text-[0.6875rem] transition-colors ${
              value === h ? "bg-accent text-accentink" : "text-muted hover:bg-surface2 hover:text-ink"
            }`}
          >
            {h}
          </button>
        ))}
      </div>
      <span className="font-mono text-[0.6875rem] text-muted">periods</span>
      <InfoNote
        label="time window"
        help="How far forward the path is plotted, in periods. A short window keeps the early periods readable; a long one shows the full convergence to the steady state."
      />
    </div>
  );
}

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
  const [shocks, setShocks] = useState<ShockSpec[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [expert, setExpert] = useState(false);
  const [compare, setCompare] = useState<CompareMode>("current");
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON);
  const [ai, setAi] = useState<AiOptions>(DEFAULT_AI);
  const [expectations, setExpectations] = useState<Expectations>(DEFAULT_EXPECTATIONS);
  const [micro, setMicro] = useState<MicroOptions>(DEFAULT_MICRO);
  const [market, setMarket] = useState<MarketOptions>(DEFAULT_MARKET);
  const [externality, setExternality] = useState<ExternalityOptions>(DEFAULT_EXTERNALITY);
  const [game, setGame] = useState<GameOptions>(DEFAULT_GAME);
  const [zlb, setZlb] = useState<ZlbOptions>(DEFAULT_ZLB);
  const [sweep, setSweep] = useState<SweepParam>(DEFAULT_SWEEP);
  const [sweepAxis, setSweepAxis] = useState<SweepParam>(DEFAULT_SWEEP_AXIS);
  const [sweepFigure, setSweepFigure] = useState(DEFAULT_SWEEP_FIGURE);

  const options = useMemo(
    () => ({ horizon, ai, expectations, micro, market, externality, game, zlb, sweep, sweepAxis, sweepFigure }),
    [horizon, ai, expectations, micro, market, externality, game, zlb, sweep, sweepAxis, sweepFigure],
  );

  // A shared link carries the whole view. The server has no URL to read, so the
  // page renders its defaults first and the shared state is applied on the next
  // frame — everything below then re-runs against it.
  useEffect(() => {
    const shared = readState(window.location.search);
    if (!shared) return;
    const raf = requestAnimationFrame(() => {
      setEconomy(shared.economy);
      setBaseline(shared.economy);
      setShocks(shared.shocks);
      setModel(shared.model);
      setCompare(shared.compare);
      setHorizon(shared.horizon);
      setAi(shared.ai);
      setExpectations(shared.expectations);
      setMicro(shared.micro);
      setMarket(shared.market);
      setExternality(shared.externality);
      setGame(shared.game);
      setZlb(shared.zlb);
      setSweep(shared.sweep);
      setSweepAxis(shared.sweepAxis);
      setSweepFigure(shared.sweepFigure);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const update = (patch: Partial<Economy>) => setEconomy((e) => ({ ...e, ...patch }));
  const issues = useMemo(() => validateEconomy(economy), [economy]);

  const { economy: shockedEconomy, applied } = useMemo(() => resolveShocks(economy, shocks), [economy, shocks]);
  const hasShocks = shocks.length > 0;

  // Ease the economy so curves and figures morph instead of jumping.
  const tweened = useTweenedEconomy(shockedEconomy);

  // With shocks active the reference is the same economy without them; otherwise
  // it is the pinned baseline.
  const reference = hasShocks ? economy : baseline;
  const shownEconomy = compare === "baseline" ? reference : tweened;

  const modelPanels = useMemo(() => {
    if (model === "glossary") return [];
    try {
      const current = runModel(model, shownEconomy, options);
      return compare === "both" ? mergePanels(current, runModel(model, reference, options)) : current;
    } catch {
      return null;
    }
  }, [model, shownEconomy, reference, compare, options]);

  // The sweep panels interrogate the settled economy rather than the tweened one:
  // each re-runs the model many times, and once per animation frame would be waste.
  const sweepPanels = useMemo(() => {
    if (model === "glossary") return [];
    const extras: Panel[] = [];
    const directions = sweepPanel({
      modelId: model,
      modelLabel: getModel(model).label,
      economy: shockedEconomy,
      options,
      param: sweep,
      paramLabel: sweep === "none" ? undefined : PARAM_LABEL[sweep],
    });
    if (directions) extras.push(directions);
    const curve = sweepAxisPanel({
      modelId: model,
      modelLabel: getModel(model).label,
      economy: shockedEconomy,
      options,
      param: sweepAxis,
      paramLabel: sweepAxis === "none" ? undefined : PARAM_LABEL[sweepAxis],
      range: sweepAxis === "none" ? [0, 1] : (PARAM_RANGE[sweepAxis] ?? [0, 1]),
      figure: sweepFigure,
    });
    if (curve) extras.push(curve);
    return extras;
  }, [model, shockedEconomy, options, sweep, sweepAxis, sweepFigure]);

  const panels = useMemo(
    () => (modelPanels ? [...modelPanels, ...sweepPanels] : null),
    [modelPanels, sweepPanels],
  );

  /** Figures of the current model, for the sweep's figure picker. */
  const figureOptions = useMemo(
    () => [...new Set((modelPanels ?? []).flatMap((p) => (p.scalars ?? []).map((s) => s.label)))],
    [modelPanels],
  );

  const loadEconomy = (e: Economy) => {
    setEconomy(e);
    setBaseline(e);
    setShocks([]);
    setCompare("current");
  };

  const setShockList = (next: ShockSpec[]) => {
    setShocks(next);
    setCompare(next.length > 0 ? "both" : "current");
  };

  const togglePreset = (id: string) => {
    const on = shocks.some((s) => s.kind === "preset" && s.id === id);
    setShockList(on ? shocks.filter((s) => !(s.kind === "preset" && s.id === id)) : [...shocks, { kind: "preset", id }]);
  };

  const addCustom = (s: Omit<Extract<ShockSpec, { kind: "custom" }>, "id" | "kind">) => {
    setShockList([...shocks, { ...s, kind: "custom", id: `custom-${Date.now()}` }]);
  };

  const removeShock = (id: string) => setShockList(shocks.filter((s) => s.id !== id));
  const clearShocks = () => setShockList([]);

  // Scenario dials shown above the first panel of the models that have them.
  const scenarioControls =
    model === "ai-boom" ? (
      <AiControls value={ai} onChange={setAi} />
    ) : model === "phillips" ? (
      <ExpectationsControl value={expectations} onChange={setExpectations} />
    ) : model === "zlb" ? (
      <ZlbControls value={zlb} onChange={setZlb} />
    ) : model === "consumer-choice" ? (
      <MicroControls value={micro} onChange={setMicro} />
    ) : model === "market-structure" ? (
      <MarketControls value={market} onChange={setMarket} />
    ) : model === "externalities" ? (
      <div className="space-y-3">
        <ExternalityControls value={externality} onChange={setExternality} />
        <MarketControls value={market} onChange={setMarket} />
      </div>
    ) : model === "game-theory" ? (
      <GameControls value={game} onChange={setGame} />
    ) : undefined;

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
            <ShareLink
              build={() =>
                shareUrl(
                  { economy, model, compare, horizon, ai, expectations, micro, market, externality, game, zlb, sweep, sweepAxis, sweepFigure, shocks },
                  window.location.href,
                )
              }
            />            <div className="w-[13rem]">
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
              title="Back to the internally consistent baseline economy"
              className="rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent"
            >
              Reset
            </button>
            {panels && panels.length > 0 && (
              <ExportAllCsv panels={panels} name={`econosim-${getModel(model).label}-${economy.name}`} />
            )}
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
          {model !== "glossary" && (
            <ShockControls
              specs={shocks}
              applied={applied}
              onTogglePreset={togglePreset}
              onAddCustom={addCustom}
              onRemove={removeShock}
              onClear={clearShocks}
            />
          )}

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
            panels.map((p, i) => {
              const scenario = i === 0 ? scenarioControls : undefined;
              return (
                <PanelCard
                  key={p.id}
                  panel={p}
                  index={i}
                  exportName={`econosim-${getModel(model).label}-${economy.name}`}
                  chartControls={
                    scenario || i === 0 || p.timeseries ? (
                      <>
                        {scenario}
                        {i === 0 && (
                          <SweepControl
                            value={sweep}
                            onChange={setSweep}
                            axis={sweepAxis}
                            onAxisChange={setSweepAxis}
                            figure={sweepFigure}
                            onFigureChange={setSweepFigure}
                            figures={figureOptions}
                          />
                        )}
                        {p.timeseries && <HorizonControl value={horizon} onChange={setHorizon} />}
                      </>
                    ) : undefined
                  }
                />
              );
            })
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
