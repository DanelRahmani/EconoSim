import { type Expr, evaluate, toLatex, withValues } from "./expr";

/**
 * A single recorded step of a calculation. The engine emits these as it
 * computes, so the "Show the calculation" panel displays the arithmetic that
 * actually ran rather than a hand-written explanation that can drift.
 */
export interface CalcStep {
  label: string;
  /** Symbolic form of the step, when available. */
  expr?: Expr;
  /** Values to substitute into `expr` for the "plugged in" rendering. */
  env?: Record<string, number>;
  /** The computed result. */
  value: number;
  note?: string;
}

export interface RenderedStep extends CalcStep {
  symbolic?: string;
  substituted?: string;
}

export function renderStep(s: CalcStep): RenderedStep {
  return {
    ...s,
    symbolic: s.expr ? toLatex(s.expr) : undefined,
    substituted: s.expr && s.env ? withValues(s.expr, s.env) : undefined,
  };
}

/** Collects calculation steps as the engine runs. */
export class Tracer {
  readonly steps: CalcStep[] = [];

  step(label: string, value: number, expr?: Expr, env?: Record<string, number>, note?: string): number {
    this.steps.push({ label, value, expr, env, note });
    return value;
  }
}

/** Evaluate an expression and record the step in one call. */
export function trace(
  tracer: Tracer,
  label: string,
  expr: Expr,
  env: Record<string, number>,
  note?: string,
): number {
  const value = evaluate(expr, env);
  tracer.step(label, value, expr, env, note);
  return value;
}

export { evaluate };
