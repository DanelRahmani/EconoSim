import { type Expr, add, div, mul, num, pow, sub, v, evaluate } from "../expr";
import type { Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";

/**
 * The labour market behind the labour market: where the natural rate of
 * unemployment actually comes from (Blanchard's WS-PS model).
 *
 *   Wage setting (workers):   W/P = 1 − γ·u + z
 *   Price setting (firms):    W/P = 1/(1 + m)
 *
 * Workers want a higher real wage the tighter the labour market and the greater
 * their bargaining power z (benefits, union strength, minimum wage). Firms offer
 * a real wage that falls with the mark-up m they charge. Only one unemployment
 * rate makes those two consistent — the natural rate:
 *
 *   u_n = (1 + z − 1/(1+m)) / γ        exactly, and ≈ (m + z)/γ for small m.
 *
 * The linear approximation is the version in every textbook; showing both makes
 * plain that "u_n = (m+z)/γ" is an approximation, not a definition.
 */

export interface LabourCore {
  /** Natural rate, solving WS = PS exactly. */
  exactUn: number;
  /** The textbook linearisation (m + z)/γ. */
  linearUn: number;
  /** Real wage at the natural rate. */
  realWage: number;
  naturalEmployment: number;
  naturalOutput: number;
  labourShare: number;
  trace: CalcStep[];
}

const wsExpr: Expr = add(sub(num(1), mul(v("gamma"), v("u"))), v("z"));
const psExpr: Expr = div(num(1), add(num(1), v("m")));
const exactUnExpr: Expr = div(sub(add(num(1), v("z")), div(num(1), add(num(1), v("m")))), v("gamma"));
const linearUnExpr: Expr = div(add(v("m"), v("z")), v("gamma"));
const naturalOutputExpr: Expr = mul(v("A"), pow(v("K0"), v("alpha")), pow(v("Nn"), sub(num(1), v("alpha"))));

/** Natural unemployment implied by the wage- and price-setting curves. */
export function naturalUnemployment(e: Economy): { exact: number; linear: number } {
  const exact = (1 + e.wagePush - 1 / (1 + e.markup)) / e.wageSlope;
  const linear = (e.markup + e.wagePush) / e.wageSlope;
  return { exact, linear };
}

export function labourCore(e: Economy): LabourCore {
  const t = new Tracer();
  const { exact, linear } = naturalUnemployment(e);
  const env = { z: e.wagePush, m: e.markup, gamma: e.wageSlope, u: exact };

  t.step(
    "Wage-setting real wage at uₙ",
    evaluate(wsExpr, env),
    wsExpr,
    env,
    "What workers can bargain for at the natural rate",
  );
  const ps = t.step("Price-setting real wage", evaluate(psExpr, env), psExpr, env, "What firms can afford given their mark-up");
  const exactUn = t.step(
    "Natural unemployment uₙ (exact)",
    exact,
    exactUnExpr,
    env,
    "The rate that makes the two real wages agree",
  );
  t.step("Textbook linearisation (m + z)/γ", linear, linearUnExpr, env, "Agrees with the exact solution for small mark-ups");

  const naturalEmployment = (1 - exactUn) * e.L;
  const naturalOutput = t.step(
    "Natural output Yₙ",
    evaluate(naturalOutputExpr, { A: e.A, K0: e.K0, alpha: e.alpha, Nn: naturalEmployment }),
    naturalOutputExpr,
    { A: e.A, K0: e.K0, alpha: e.alpha, Nn: naturalEmployment },
    "Potential output once the natural rate of unemployment is removed from the labour force",
  );

  return {
    exactUn,
    linearUn: linear,
    realWage: ps,
    naturalEmployment,
    naturalOutput,
    labourShare: 1 - e.alpha,
    trace: t.steps,
  };
}

export function labourMarket(e: Economy): Panel[] {
  const core = labourCore(e);
  const uLo = 0;
  const uHi = Math.min(0.45, Math.max(0.2, core.exactUn * 3));
  const uRange = linspace(uLo, uHi, 80);

  const wsLine = (z: number) => uRange.map((u) => ({ x: u * 100, y: 1 - e.wageSlope * u + z }));
  const psLine = (m: number) => uRange.map((u) => ({ x: u * 100, y: 1 / (1 + m) }));
  const flat = (y: number) => uRange.map((u) => ({ x: u * 100, y }));

  const mRange = linspace(0, 0.3, 60);
  const current = (m: number) => (1 + e.wagePush - 1 / (1 + m)) / e.wageSlope;

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  return [
    {
      id: "ws-ps",
      title: "Wage setting, price setting and the natural rate",
      description:
        "Workers' wage-setting curve slopes down: the tighter the labour market, the higher the real wage they can win. Firms' price-setting line is flat — their mark-up fixes the real wage they can pay. The intersection is the natural rate of unemployment.",
      chart: {
        xLabel: "Unemployment (%)",
        yLabel: "Real wage (W/P)",
        series: [
          { label: `Wage setting (z = ${e.wagePush})`, points: wsLine(e.wagePush) },
          { label: `Price setting (m = ${e.markup})`, points: psLine(e.markup) },
          { label: "Wage setting with higher z", points: wsLine(e.wagePush + 0.05), dashed: true },
          { label: "Price setting with higher m", points: flat(1 / (1 + e.markup * 1.6)), dashed: true },
        ],
        markers: [{ x: core.exactUn * 100, y: core.realWage, label: "uₙ" }],
      },
      scalars: [
        { label: "Natural unemployment uₙ", value: core.exactUn, hint: "The exact solution of WS = PS" },
        { label: "Linear approximation (m+z)/γ", value: core.linearUn },
        { label: "Real wage (W/P)", value: core.realWage, hint: "1/(1+m): the mark-up is what stops the real wage rising further" },
        { label: "Natural employment", value: core.naturalEmployment },
        { label: "Natural output Yₙ", value: core.naturalOutput },
        { label: "Labour share of income (1−α)", value: core.labourShare },
      ],
      notes: [
        `Higher wage-push factors z or a higher mark-up m both raise the natural rate; a steeper wage-setting curve γ lowers it. Adding 5 points of z here would push uₙ to ${pct(core.exactUn + 0.05 / e.wageSlope)}.`,
        "This is where the Phillips curve's uₙ comes from. Nothing in the Phillips model explains it — it is inherited from the structure of wage and price setting.",
        "The honest caveat: this is a static, one-period model of the labour market. It says nothing about how unemployment actually adjusts, which is what the WS-PS diagram is usually criticised for.",
      ],
      trace: core.trace,
    },
    {
      id: "ws-ps-comparative",
      title: "Why the natural rate is what it is",
      description:
        "The natural rate rises one-for-one with the mark-up firms charge, in proportion to wage push, and falls with the wage-setting slope. Anything that raises either curve raises unemployment.",
      chart: {
        xLabel: "Firms' mark-up m (%)",
        yLabel: "Natural unemployment uₙ (%)",
        series: [
          { label: "Natural rate uₙ(m)", points: mRange.map((m) => ({ x: m * 100, y: current(m) * 100 })) },
          { label: "Linearisation (m+z)/γ", points: mRange.map((m) => ({ x: m * 100, y: ((m + e.wagePush) / e.wageSlope) * 100 })), dashed: true },
        ],
        markers: [{ x: e.markup * 100, y: core.exactUn * 100, label: "you" }],
      },
      scalars: [
        { label: "Mark-up sensitivity ∂uₙ/∂m", value: 1 / (1 + e.markup) ** 2 / e.wageSlope, hint: "About one-for-one while the mark-up is small" },
        { label: "Wage-push sensitivity ∂uₙ/∂z", value: 1 / e.wageSlope },      ],
      notes: [
        "The two lines are close while the mark-up is small and drift apart as it grows — that drift is the log approximation, not a modelling difference.",
      ],
      trace: [],
    },
  ];
}
