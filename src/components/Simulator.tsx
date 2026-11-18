"use client";

import Link from "next/link";
import { Wordmark } from "@/components/ui/Wordmark";
import { useEffect, useMemo, useState } from "react";
import type {
  AiOptions,
  Economy,
  ExternalityOptions,
  Expectations,
  GameOptions,
  MarketOptions,
  MicroOptions,
  SweepParam,
  ZlbOptions,
} from "@/lib/econ/types";
import { validateEconomy } from "@/lib/econ/types";
import { defaultEconomy, withDefaults } from "@/lib/econ/defaults";
import { COUNTRIES } from "@/lib/econ/countries";
import { GROUP_ORDER, PARAMS, PARAM_BY_KEY, orderedParams } from "@/lib/econ/params";
import { DEFAULT_AI, DEFAULT_EXTERNALITY, DEFAULT_EXPECTATIONS, DEFAULT_GAME, DEFAULT_HORIZON, DEFAULT_MARKET, DEFAULT_MICRO, DEFAULT_MODEL, DEFAULT_SWEEP, DEFAULT_SWEEP_AXIS, DEFAULT_SWEEP_FIGURE, DEFAULT_ZLB, HORIZON_PRESETS, MODELS, MODEL_GROUPS, getModel, modelInputs, runModel } from "@/lib/econ/registry";
import { readState, shareUrl, type CompareMode } from "@/lib/econ/permalink";
import { CUSTOM_FIELDS, relevantShocks, resolveShocks, type ShockSpec } from "@/lib/econ/shocks";
import { CHANGE_TAGS, SHOCK_TAGS, mergePanels } from "@/lib/econ/compare";
import { sweepAxisPanel, sweepPanel } from "@/lib/econ/comparativeStatics";
import type { Panel } from "@/lib/econ/panel";
import { useTweenedEconomy } from "@/hooks/useTweenedEconomy";
import { PanelCard, SolidHyphens } from "./PanelCard";
import { ParamControl, Segmented } from "./ParamControl";
import { ParametersPanel } from "./ParametersPanel";
import { ShareLink } from "./ShareLink";
import { ExportAllCsv } from "./Export";
import { ShockControls } from "./ShockControls";
import { GlossaryPanel } from "./GlossaryPanel";
import { PresetManager } from "./PresetManager";
import { ThemeToggle } from "./theme/ThemeToggle";
import { InfoNote } from "./ui/InfoNote";

/** Parameter labels by key, for prose outside the sidebar. */
const PARAM_LABEL = (key: keyof Economy) => PARAM_BY_KEY[key]?.label;

/** The slider range of each parameter, so a sweep can cover what the UI can reach. */
const PARAM_RANGE = (key: keyof Economy): [number, number] => {
  const p = PARAM_BY_KEY[key];
  return p ? [p.min, p.max] : [0, 1];
};

/** One model's parameters as grouped `<option>`s, for both sweep pickers. */
function paramOptions(uses: (keyof Economy)[]) {
  return GROUP_ORDER.map((g) => {
    const defs = PARAMS.filter((p) => p.group === g && uses.includes(p.key));
    if (!defs.length) return null;
    return (
      <optgroup key={g} label={g}>
        {defs.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label}
          </option>
        ))}
      </optgroup>
    );
  });
}

/** Scenario controls for the AI boom model. */
function AiControls({ value, onChange }: { value: AiOptions; onChange: (v: AiOptions) => void }) {
  return (
    <div className="grid gap-x-4 sm:grid-cols-3">
      <ParamControl
        label="Labour replaced by AI (%)"
        help="The share of labour tasks AI performs. Displaced workers are not re-employed. The work moves to capital."
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
        help="How hard demand is hit, as a share of potential output. Increase it until the natural rate of interest goes negative. That is when the zero bound starts to bind."
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
        help="The tax actually in place. Set it equal to the marginal external cost (the Pigouvian tax) and the distortion disappears entirely. Either side of that costs surplus."
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
        <div className="mb-1 font-mono text-[0.75rem]  text-muted">Game</div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={value.game === o.id}
              onClick={() => onChange({ ...value, game: o.id })}
              className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-200 ${
                value.game === o.id
                  ? "border-accent bg-accent text-accentink"
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
  params,
}: {
  /** The current model's parameters, as grouped options. */
  params: React.ReactNode;
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
        <label htmlFor="sweep-param" className="font-mono text-[0.75rem]  text-muted">
          Comparative statics
        </label>
        <select
          id="sweep-param"
          value={value}
          onChange={(e) => onChange(e.target.value as SweepParam)}
          className="max-w-[16rem] rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[0.6875rem] text-ink"
        >
          <option value="none">Off</option>
          {params}
        </select>
        <InfoNote
          label="comparative statics"
          help="Re-runs this model twice, with the chosen parameter nudged 1% down and 1% up, and tabulates every figure the model reports against its base value. That is the classic 'G up ⇒ Y up, r up, I down' grid, read off real runs instead of hand-written."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="sweep-axis" className="font-mono text-[0.75rem]  text-muted">
          Sweep the curve
        </label>
        <select
          id="sweep-axis"
          value={axis}
          onChange={(e) => onAxisChange(e.target.value as SweepParam)}
          className="max-w-[16rem] rounded-md border border-hairline bg-surface px-2 py-1 font-mono text-[0.6875rem] text-ink"
        >
          <option value="none">Off</option>
          {params}
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
          help="Re-runs this model across the whole range of one parameter, holding everything else fixed, and plots a single figure against it. This is the 'which saving rate maximises steady-state consumption' question. A curve that turns has its high point marked, because that high point is the answer."
        />
      </div>
    </div>
  );
}

/** Compact time-window picker, shown above a time-path chart. */function HorizonControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-[0.75rem]  text-muted">Time window</span>
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

export function Simulator() {
  const [economy, setEconomy] = useState<Economy>(() => defaultEconomy());
  const [baseline, setBaseline] = useState<Economy>(() => defaultEconomy());
  const [shocks, setShocks] = useState<ShockSpec[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [showMore, setShowMore] = useState(false);
  // On a phone the parameters live in a sheet over the bottom of the screen.
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<"params" | "shocks" | "analysis">("params");
  const [compare, setCompare] = useState<CompareMode>("current");
  // Once the reader picks a comparison view themselves, stop choosing it for them.
  const [compareTouched, setCompareTouched] = useState(false);
  const chooseCompare = (mode: CompareMode) => {
    setCompare(mode);
    setCompareTouched(true);
  };
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

  // The first change a reader makes switches the comparison on, so the old curves
  // stay on screen dashed and every figure shows how far it moved.
  const update = (patch: Partial<Economy>) => {
    setEconomy((e) => ({ ...e, ...patch }));
    if (!compareTouched && compare === "current") setCompare("both");
  };

  const inputs = modelInputs(model);
  const sliders = orderedParams(inputs.key, inputs.uses);
  const shockPresets = useMemo(() => relevantShocks(inputs.uses, economy), [inputs.uses, economy]);
  const shockFields = useMemo(() => CUSTOM_FIELDS.filter((f) => inputs.uses.includes(f.key)), [inputs.uses]);

  /** Switch model, dropping analysis picks the new model does not read (they would only draw flat lines). */
  const selectModel = (id: string) => {
    const uses = modelInputs(id).uses;
    setModel(id);
    if (sweep !== "none" && !uses.includes(sweep)) setSweep("none");
    if (sweepAxis !== "none" && !uses.includes(sweepAxis)) {
      setSweepAxis("none");
      setSweepFigure("");
    }
  };
  const issues = useMemo(() => validateEconomy(economy), [economy]);

  const { economy: shockedEconomy, applied } = useMemo(() => resolveShocks(economy, shocks), [economy, shocks]);
  // A shock this model does not read changes nothing here, so it should not take
  // over the comparison: with only those active, slider changes are compared
  // against the baseline as usual.
  const hasShocks = useMemo(
    () =>
      shocks.some((spec) =>
        spec.kind === "preset"
          ? shockPresets.some((p) => p.id === spec.id)
          : inputs.uses.includes(spec.key),
      ),
    [shocks, shockPresets, inputs.uses],
  );

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
      return compare === "both"
        ? mergePanels(current, runModel(model, reference, options), hasShocks ? SHOCK_TAGS : CHANGE_TAGS)
        : current;
    } catch {
      return null;
    }
  }, [model, shownEconomy, reference, compare, options, hasShocks]);

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
      paramLabel: sweep === "none" ? undefined : PARAM_LABEL(sweep),
    });
    if (directions) extras.push(directions);
    const curve = sweepAxisPanel({
      modelId: model,
      modelLabel: getModel(model).label,
      economy: shockedEconomy,
      options,
      param: sweepAxis,
      paramLabel: sweepAxis === "none" ? undefined : PARAM_LABEL(sweepAxis),
      range: sweepAxis === "none" ? [0, 1] : PARAM_RANGE(sweepAxis),
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
    setCompareTouched(false);
  };

  const pinBaseline = () => {
    setBaseline({ ...economy });
    setShocks([]);
    setCompare("both");
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

  const modelLabel = model === "glossary" ? "Glossary" : getModel(model).label;
  const exportStem = `econosim-${modelLabel}-${economy.name}`;
  const analysisOpen = sweep !== "none" || sweepAxis !== "none";

  const modelButton = (id: string, label: string, title: string) => {
    const active = model === id;
    return (
      <button
        key={id}
        type="button"
        title={title}
        aria-current={active ? "page" : undefined}
        onClick={() => selectModel(id)}
        className={`relative w-full rounded-md py-1.5 pl-3 pr-2 text-left text-xs transition-all duration-200 ${
          active ? "bg-accent/10 font-medium text-accent" : "text-muted hover:bg-surface2 hover:text-ink"
        }`}
      >
        <span
          aria-hidden
          className={`absolute left-0 top-1/2 w-0.5 -translate-y-1/2 rounded-full bg-accent transition-all duration-300 ${
            active ? "h-4 opacity-100" : "h-0 opacity-0"
          }`}
        />
        {label}
      </button>
    );
  };

  const economyPresets = (
    <details className="card reveal group p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[0.75rem] text-muted marker:content-none hover:text-ink">
        <span>Economy presets</span>
        <span aria-hidden className="transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="mt-3">
        <h2 className="mb-2.5 font-mono text-[0.75rem] text-muted">Countries</h2>
        <div className="flex flex-wrap gap-1.5">
          {COUNTRIES.map((c) => {
            const active = economy.name === c.name;
            return (
              <button
                key={c.id}
                type="button"
                title={`${c.note}. Source: ${c.source}`}
                onClick={() => loadEconomy(withDefaults({ ...c.params, name: c.name }))}
                className={`rounded-full border px-2.5 py-1 text-xs transition-all duration-200 ${
                  active
                    ? "border-accent bg-accent text-accentink"
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
        <div className="mt-4 border-t border-hairline pt-3">
          <PresetManager current={economy} onLoad={loadEconomy} bare />
        </div>
      </div>
    </details>
  );

  const hasShockTab = model !== "glossary" && (shockPresets.length > 0 || shocks.length > 0);
  const hasAnalysisTab = model !== "glossary" && inputs.uses.length > 0;
  const activeTab = (tab === "shocks" && !hasShockTab) || (tab === "analysis" && !hasAnalysisTab) ? "params" : tab;
  const tabs: { id: typeof tab; label: string; badge?: string; show: boolean }[] = [
    { id: "params", label: "Parameters", show: true },
    { id: "shocks", label: "Shocks", badge: shocks.length ? String(shocks.length) : undefined, show: hasShockTab },
    { id: "analysis", label: "Analysis", badge: analysisOpen ? "on" : undefined, show: hasAnalysisTab },
  ];

  /** Everything that changes the economy, in one sidebar: parameters, shocks, analysis. */
  const controlTabs = (
    <div>
      <div role="tablist" aria-label="Controls" className="mb-3 flex gap-1 rounded-full border border-hairline bg-surface2 p-0.5">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 rounded-full px-2 py-1 text-[0.75rem] transition-colors ${
                activeTab === t.id ? "bg-accent text-accentink" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.badge && <span className="ml-1 font-mono text-[0.6875rem]">· {t.badge}</span>}
            </button>
          ))}
      </div>

      {activeTab === "params" && (
        <ParametersPanel
          economy={economy}
          update={update}
          inputs={inputs}
          sliders={sliders}
          showMore={showMore}
          onShowMore={setShowMore}
          modelLabel={modelLabel}
        />
      )}
      {activeTab === "shocks" && (
        <ShockControls
          presets={shockPresets}
          fields={shockFields}
          specs={shocks}
          applied={applied}
          onTogglePreset={togglePreset}
          onAddCustom={addCustom}
          onRemove={removeShock}
          onClear={clearShocks}
          bare
        />
      )}
      {activeTab === "analysis" && (
        <div>
          <SweepControl
            value={sweep}
            onChange={setSweep}
            axis={sweepAxis}
            onAxisChange={setSweepAxis}
            figure={sweepFigure}
            onFigureChange={setSweepFigure}
            figures={figureOptions}
            params={paramOptions(inputs.uses)}
          />
          <p className="mt-3 text-[0.6875rem] leading-relaxed text-muted">
            {analysisOpen ? "Results appear below the model's charts." : "Pick a parameter to see its effect on every figure."}
          </p>
        </div>
      )}
    </div>
  );

  const HEADER_BUTTON =
    "rounded-full border border-hairline bg-surface px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent/50 hover:text-accent";

  return (
    <div className="relative min-h-screen">
      <header className="sticky top-0 z-30 border-b border-hairline bg-bg/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1520px] items-center justify-between gap-3 px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" aria-label="EconoSim home" className="shrink-0">
              <Wordmark size="sm" />
            </Link>
            <div className="hidden min-w-0 leading-tight sm:block">
              <div className="truncate text-sm font-medium text-ink">
                <SolidHyphens text={modelLabel} />
              </div>
              <div className="truncate font-mono text-[0.6875rem] text-muted">
                {economy.name}
                {hasShocks && <span className="text-accent"> · {shocks.length} shock{shocks.length > 1 ? "s" : ""}</span>}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            {model !== "glossary" && (
              <button
                type="button"
                aria-pressed={compare === "both"}
                onClick={() => chooseCompare(compare === "both" ? "current" : "both")}
                title={
                  hasShocks
                    ? "Show the same economy without the shocks as dashed lines, with the change on every figure"
                    : "Show the baseline as dashed lines, with the change on every figure"
                }
                className={`${HEADER_BUTTON} ${compare === "both" ? "!border-accent !bg-accent !text-accentink" : ""}`}
              >
                Compare
              </button>
            )}
            <ShareLink
              build={() =>
                shareUrl(
                  { economy, model, compare, horizon, ai, expectations, micro, market, externality, game, zlb, sweep, sweepAxis, sweepFigure, shocks },
                  window.location.href,
                )
              }
            />
            <button
              type="button"
              onClick={() => loadEconomy(defaultEconomy())}
              title="Back to the baseline economy, with no shocks"
              className={HEADER_BUTTON}
            >
              Reset
            </button>
            <details className="relative">
              <summary
                aria-label="More actions"
                className={`${HEADER_BUTTON} cursor-pointer list-none px-2.5 marker:content-none`}
              >
                ⋯
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 w-60 space-y-1 rounded-xl border border-hairline bg-surface p-2 shadow-lg">
                <button
                  type="button"
                  onClick={pinBaseline}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-ink hover:bg-surface2"
                >
                  Pin current economy as baseline
                  <span className="block text-[0.6875rem] text-muted">Later changes are compared against this.</span>
                </button>
                {panels && panels.length > 0 && (
                  <ExportAllCsv panels={panels} name={exportStem} variant="menu" />
                )}
                <div className="flex items-center justify-between px-2.5 py-1 text-xs text-muted">
                  <span>Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            </details>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto grid max-w-[1520px] gap-4 p-4 pb-24 lg:grid-cols-[220px_minmax(0,1fr)_300px] lg:pb-4">
        <aside className="hidden space-y-4 lg:sticky lg:top-16 lg:block lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <nav aria-label="Models" className="card reveal p-4">
            <h2 className="mb-2.5 font-mono text-[0.75rem] text-muted">Models</h2>
            {MODEL_GROUPS.map((g) => (
              <div key={g} className="mb-3 last:mb-0">
                <div className="mb-1 font-mono text-[0.6875rem] text-muted/70">{g}</div>
                <div className="flex flex-col gap-0.5">
                  {MODELS.filter((m) => m.group === g).map((m) => modelButton(m.id, m.label, m.blurb))}
                </div>
              </div>
            ))}
            <div className="mt-1 border-t border-hairline pt-3">
              <div className="mb-1 font-mono text-[0.6875rem] text-muted/70">Reference</div>
              {modelButton("glossary", "Glossary", "What every symbol and switch means")}
            </div>
          </nav>

          {inputs.uses.length > 0 && economyPresets}
        </aside>

        <main key={model} className="min-w-0 space-y-4">
          <div className="lg:hidden">
            <label htmlFor="model-picker" className="mb-1 block font-mono text-[0.6875rem] text-muted">
              Model
            </label>
            <select
              id="model-picker"
              value={model}
              onChange={(e) => selectModel(e.target.value)}
              className="w-full rounded-xl border border-hairline bg-surface px-3 py-2.5 text-sm font-medium text-ink focus:border-accent focus:outline-none"
            >
              {MODEL_GROUPS.map((g) => (
                <optgroup key={g} label={g}>
                  {MODELS.filter((m) => m.group === g).map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Reference">
                <option value="glossary">Glossary</option>
              </optgroup>
            </select>
          </div>

          {model !== "glossary" && (
            <p className="px-1 text-sm leading-relaxed text-muted">{getModel(model).blurb}</p>
          )}

          {compare !== "current" && model !== "glossary" && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2 text-xs text-muted">
              {compare === "baseline" ? (
                <span>Showing the baseline only.</span>
              ) : (
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="font-medium text-ink">{hasShocks ? "With vs without the shocks" : "Now vs baseline"}</span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="22" height="6" aria-hidden>
                      <line x1="1" y1="3" x2="21" y2="3" stroke="var(--accent)" strokeWidth="2.25" />
                    </svg>
                    {hasShocks ? "(shock)" : "(new)"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="22" height="6" aria-hidden>
                      <line x1="1" y1="3" x2="21" y2="3" stroke="var(--accent)" strokeWidth="1.75" strokeDasharray="5 5" opacity="0.55" />
                    </svg>
                    (base)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="10" height="10" aria-hidden>
                      <circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--muted)" strokeWidth="1.5" />
                    </svg>
                    where it was
                  </span>
                  <span>▲▼ on every figure</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => chooseCompare("current")}
                className="shrink-0 rounded-full border border-hairline px-2.5 py-0.5 transition-colors hover:border-accent/50 hover:text-accent"
              >
                Hide comparison
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
          ) : modelPanels && modelPanels.length > 0 ? (
            modelPanels.map((p, i) => {
              const scenario = i === 0 ? scenarioControls : undefined;
              return (
                <PanelCard
                  key={p.id}
                  panel={p}
                  index={i}
                  exportName={exportStem}
                  chartControls={
                    scenario || p.timeseries ? (
                      <div className="space-y-3">
                        {scenario}
                        {p.timeseries && <HorizonControl value={horizon} onChange={setHorizon} />}
                      </div>
                    ) : undefined
                  }
                />
              );
            })
          ) : (
            <div className="card border-accent/40 bg-tint px-4 py-3 text-sm text-ink">
              This model could not be computed with the current parameters. Adjust the sliders to bring the economy
              back into range.
            </div>
          )}

          {model !== "glossary" && sweepPanels.length > 0 && (
            <section className="space-y-4">
              <h2 className="px-1 font-mono text-[0.75rem] text-muted">Analysis</h2>
              {sweepPanels.map((p, i) => (
                <PanelCard key={p.id} panel={p} index={i} exportName={exportStem} />
              ))}
            </section>
          )}
        </main>

        <aside className="hidden lg:sticky lg:top-16 lg:block lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto">
          <div className="card reveal p-3">{controlTabs}</div>
        </aside>
      </div>

      {/* Phone: the controls in a sheet, so a slider and its chart share the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-bg/95 backdrop-blur-xl lg:hidden">
        {sheetOpen && (
          <div id="parameter-sheet" className="max-h-[55vh] overflow-y-auto px-4 pb-2 pt-3">
            {controlTabs}
            {activeTab === "params" && inputs.uses.length > 0 && <div className="mt-3">{economyPresets}</div>}
          </div>
        )}
        <button
          type="button"
          aria-expanded={sheetOpen}
          aria-controls="parameter-sheet"
          onClick={() => setSheetOpen(!sheetOpen)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-ink"
        >
          <span>
            {sheetOpen ? "Hide controls" : "Controls"}
            {!sheetOpen && sliders.key.length > 0 && (
              <span className="ml-2 font-mono text-[0.6875rem] text-muted">
                {sliders.key.map((p) => p.label.split(" ").pop()).join(" · ")}
                {shocks.length > 0 && ` · ${shocks.length} shock${shocks.length > 1 ? "s" : ""}`}
              </span>
            )}
          </span>
          <span aria-hidden className={`text-muted transition-transform ${sheetOpen ? "rotate-180" : ""}`}>
            ▴
          </span>
        </button>
      </div>
    </div>
  );
}