"use client";

import type { CountrySize, Economy, ExchangeRegime, Openness } from "@/lib/econ/types";
import type { ModelInputs } from "@/lib/econ/registry";
import { GROUP_ORDER, type ParamDef } from "@/lib/econ/params";
import { ParamControl, Segmented } from "./ParamControl";

function Slider({ p, economy, update }: { p: ParamDef; economy: Economy; update: (patch: Partial<Economy>) => void }) {
  return (
    <ParamControl
      label={p.label}
      help={p.help}
      value={economy[p.key] as number}
      min={p.min}
      max={p.max}
      step={p.step}
      onChange={(v) => update({ [p.key]: v } as Partial<Economy>)}
    />
  );
}

/**
 * The sliders for the current model, and only those. A model's key dials come
 * first; everything else it reads sits behind "More parameters"; anything it
 * does not read is not shown at all, because a slider that moves nothing teaches
 * the wrong lesson.
 */
export function ParametersPanel({
  economy,
  update,
  inputs,
  sliders,
  showMore,
  onShowMore,
  modelLabel,
}: {
  economy: Economy;
  update: (patch: Partial<Economy>) => void;
  inputs: ModelInputs;
  sliders: { key: ParamDef[]; more: ParamDef[] };
  showMore: boolean;
  onShowMore: (v: boolean) => void;
  modelLabel: string;
}) {
  const has = (s: ModelInputs["structure"][number]) => inputs.structure.includes(s);

  if (!inputs.uses.length && !inputs.structure.length) {
    return (
      <p className="text-xs leading-relaxed text-muted">
        {modelLabel} does not use the economy&apos;s parameters. Its own dials sit above the chart.
      </p>
    );
  }

  return (
    <div>
      {has("openness") && (
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
      )}
      {has("size") && (
        <Segmented<CountrySize>
          label="Country size"
          help="Small: perfect capital mobility, so the country takes the world interest rate as given and its own policy does not move world rates. Large: its borrowing does move the world rate, so the BP curve slopes and policy spills over."
          value={economy.size}
          options={[
            { value: "small", label: "Small" },
            { value: "large", label: "Large" },
          ]}
          onChange={(v) => update({ size: v })}
        />
      )}
      {has("regime") && (
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
      )}

      {sliders.key.length > 0 && (
        <div className={inputs.structure.length ? "mt-2 border-t border-hairline pt-2" : ""}>
          {sliders.key.map((p) => (
            <Slider key={p.key} p={p} economy={economy} update={update} />
          ))}
        </div>
      )}

      {sliders.more.length > 0 && (
        <div className="mt-2 border-t border-hairline pt-2">
          <button
            type="button"
            aria-expanded={showMore}
            onClick={() => onShowMore(!showMore)}
            className="flex w-full items-center justify-between py-1 text-left text-[0.75rem] text-muted transition-colors hover:text-ink"
          >
            <span>
              {showMore ? "Fewer parameters" : `More parameters (${sliders.more.length})`}
            </span>
            <span aria-hidden className={`transition-transform duration-200 ${showMore ? "rotate-180" : ""}`}>
              ▾
            </span>
          </button>
          {showMore && (
            <div className="tab-in">
              {GROUP_ORDER.map((g) => {
                const defs = sliders.more.filter((p) => p.group === g);
                if (!defs.length) return null;
                return (
                  <div key={g} className="mt-2">
                    <div className="font-mono text-[0.6875rem] text-muted/70">{g}</div>
                    {defs.map((p) => (
                      <Slider key={p.key} p={p} economy={economy} update={update} />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
