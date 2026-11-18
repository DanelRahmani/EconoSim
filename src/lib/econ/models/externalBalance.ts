import { add, div, mul, num, sub, v } from "../expr";
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

/**
 * Government debt ratio, one period on: b' = b + (r − g)·b − pb.
 * The linear approximation of b' = b·(1 + r)/(1 + g) − pb, accurate while r and g are small.
 */
export function debtNext(d: number, r: number, g: number, primaryBalance: number): number {
  return d + (r - g) * d - primaryBalance;
}

/** The debt ratio at which pb exactly covers (r − g)·b (only a positive number when r > g). */
export function debtSteadyState(r: number, g: number, primaryBalance: number): number {
  return r > g ? primaryBalance / (r - g) : Infinity;
}

/**
 * Net foreign assets as a share of output, one period on:
 *   a' = a·(1 + r)/(1 + g) + tb
 * Last period's assets earn the world interest rate r, output grows at g, and
 * the trade balance tb = NX/Y adds to (or draws on) the stock. The current
 * account is tb plus the interest income r·a.
 */
export function nfaNext(a: number, r: number, g: number, tb: number): number {
  return (a * (1 + r)) / (1 + g) + tb;
}

export function externalBalance(e: Economy, horizon = 60): Panel[] {
  const t = new Tracer();
  const periods = Math.max(10, Math.min(300, Math.round(horizon)));
  const open = e.openness === "open";
  const mf = open ? mfCore(e) : null;
  const base = islmCore(e);
  const Y = mf ? mf.Y : base.Y;
  const r = mf ? mf.r : base.r;
  const NX = mf ? mf.NX : 0;

  const S = t.step(
    "National saving S = Y − C − G",
    nationalSaving(e, Y),
    sub(sub(v("Y"), add(v("c0"), mul(v("c1"), sub(v("Y"), v("T"))))), v("G")),
    { Y, c0: e.c0, c1: e.c1, T: e.T, G: e.G },
  );
  const I = t.step("Investment I = I₀ − b·r", investment(e, r), sub(v("I0"), mul(v("b"), v("r"))), { I0: e.I0, b: e.b, r });
  const CA0 = t.step("S − I", S - I, sub(v("S"), v("I")), { S, I });
  // Two independent routes to the same number: saving minus investment, and
  // the trade balance read off the goods market. They agree because the goods
  // market clears (Y = C + I + G + NX), which is what the identity says.
  t.step(
    "Trade balance NX from the goods market",
    NX,
    undefined,
    undefined,
    open
      ? `X₀ − m·Y − v·ln ε. It equals S − I (${CA0.toFixed(4)}): with no foreign assets yet, the current account is the trade balance`
      : "A closed economy does not trade, so S = I",
  );

  // Net foreign assets as a share of output, starting from zero.
  const g = e.n + e.g;
  const tb = Y > 0 ? NX / Y : 0;
  const path: { t: number; a: number; ca: number }[] = [];
  let a = 0;
  for (let i = 0; i <= periods; i++) {
    path.push({ t: i, a, ca: tb + r * a });
    a = nfaNext(a, r, g, tb);
    if (!Number.isFinite(a)) break;
  }
  const converges = r < g;
  // a* = tb·(1 + g)/(g − r): only a steady state when growth outruns the interest rate.
  const aStar = converges ? (tb * (1 + g)) / (g - r) : Number.NaN;
  if (converges) {
    t.step(
      "Steady-state NFA ratio a* = tb·(1 + g)/(g − r)",
      aStar,
      div(mul(v("tb"), add(num(1), v("g"))), sub(v("g"), v("r"))),
      { tb, g, r },
      "Where interest income and growth balance the trade flow",
    );
  }
  const end = path[path.length - 1];

  return [
    {
      id: "external-balance",
      title: `Current account and net foreign assets: next ${periods} periods`,
      description:
        "The current account is saving minus investment, which equals the trade balance plus interest on foreign assets. Running it forward builds (or runs down) net foreign assets, which then earn the world interest rate while output grows.",
      timeseries: {
        xLabel: "Time",
        yLabel: "Percent of output",
        series: [
          { label: "Net foreign assets a (% of Y)", points: path.map((p) => ({ x: p.t, y: p.a * 100 })) },
          { label: "Current account (% of Y)", points: path.map((p) => ({ x: p.t, y: p.ca * 100 })) },
          ...(converges
            ? [{ label: "Steady state a* (% of Y)", points: path.map((p) => ({ x: p.t, y: aStar * 100 })), dashed: true }]
            : []),
        ],
      },
      scalars: [
        { label: "Output (Y)", value: Y },
        { label: "National saving (S)", value: S },
        { label: "Investment (I)", value: I },
        { label: "Current account today (S − I)", value: CA0, hint: "Equals the trade balance while net foreign assets are zero" },
        { label: "Trade balance (% of Y)", value: tb, percent: true },
        { label: "r − g", value: r - g, percent: true, hint: "World interest rate against output growth" },
        { label: `NFA in ${periods} periods (% of Y)`, value: end.a, percent: true },
        ...(converges ? [{ label: "Steady-state NFA a*", value: aStar, percent: true, hint: "tb·(1 + g)/(g − r)" }] : []),
      ],
      notes: [
        CA0 > 0
          ? "Saving exceeds investment, so the country lends abroad: a current-account surplus that builds net foreign assets."
          : CA0 < 0
            ? "Investment exceeds saving, so the country borrows abroad: a current-account deficit that runs up foreign debt."
            : "Saving equals investment: the current account is balanced.",
        converges
          ? "With r < g the position settles: interest compounds more slowly than output grows, so the ratio converges to a*."
          : r > g
            ? "With r > g there is no steady state: interest on the stock compounds faster than output grows. A debtor must eventually run trade surpluses, or its debt ratio explodes; a creditor's assets keep growing as a share of output."
            : "With r = g the stock grows exactly in line with output, so the ratio rises by the trade balance every period without settling.",
        open ? "This uses the Mundell-Fleming equilibrium for output, the interest rate and net exports." : "Closed economy: no trade, so the current account is zero.",
      ],
      trace: t.steps,
    },
  ];
}
