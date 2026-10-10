import { type Expr, add, div, mul, num, sub, v, evaluate } from "../expr";
import type { Economy, MarketOptions } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";

/**
 * Competition against monopoly in one market.
 *
 *   demand P = a − b·Q,   constant marginal cost c,   fixed cost F
 *
 *   competition  P = c            Q_c = (a − c)/b
 *   monopoly     MR = a − 2bQ     Q_m = (a − c)/2b,   P_m = (a + c)/2
 *
 * The monopoly restricts quantity to raise price. Everything the two structures
 * differ on has a closed form, so the deadweight loss is the *area of the
 * triangle between the demand curve and marginal cost*, over the units that
 * would have been produced but are not:
 *
 *   DWL = ½·(P_m − c)·(Q_c − Q_m) = (a − c)²/(8b)
 */

export interface MarketCore {
  /** Competitive and monopoly outcomes. */
  qc: number;
  qm: number;
  priceM: number;
  priceC: number;
  /** Consumer surplus under each structure. */
  csC: number;
  csM: number;
  /** Producer surplus (before fixed costs). */
  psC: number;
  psM: number;
  /** Monopoly operating profit = the Lerner margin times quantity. */
  monopolyMargin: number;
  /** Lerner index (P − MC)/P. */
  lerner: number;
  deadweightLoss: number;
  /** Total surplus under each structure, before fixed costs. */
  surplusC: number;
  surplusM: number;
  trace: CalcStep[];
}

const qcExpr: Expr = div(sub(v("a"), v("c")), v("b"));
const qmExpr: Expr = div(sub(v("a"), v("c")), mul(num(2), v("b")));
const priceMExpr: Expr = div(add(v("a"), v("c")), num(2));
const dwlExpr: Expr = div(pow2(sub(v("a"), v("c"))), mul(num(8), v("b")));
const lernerExpr: Expr = div(sub(v("a"), v("c")), add(v("a"), v("c")));

/** Small local helper so the deadweight-loss expression reads as a square. */
function pow2(e: Expr): Expr {
  return mul(e, e);
}

export function marketCore(m: MarketOptions): MarketCore {
  const t = new Tracer();
  const { demandA: a, demandB: b, mc: c } = m;
  const env = { a, b, c };

  const qc = t.step("Competitive quantity Q_c = (a − c)/b", evaluate(qcExpr, env), qcExpr, env);
  const qm = t.step(
    "Monopoly quantity Q_m = (a − c)/2b",
    evaluate(qmExpr, env),
    qmExpr,
    env,
    "Set marginal revenue equal to marginal cost",
  );
  const priceM = t.step("Monopoly price P_m = (a + c)/2", evaluate(priceMExpr, env), priceMExpr, env);
  const deadweightLoss = t.step(
    "Deadweight loss (a − c)²/8b",
    evaluate(dwlExpr, env),
    dwlExpr,
    env,
    "The triangle between demand and marginal cost over the units that are not produced",
  );
  const lerner = t.step(
    "Lerner index (P − MC)/P",
    evaluate(lernerExpr, env),
    lernerExpr,
    env,
    "How much of the price is market power rather than cost",
  );

  const csC = ((a - c) * qc) / 2;
  const csM = ((a - priceM) * qm) / 2;
  const psC = 0;
  const psM = (priceM - c) * qm;

  return {
    qc,
    qm,
    priceM,
    priceC: c,
    csC,
    csM,
    psC,
    psM,
    monopolyMargin: priceM - c,
    lerner,
    deadweightLoss,
    surplusC: csC + psC,
    surplusM: csM + psM,
    trace: t.steps,
  };
}

export function marketStructure(_e: Economy, m: MarketOptions): Panel[] {
  const core = marketCore(m);
  const { demandA: a, demandB: b, mc: c, fixed } = m;

  const qMax = Math.max(core.qc * 1.3, 1e-6);
  const qRange = linspace(0, qMax, 90);
  const demand = qRange.map((q) => ({ x: q, y: a - b * q }));
  const marginalRevenue = qRange.map((q) => ({ x: q, y: a - 2 * b * q }));
  const marginalCost = qRange.map((q) => ({ x: q, y: c }));

  const money = (x: number) => x.toFixed(1);

  return [
    {
      id: "market-structure",
      title: "Competition against monopoly",
      description:
        "A competitive market produces where price equals marginal cost. A monopolist produces where marginal revenue equals marginal cost and then charges what the demand curve will bear — fewer units, a higher price, and the surplus on the missing units is lost to nobody.",
      chart: {
        xLabel: "Quantity Q",
        yLabel: "Price P",
        series: [
          { label: "Demand", points: demand },
          { label: "Marginal revenue", points: marginalRevenue },
          { label: "Marginal cost", points: marginalCost, dashed: true },
        ],
        markers: [
          { x: core.qc, y: c, label: "competition" },
          { x: core.qm, y: core.priceM, label: "monopoly" },
        ],
      },
      scalars: [
        { label: "Competitive price", value: core.priceC },
        { label: "Monopoly price", value: core.priceM },
        { label: "Price rise from market power", value: core.priceM - core.priceC },
        { label: "Units withheld", value: core.qc - core.qm },
        { label: "Deadweight loss", value: core.deadweightLoss },
        { label: "Lerner index", value: core.lerner },
      ],
      notes: [
        `The monopolist withholds ${money(core.qc - core.qm)} units and charges ${money(core.priceM - core.priceC)} more. Consumers lose ${money(core.csC - core.csM)} of surplus; ${money(core.deadweightLoss)} of it is destroyed outright rather than transferred to the firm.`,
        "The deadweight loss is the triangle between demand and marginal cost over the units that are not produced. It is a triangle because both curves are straight here.",
        "The honest caveat: this is the textbook case with no entry, no product differentiation, no price discrimination and no innovation. Real monopolists may be large precisely because fixed costs are large — which is why the fixed cost appears in the table below rather than being ignored.",
      ],
      trace: core.trace,
    },
    {
      id: "market-structure-table",
      title: "The two structures side by side",
      description:
        "Every row has a closed form, so the difference between the two market structures can be read straight off. Fixed costs are subtracted from profit but cancel out of the surplus comparison.",
      table: {
        columns: ["Perfect competition", "Monopoly"],
        rows: [
          { label: "Price", cells: [{ text: money(core.priceC) }, { text: money(core.priceM) }] },
          { label: "Quantity", cells: [{ text: money(core.qc) }, { text: money(core.qm) }] },
          { label: "Consumer surplus", cells: [{ text: money(core.csC) }, { text: money(core.csM) }] },
          { label: "Producer surplus", cells: [{ text: money(core.psC) }, { text: money(core.psM) }] },
          { label: "Total surplus", cells: [{ text: money(core.surplusC) }, { text: money(core.surplusM) }] },
          {
            label: "Profit after fixed cost",
            cells: [{ text: money(core.psC - fixed) }, { text: money(core.psM - fixed) }],
          },
          {
            label: "Deadweight loss",
            cells: [{ text: "0" }, { text: money(core.deadweightLoss), emphasis: true }],
          },
        ],
        caption:
          "Total surplus is the same for both only when the deadweight loss is zero. Fixed costs are identical under the two structures, so they cancel in the comparison but not in profit.",
      },
      scalars: [
        {
          label: "Consumer surplus lost",
          value: core.csC - core.csM,
          hint: "Part of this is a transfer to the firm; the rest is destroyed",
        },
        { label: "Transferred to the firm", value: core.psM - core.psC },
        { label: "Destroyed (deadweight loss)", value: core.deadweightLoss },
        {
          label: "Break-even fixed cost",
          value: core.psM,
          hint: "Above this, the monopolist would rather not produce at all",
        },
      ],
      notes: [
        core.psM > fixed
          ? `The monopolist covers its fixed cost of ${money(fixed)} with ${money(core.psM)} of operating profit, so it stays in business.`
          : `Operating profit of ${money(core.psM)} does not cover the fixed cost of ${money(fixed)}: the monopolist would exit, and the market would not be served at all. This is the natural-monopoly case for regulation rather than competition.`,
        "Raise the fixed cost and the case for tolerating market power gets stronger — that tension is the whole of competition policy in one slider.",
      ],
      trace: [],
    },
  ];
}
