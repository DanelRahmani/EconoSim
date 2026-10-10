import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer } from "../trace";
import { mfCore } from "./mundellFleming";
import { islmCore } from "./islm";

export function nationalSaving(e: Economy, Y: number): number {
  const C = e.c0 + e.c1 * (Y - e.T);
  return Y - C - e.G;
}

export function investment(e: Economy, r: number): number {
  return e.I0 - e.b * r;
}

/** Current account = national saving − investment. */
export function currentAccount(e: Economy, Y: number, r: number): number {
  return nationalSaving(e, Y) - investment(e, r);
}

/** Debt dynamics: Δd = (r − g)·d − primary balance. */
export function debtNext(d: number, r: number, g: number, primaryBalance: number): number {
  return d + (r - g) * d - primaryBalance;
}

/** Debt ratio the economy converges to (only if r > g). */
export function debtSteadyState(r: number, g: number, primaryBalance: number): number {
  return r > g ? primaryBalance / (r - g) : Infinity;
}

export function externalBalance(e: Economy, horizon = 60): Panel[] {
  const t = new Tracer();
  const periods = Math.max(10, Math.min(300, Math.round(horizon)));
  const core = e.openness === "open" ? mfCore(e) : { Y: islmCore(e).Y, r: islmCore(e).r };
  const Y = core.Y;
  const r = core.r;

  const S = t.step("National saving S = Y − C − G", nationalSaving(e, Y));
  const I = t.step("Investment I = I0 − b·r", investment(e, r));
  const CA = t.step("Current account CA = S − I", S - I, undefined, undefined, "Also equals net lending abroad");
  t.step("Balance of payments identity", CA + -CA, undefined, undefined, "CA + capital inflow = 0 (ignoring reserves)");

  // Debt path toward the steady state.
  const g = e.g + e.n;
  const pb = 0.01;
  const d0 = 0.6;
  const dStar = debtSteadyState(r, g, pb);
  const hasDebtSteadyState = Number.isFinite(dStar);
  const debt: { t: number; d: number }[] = [];
  let d = d0;
  for (let i = 0; i <= periods; i++) {
    debt.push({ t: i, d });
    d = debtNext(d, r, g, pb);
    if (!Number.isFinite(d)) break;
  }

  // Net foreign asset position from cumulated current accounts.
  const nfa: { t: number; v: number }[] = [];
  let v = 0;
  for (let i = 0; i <= periods; i++) {
    nfa.push({ t: i, v });
    v += CA;
  }

  const debtSeries = [
    { label: "Net foreign assets", points: nfa.map((p) => ({ x: p.t, y: p.v })) },
    { label: "Debt ratio d", points: debt.map((p) => ({ x: p.t, y: p.d })) },
  ];
  // Only draw the (finite) steady-state line when r > g.
  if (hasDebtSteadyState) {
    debtSeries.push({ label: "Steady-state debt d*", points: debt.map((p) => ({ x: p.t, y: dStar })) });
  }

  return [
    {
      id: "external-balance",
      title: `External balance — next ${periods} periods`,
      description:
        "The current account is the gap between national saving and investment. Persistent surpluses build foreign assets; deficits build debt.",
      timeseries: {
        xLabel: "Time",
        yLabel: "Value",
        series: debtSeries,
      },
      scalars: [
        { label: "Output (Y)", value: Y },
        { label: "National saving (S)", value: S },
        { label: "Investment (I)", value: I },
        { label: "Current account (CA)", value: CA },
        ...(hasDebtSteadyState
          ? [{ label: "Debt steady state d*", value: dStar, hint: "pb/(r−g)" }]
          : [{ label: "r − g", value: r - g, hint: "r ≤ g: no finite debt steady state" }]),
      ],
      notes: [
        hasDebtSteadyState
          ? "With r > g, debt converges to pb/(r−g); a primary surplus is needed to stabilise a positive debt ratio."
          : "With r ≤ g there is no finite debt steady state — growth keeps pace with or outruns the interest burden.",
      ],
      trace: t.steps,
    },
  ];
}
