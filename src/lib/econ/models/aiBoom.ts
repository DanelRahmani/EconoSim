import { type Expr, add, div, mul, num, pow, sub, v, evaluate } from "../expr";
import type { AiOptions, Economy } from "../types";
import type { Panel } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { clamp, linspace } from "../math";

/**
 * AI boom: what happens when AI performs a share of labour tasks and the work is
 * funded by capital instead.
 *
 *   L_eff  = (1 − θ)·L                      human labour still employed
 *   K_AI   = ψ·κ·θ·K                        AI capital installed
 *   K_tot  = K + K_AI
 *   Y      = A · K_tot^α · L_eff^(1−α)
 *
 * Note the honest result: a *like-for-like* swap (ψ = 1) destroys output when
 * capital's share α is below one half, because you are moving work into the
 * factor with the lower average product. AI only pays off above a break-even
 * productivity, which rises with θ — the model computes both.
 */

export interface AiOutcome {
  theta: number;
  labourEffective: number;
  displaced: number;
  aiCapital: number;
  capitalTotal: number;
  baselineOutput: number;
  output: number;
  /** Fractional change vs. the no-AI economy. */
  change: number;
  outputPerWorker: number;
  /** Marginal break-even at θ→0: (1−α)/α. */
  breakEvenMarginal: number;
  /** Exact break-even productivity for the chosen θ (Infinity if unreachable). */
  breakEvenForShare: number;
  outputAtLikeForLike: number;
  trace: CalcStep[];
}

const labourExpr: Expr = mul(sub(num(1), v("theta")), v("L"));
const aiCapitalExpr: Expr = mul(v("psi"), v("kappa"), v("theta"), v("K"));
const totalCapitalExpr: Expr = add(v("K"), v("KAI"));
const outputExpr: Expr = mul(v("A"), pow(v("Ktot"), v("alpha")), pow(v("Leff"), sub(num(1), v("alpha"))));
const baselineExpr: Expr = mul(v("A"), pow(v("K"), v("alpha")), pow(v("L"), sub(num(1), v("alpha"))));
const breakEvenExpr: Expr = div(sub(num(1), v("alpha")), v("alpha"));

/** Output for a given substitution share and AI productivity. */
export function aiOutput(e: Economy, ai: AiOptions, theta: number, psi: number): number {
  const labour = (1 - theta) * e.L;
  const capital = e.K0 + psi * ai.capitalIntensity * theta * e.K0;
  return e.A * Math.pow(capital, e.alpha) * Math.pow(Math.max(labour, 1e-6), 1 - e.alpha);
}

export function aiOutcome(e: Economy, ai: AiOptions): AiOutcome {
  const t = new Tracer();
  const theta = clamp(ai.substitutionPct / 100, 0, 0.95);
  const { capitalIntensity: kappa, capitalProductivity: psi } = ai;

  const env = { theta, kappa, psi, alpha: e.alpha, A: e.A, K: e.K0, L: e.L };

  const labourEffective = t.step(
    "Human labour still employed",
    evaluate(labourExpr, env),
    labourExpr,
    env,
    `AI performs ${Math.round(theta * 100)}% of labour tasks`,
  );

  const aiCapital = t.step("AI capital installed", evaluate(aiCapitalExpr, env), aiCapitalExpr, env);

  const capitalTotal = t.step(
    "Total capital stock",
    e.K0 + aiCapital,
    totalCapitalExpr,
    { K: e.K0, KAI: aiCapital },
  );

  const outputEnv = { A: e.A, Ktot: capitalTotal, Leff: labourEffective, alpha: e.alpha };
  const output = t.step("Output with AI", evaluate(outputExpr, outputEnv), outputExpr, outputEnv);

  const baseEnv = { A: e.A, K: e.K0, L: e.L, alpha: e.alpha };
  const baselineOutput = t.step("Output before AI", evaluate(baselineExpr, baseEnv), baselineExpr, baseEnv);

  const breakEvenMarginal = t.step(
    "Break-even AI productivity at the margin",
    evaluate(breakEvenExpr, env),
    breakEvenExpr,
    env,
    "ψ must exceed (1−α)/α for a small substitution to pay for itself",
  );

  // Exact break-even for this θ: (1 + ψκθ)^α = (1 − θ)^−(1−α)
  const breakEvenForShare =
    theta > 1e-6 && kappa > 1e-6 && psi > 0
      ? (Math.pow(1 - theta, -(1 - e.alpha) / e.alpha) - 1) / (kappa * theta)
      : breakEvenMarginal;

  const likeForLike = aiOutput(e, ai, theta, 1);
  const displaced = e.L - labourEffective;
  const change = baselineOutput > 0 ? (output - baselineOutput) / baselineOutput : 0;
  const outputPerWorker = labourEffective > 1e-9 ? output / labourEffective : output;

  return {
    theta,
    labourEffective,
    displaced,
    aiCapital,
    capitalTotal,
    baselineOutput,
    output,
    change,
    outputPerWorker,
    breakEvenMarginal,
    breakEvenForShare,
    outputAtLikeForLike: likeForLike,
    trace: t.steps,
  };
}

export function aiBoom(e: Economy, ai: AiOptions): Panel[] {
  const core = aiOutcome(e, ai);
  const thetas = linspace(0, 0.95, 60);
  const curve = (psi: number) =>
    thetas.map((th) => ({ x: th * 100, y: aiOutput(e, ai, th, psi) }));
  const flat = (y: number) => thetas.map((th) => ({ x: th * 100, y }));

  return [
    {
      id: "ai-boom",
      title: "AI boom: capital substituting for labour",
      description:
        "AI performs a share of labour tasks, and the work is funded by installing capital instead. Output rises only if that AI capital is productive enough — a like-for-like swap destroys output when capital's share is below one half.",
      chart: {
        xLabel: "Share of labour replaced by AI (%)",
        yLabel: "Output (Y)",
        series: [
          { label: `With AI capital (ψ = ${ai.capitalProductivity})`, points: curve(ai.capitalProductivity) },
          { label: "Like-for-like (ψ = 1)", points: curve(1), dashed: true },
          { label: "No AI", points: flat(core.baselineOutput), dashed: true },
        ],
        markers: [{ x: ai.substitutionPct, y: core.output, label: "you" }],
      },
      scalars: [
        { label: "Output without AI", value: core.baselineOutput },
        { label: "Output with AI", value: core.output },
        { label: "Change in output", value: core.change, hint: "Signed fraction; negative means the AI boom shrinks the economy" },
        { label: "Labour still employed", value: core.labourEffective },
        { label: "Workers displaced", value: core.displaced },
        { label: "AI capital installed", value: core.aiCapital },
        { label: "Output per remaining worker", value: core.outputPerWorker },
        {
          label: "Break-even AI productivity",
          value: core.breakEvenForShare,
          hint: "How many times more productive than ordinary capital AI must be for this share to break even",
        },
      ],
      notes: [
        `At this share (${ai.substitutionPct}%), AI capital must be about ${core.breakEvenForShare.toFixed(2)}× as productive as ordinary capital just to leave output unchanged.`,
        core.change >= 0
          ? "You are above break-even: the AI boom raises output."
          : "You are below break-even: capital is not productive enough to replace the labour it displaces, so output falls.",
        "Cobb-Douglas has constant factor shares, so this is a story about levels — output, employment and capital — not about the split of income.",
      ],
      trace: core.trace,
    },
  ];
}
