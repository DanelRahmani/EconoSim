import { type Expr, div, mul, num, sub, v, evaluate } from "../expr";
import type { Economy, ExternalityOptions, MarketOptions } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";

/**
 * Externalities and the Pigouvian tax.
 *
 *   demand P = a − b·Q,   private marginal cost c,   marginal external cost x
 *
 * Firms produce until price equals *private* marginal cost, giving Q_p = (a − c)/b.
 * Society wants production until price equals *social* marginal cost, giving
 * Q_s = (a − c − x)/b. The gap is over-production, and the surplus destroyed by
 * it is a triangle:
 *
 *   DWL = ½·x·(Q_p − Q_s) = x²/(2b)
 *
 * A tax of t per unit shifts private cost to c + t, so quantity is (a − c − t)/b
 * and the residual distortion is
 *
 *   DWL(t) = (t − x)²/(2b)
 *
 * which is zero exactly at t = x. That is the Pigouvian result, and the parabola
 * below shows both halves of it: too little tax leaves harm, too much tax
 * destroys surplus the other way. The regulator has to know x, which is the
 * whole difficulty in practice.
 */

export interface ExternalityCore {
  /** Unregulated (private) quantity and the socially optimal quantity. */
  qPrivate: number;
  qSocial: number;
  /** Over-production, in units. */
  overProduction: number;
  /** Harm with no tax. */
  deadweightLoss: number;
  /** The Pigouvian tax: exactly the marginal external cost. */
  pigouvianTax: number;
  /** Quantity and distortion under the tax actually in place. */
  qTaxed: number;
  residualLoss: number;
  taxRevenue: number;
  /** Price consumers pay under the tax. */
  consumerPrice: number;
  trace: CalcStep[];
}

const qPrivateExpr: Expr = div(sub(v("a"), v("c")), v("b"));
const qSocialExpr: Expr = div(sub(sub(v("a"), v("c")), v("x")), v("b"));
const dwlExpr: Expr = div(mul(v("x"), v("x")), mul(num(2), v("b")));
const residualExpr: Expr = div(mul(sub(v("t"), v("x")), sub(v("t"), v("x"))), mul(num(2), v("b")));

export function externalityCore(m: MarketOptions, x: ExternalityOptions): ExternalityCore {
  const t = new Tracer();
  const { demandA: a, demandB: b, mc: c } = m;
  const env = { a, b, c, x: x.external, t: x.tax };

  const qPrivate = t.step("Unregulated quantity (a − c)/b", evaluate(qPrivateExpr, env), qPrivateExpr, env);
  const qSocial = t.step(
    "Socially optimal quantity (a − c − x)/b",
    evaluate(qSocialExpr, env),
    qSocialExpr,
    env,
    "Quantity where price equals social marginal cost",
  );
  const deadweightLoss = t.step(
    "Deadweight loss with no tax x²/2b",
    evaluate(dwlExpr, env),
    dwlExpr,
    env,
    "Harm that falls on nobody in the market and so is never priced in",
  );
  const pigouvianTax = t.step(
    "Pigouvian tax t = x",
    x.external,
    v("x"),
    { x: x.external },
    "Set the tax equal to the marginal external cost",
  );
  const residualLoss = t.step(
    "Residual distortion (t − x)²/2b",
    evaluate(residualExpr, env),
    residualExpr,
    env,
    "Zero at the Pigouvian tax; positive on both sides of it",
  );

  const qTaxed = (a - c - x.tax) / b;

  return {
    qPrivate,
    qSocial,
    overProduction: qPrivate - qSocial,
    deadweightLoss,
    pigouvianTax,
    qTaxed,
    residualLoss,
    taxRevenue: x.tax * qTaxed,
    consumerPrice: a - b * qTaxed,
    trace: t.steps,
  };
}

export function externalities(_e: Economy, xo: ExternalityOptions, m: MarketOptions): Panel[] {
  const core = externalityCore(m, xo);
  const { demandA: a, demandB: b, mc: c } = m;
  const external = xo.external;
  const benefit = external < 0;

  const qMax = Math.max(core.qPrivate * 1.25, 1e-6);
  const qRange = linspace(0, qMax, 90);

  const taxRange = linspace(0, Math.max(external * 2, 1), 90);
  const residualAt = (t: number) => ((t - external) * (t - external)) / (2 * b);

  const money = (x: number) => x.toFixed(1);

  return [
    {
      id: "externality",
      title: benefit ? "An external benefit and the subsidy that captures it" : "A negative externality and the tax that prices it",
      description: benefit
        ? "The market produces less than is socially optimal because the people who benefit from it are not the people who pay for it. The social marginal cost sits below the private one, and the goods that go unproduced are the loss."
        : "Producers weigh their own costs and ignore the harm they impose on others, so the market produces too much. The social marginal cost sits above the private one, and the surplus destroyed on the excess units is the deadweight loss.",
      chart: {
        xLabel: "Quantity Q",
        yLabel: "Price and cost",
        series: [
          { label: "Demand", points: qRange.map((q) => ({ x: q, y: a - b * q })) },
          { label: benefit ? "Private cost" : "Private cost (what firms see)", points: qRange.map((q) => ({ x: q, y: c })) },
          {
            label: "Social marginal cost",
            points: qRange.map((q) => ({ x: q, y: c + external })),
          },
          ...(xo.tax !== 0
            ? [
                {
                  label: `Private cost including tax (t = ${xo.tax})`,
                  points: qRange.map((q) => ({ x: q, y: c + xo.tax })),
                  dashed: true,
                },
              ]
            : []),
        ],
        markers: [
          { x: core.qPrivate, y: c, label: "market" },
          { x: core.qSocial, y: c + external, label: "social optimum" },
        ],
      },
      scalars: [
        { label: "Market quantity", value: core.qPrivate },
        { label: "Socially optimal quantity", value: core.qSocial },
        {
          label: benefit ? "Under-production" : "Over-production",
          value: benefit ? core.qSocial - core.qPrivate : core.overProduction,
        },
        {
          label: "Deadweight loss with no tax",
          value: core.deadweightLoss,
          hint: "The uncorrected problem",
        },
        {
          label: benefit ? "Optimal subsidy" : "Pigouvian tax",
          value: core.pigouvianTax,
          hint: "Exactly the marginal external cost",
        },
        { label: "Tax actually in place", value: xo.tax },
        {
          label: "Residual distortion",
          value: core.residualLoss,
          hint: "(t − x)²/2b — zero at the Pigouvian tax, positive either side",
        },
        { label: "Government revenue", value: core.taxRevenue },
      ],
      notes: [
        benefit
          ? `A tax on a good with external benefits would make things worse. The optimum needs a subsidy of ${money(Math.abs(external))} per unit — a negative t in this model.`
          : `A tax of ${money(external)} per unit — exactly the external cost, no more — moves production to the social optimum. Nothing above that adds anything except distortion.`,
        Math.abs(xo.tax - external) < 1e-9
          ? "The tax is exactly Pigouvian: the residual distortion is zero and the harm is fully internalised."
          : xo.tax < external
            ? `The tax is too small by ${money(external - xo.tax)} per unit, so ${money(core.residualLoss)} of harm still falls on the people bearing the externality.`
            : `The tax overshoots by ${money(xo.tax - external)} per unit. The harm is gone, but ${money(core.residualLoss)} of surplus is destroyed by discouraging units that were worth producing.`,
        "The honest caveat: the regulator has to know the size of the external cost. Get it wrong and the chart below shows the cost of the error — which is symmetric, so over-taxing is exactly as damaging as under-taxing for the same-sized mistake.",
      ],
      trace: core.trace,
    },
    {
      id: "externality-tax",
      title: "Both kinds of mistake cost something",
      description:
        "The residual distortion as a function of the tax. It is a parabola: zero at the Pigouvian tax, and rising on both sides — the cost of taxing too little is the harm not prevented, and the cost of taxing too much is the surplus destroyed. Both are the same size for the same-sized error.",
      chart: {
        xLabel: "Tax per unit",
        yLabel: "Deadweight loss remaining",
        series: [
          { label: "Residual distortion (t − x)²/2b", points: taxRange.map((t) => ({ x: t, y: residualAt(t) })) },
        ],
        markers: [
          { x: 0, y: core.deadweightLoss, label: "no tax" },
          { x: external, y: 0, label: "Pigouvian" },
          { x: xo.tax, y: core.residualLoss, label: "you" },
        ],
      },
      scalars: [
        { label: "Harm with no tax", value: core.deadweightLoss },
        {
          label: `Distortion at the tax in place`,
          value: core.residualLoss,
        },
        {
          label: "Best achievable",
          value: 0,
          hint: "Pigouvian taxation removes the distortion entirely — in this model, exactly",
        },
      ],
      notes: [
        "The parabola is symmetric about the Pigouvian tax, so the regulator's error costs the same in either direction. Taxes are not safer when they are too small.",
        "Unlike the tax wedge on a good with no externality, this tax improves welfare at its optimum — it moves the market towards the social optimum rather than away from it.",
      ],
      trace: [],
    },
  ];
}
