/**
 * A tiny expression AST. Defined once, an equation can be (a) evaluated
 * numerically and (b) rendered as LaTeX — so the maths shown in the UI is
 * definitionally the maths the engine runs.
 */

export type Expr =
  | { k: "num"; v: number }
  | { k: "var"; n: string }
  | { k: "add"; a: Expr[] }
  | { k: "sub"; a: Expr; b: Expr }
  | { k: "mul"; a: Expr[] }
  | { k: "div"; a: Expr; b: Expr }
  | { k: "pow"; a: Expr; b: Expr }
  | { k: "neg"; a: Expr };

export const num = (v: number): Expr => ({ k: "num", v });
export const v = (n: string): Expr => ({ k: "var", n });
export const add = (...a: Expr[]): Expr => ({ k: "add", a });
export const sub = (a: Expr, b: Expr): Expr => ({ k: "sub", a, b });
export const mul = (...a: Expr[]): Expr => ({ k: "mul", a });
export const div = (a: Expr, b: Expr): Expr => ({ k: "div", a, b });
export const pow = (a: Expr, b: Expr): Expr => ({ k: "pow", a, b });
export const neg = (a: Expr): Expr => ({ k: "neg", a });

/** Canonical LaTeX names for common economic symbols. */
const LATEX_NAMES: Record<string, string> = {
  alpha: "\\alpha",
  delta: "\\delta",
  theta: "\\theta",
  lambda: "\\lambda",
  rho: "\\rho",
  sigma: "\\sigma",
  eta: "\\eta",
  gamma: "\\gamma",
  pi: "\\pi",
  mu: "\\mu",
  phi: "\\phi",
  beta: "\\beta",
  piE: "\\pi^{e}",
  piStar: "\\pi^{*}",
  rStar: "r^{*}",
  pStar: "P^{*}",
  yStar: "y^{*}",
  Yn: "Y_{n}",
  NX: "NX",
  CA: "CA",
  MPK: "MPK",
};

function latexName(n: string): string {
  if (LATEX_NAMES[n]) return LATEX_NAMES[n];
  // Convert a trailing digit subscript: k1 -> k_{1}
  const m = /^([A-Za-z]+)([0-9]+)$/.exec(n);
  if (m) return `${m[1]}_{${m[2]}}`;
  return n;
}

export function formatNum(x: number): string {
  if (!Number.isFinite(x)) return "\\text{n/a}";
  const a = Math.abs(x);
  if (a !== 0 && (a >= 1e5 || a < 1e-4)) return x.toExponential(3).replace("e", "\\times 10^{") + "}";
  const r = Math.round(x * 10000) / 10000;
  return String(r);
}

/** Collect the variable names referenced by an expression. */
export function vars(e: Expr, out: Set<string> = new Set()): Set<string> {
  switch (e.k) {
    case "var":
      out.add(e.n);
      break;
    case "num":
      break;
    case "add":
    case "mul":
      e.a.forEach((x) => vars(x, out));
      break;
    case "sub":
    case "div":
    case "pow":
      vars(e.a, out);
      vars(e.b, out);
      break;
    case "neg":
      vars(e.a, out);
      break;
  }
  return out;
}

/** Replace every variable that appears in `env` with its numeric value. */
export function substitute(e: Expr, env: Record<string, number>): Expr {
  switch (e.k) {
    case "num":
      return e;
    case "var":
      return e.n in env ? num(env[e.n]) : e;
    case "add":
      return { k: "add", a: e.a.map((x) => substitute(x, env)) };
    case "mul":
      return { k: "mul", a: e.a.map((x) => substitute(x, env)) };
    case "sub":
      return sub(substitute(e.a, env), substitute(e.b, env));
    case "div":
      return div(substitute(e.a, env), substitute(e.b, env));
    case "pow":
      return pow(substitute(e.a, env), substitute(e.b, env));
    case "neg":
      return neg(substitute(e.a, env));
  }
}

/** Numerically evaluate an expression. Throws if a variable is missing. */
export function evaluate(e: Expr, env: Record<string, number>): number {
  switch (e.k) {
    case "num":
      return e.v;
    case "var": {
      const val = env[e.n];
      if (val === undefined) throw new Error(`Expression references unknown variable "${e.n}"`);
      return val;
    }
    case "add":
      return e.a.reduce((s, x) => s + evaluate(x, env), 0);
    case "mul":
      return e.a.reduce((s, x) => s * evaluate(x, env), 1);
    case "sub":
      return evaluate(e.a, env) - evaluate(e.b, env);
    case "div":
      return evaluate(e.a, env) / evaluate(e.b, env);
    case "pow":
      return Math.pow(evaluate(e.a, env), evaluate(e.b, env));
    case "neg":
      return -evaluate(e.a, env);
  }
}

const PREC: Record<Expr["k"], number> = {
  num: 4,
  var: 4,
  neg: 3,
  pow: 3,
  mul: 2,
  div: 2,
  add: 1,
  sub: 1,
};

function latex(e: Expr, parentPrec = 0): string {
  const prec = PREC[e.k];
  let s: string;
  switch (e.k) {
    case "num":
      s = formatNum(e.v);
      break;
    case "var":
      s = latexName(e.n);
      break;
    case "add":
      s = e.a.map((x) => latex(x, 1)).join(" + ");
      break;
    case "sub":
      s = `${latex(e.a, 1)} - ${latex(e.b, 1)}`;
      break;
    case "mul":
      s = e.a.map((x) => latex(x, 2)).join(" \\cdot ");
      break;
    case "div":
      s = `\\frac{${latex(e.a)}}{${latex(e.b)}}`;
      break;
    case "pow":
      s = `${latex(e.a, 3)}^{${latex(e.b)}}`;
      break;
    case "neg":
      s = `-${latex(e.a, 3)}`;
      break;
  }
  return prec < parentPrec ? `\\left(${s}\\right)` : s;
}

export function toLatex(e: Expr): string {
  return latex(e);
}

/** Render an expression with the supplied values substituted in. */
export function withValues(e: Expr, env: Record<string, number>): string {
  return latex(substitute(e, env));
}
