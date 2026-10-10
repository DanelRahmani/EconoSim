import { mul, sub, v } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";

/**
 * First-generation currency crisis (Krugman 1979, in its simplest form).
 *
 * The central bank pegs the exchange rate and holds foreign reserves R. The
 * government finances a deficit by borrowing from the central bank, so domestic
 * credit D grows at rate μ. To hold the peg the money supply must stay fixed,
 * which means reserves fall one-for-one with the growth of credit:
 *
 *   M = D + R = constant      ⟹      Rₜ = M − Dₜ
 *
 * When reserves run out the peg cannot be defended. The date follows from the
 * growth of credit alone:
 *
 *   T* = −ln(1 − R₀/M) / ln(1 + μ)
 *
 * and it does not depend on the level of the peg, only on how much of the money
 * supply is domestic credit and how fast that credit grows. That is the model's
 * sharpest lesson: a fixed exchange rate cannot survive indefinitely financing a
 * deficit, and the collapse is dated the moment the credit path is set.
 *
 * The shadow floating rate — the rate that would clear the money market with no
 * reserves left — reaches the peg at exactly T*. That is not a coincidence, it is
 * the arithmetic, and it happens here because real money demand is assumed
 * constant. With interest-sensitive money demand a speculative attack arrives
 * *before* reserves are exhausted (Obstfeld 1986) — a refinement this version
 * deliberately does not attempt.
 */

export interface CrisisCore {
  money: number;
  initialReserves: number;
  initialCredit: number;
  /** Periods until the peg cannot be held, or Infinity if it can. */
  crisisTime: number;
  /** Credit as a share of the money supply at the horizon end. */
  creditShareThen: number;
  path: { t: number; reserves: number; shadow: number }[];
  trace: CalcStep[];
}

export function crisisCore(e: Economy, horizon = 50): CrisisCore {
  const t = new Tracer();
  const M = e.M;
  const share = Math.min(0.99, Math.max(0.01, e.reservesShare));
  const mu = e.creditGrowth;
  const R0 = share * M;
  const D0 = M - R0;

  t.step("Initial reserves R₀", R0, mul(v("share"), v("M")), { share, M }, "Holdings of foreign currency");
  t.step(
    "Domestic credit D₀",
    D0,
    sub(v("M"), v("R0")),
    { M, R0 },
    "The part of the money supply created by lending to the government rather than by buying reserves",
  );

  const crisisTime =
    mu > 1e-9 && 1 - share > 1e-9 ? -Math.log(1 - share) / Math.log(1 + mu) : Infinity;
  // No collapse date is recorded when the peg survives: an infinite figure in
  // the working would be worse than no figure at all.
  if (Number.isFinite(crisisTime)) {
    t.step(
      "Collapse date T*",
      crisisTime,
      undefined,
      undefined,
      "Reserves run out exactly when credit has grown to fill the whole money supply — T* = −ln(1 − R₀/M)/ln(1 + μ), which the expression language cannot write, so it is stated rather than typeset",
    );
  }

  const periods = Math.max(5, Math.min(400, Math.round(horizon)));
  const path: CrisisCore["path"] = [];
  for (let i = 0; i <= periods; i++) {
    const credit = D0 * Math.pow(1 + mu, i);
    path.push({
      t: i,
      reserves: ((M - credit) / M) * 100,
      // Shadow rate as a percentage of the peg: it reaches 100 exactly at T*.
      shadow: (credit / M) * 100,
    });
  }

  return {
    money: M,
    initialReserves: R0,
    initialCredit: D0,
    crisisTime,
    creditShareThen: (D0 * Math.pow(1 + mu, periods)) / M,
    path,
    trace: t.steps,
  };
}

export function currencyCrisis(e: Economy, horizon = 50): Panel[] {
  const core = crisisCore(e, horizon);
  const share = Math.min(0.99, Math.max(0.01, e.reservesShare));
  const mu = e.creditGrowth;
  const fixed = e.regime === "fixed";

  const muRange = linspace(0.001, Math.max(0.3, mu * 3), 80);
  const crisisAt = (m: number) => -Math.log(1 - share) / Math.log(1 + m);

  return [
    {
      id: "crisis-reserves",
      title: `Reserves against the shadow rate — next ${horizon} periods`,
      description:
        "Reserves fall as domestic credit grows, and the exchange rate the market would set without them rises towards the peg. Both are measured against the peg's own scale: reserves as a share of the money supply, the shadow rate as a percentage of the peg. They meet at the collapse date.",
      timeseries: {
        xLabel: "Time",
        yLabel: "Percent of the peg / of the money supply",
        series: [
          { label: "Reserves", points: core.path.map((p) => ({ x: p.t, y: p.reserves })) },
          { label: "Shadow floating rate", points: core.path.map((p) => ({ x: p.t, y: p.shadow })) },
          { label: "The peg (100)", points: core.path.map((p) => ({ x: p.t, y: 100 })), dashed: true },
        ],
      },
      scalars: [
        { label: "Money supply M", value: core.money },
        { label: "Initial reserves R₀", value: core.initialReserves },
        { label: "Initial domestic credit D₀", value: core.initialCredit },
        {
          label: "Collapse date T*",
          value: core.crisisTime,
          unit: "periods",
          hint: "−ln(1 − R₀/M) / ln(1 + μ)",
        },
        {
          label: "Domestic credit by the horizon end (share of M)",
          value: core.creditShareThen,
          hint: "Above 1 the peg is long gone",
        },
        { label: "Credit growth μ", value: mu },
      ],
      notes: [
        Number.isFinite(core.crisisTime)
          ? `The peg holds for ${core.crisisTime.toFixed(1)} periods. Only two numbers decide that: how much of the money supply is domestic credit (${((1 - share) * 100).toFixed(0)}%) and how fast that credit grows (${(mu * 100).toFixed(1)}% a period). The level of the peg itself does not enter.`
          : "Domestic credit is not growing, so reserves never run out and the peg survives indefinitely. Raise μ to start the clock.",
        "This is a speculative attack in the first-generation sense: it is not caused by pessimism or a self-fulfilling panic. The collapse date is set by arithmetic the moment the deficit is financed by the central bank, and the market simply brings the end forward to that date.",
        fixed
          ? "The regime is set to Fixed, so this is the case the model is about."
          : "The regime is currently Floating, so there is no peg here to defend. Switch the exchange rate to Fixed to make this the model's case.",
        "The honest caveat: with constant real money demand the attack lands exactly when reserves reach zero. Allow money demand to depend on the interest rate and the peg breaks slightly *before* exhaustion — Obstfeld's refinement, which this version deliberately does not model.",
      ],
      trace: core.trace,
    },
    {
      id: "crisis-timing",
      title: "How long the peg survives",
      description:
        "The collapse date against the rate at which domestic credit grows. The relationship is violently non-linear: at low credit growth the peg lasts a long time, and it collapses quickly as the deficit is financed faster and faster.",
      chart: {
        xLabel: "Credit growth μ (% per period)",
        yLabel: "Collapse date T* (periods)",
        series: [
          {
            label: "Collapse date",
            points: muRange.map((m) => ({ x: m * 100, y: Math.min(crisisAt(m), 200) })),
          },
        ],
        markers: Number.isFinite(core.crisisTime)
          ? [{ x: mu * 100, y: core.crisisTime, label: "you" }]
          : [],
      },
      scalars: [
        {
          label: "Reserves lost per period",
          value: core.initialCredit * mu,
          hint: "D₀·μ — the drain that has to be financed from reserves",
        },
        {
          label: "Collapse date if credit grew twice as fast",
          value: crisisAt(mu * 2),
          unit: "periods",
        },
        {
          label: "Collapse date at 1% credit growth",
          value: crisisAt(0.01),
          unit: "periods",
          hint: "Slow credit growth postpones the collapse a long way",
        },
      ],
      notes: [
        "The curve is drawn capped at 200 periods so the interesting region stays visible. Low credit growth does not merely delay the collapse, it postpones it by a lot — which is the whole argument for financing a deficit with debt rather than seigniorage.",
        "The policy conclusions fall straight out: stop the domestic credit growth, or abandon the peg deliberately and devalue before the market does it for you.",
      ],
      trace: [],
    },
  ];
}
