# EconoSim

A browser-based economics simulator. Build an economy from its parameters, explore a
suite of macro and international-macro models as both **equilibrium curves** and
**dynamic time paths**, introduce dated shocks, and open any diagram to see the
theory and the **exact step-by-step calculation** the engine ran.

Everything is computed in the browser — no backend, no database, no external APIs.

Live at <https://econosim.danelrahmani.com>.

## Models

| Group | Models |
| --- | --- |
| Foundations | Cobb-Douglas production |
| Long run | Solow-Swan (steady state, golden rule, transition path), AK endogenous growth |
| Short run | IS-LM, AD-AS (with expectations adjustment), Zero lower bound |
| Inflation & unemployment | Phillips curve (adaptive vs credible expectations), WS-PS labour market |
| Fiscal & debt | Debt dynamics (the r − g drift), Currency crisis |
| Open economy | Mundell-Fleming (small/large × floating/fixed) |
| International macro | Parity conditions (UIP, CIP, PPP, real rate, trilemma), Dornbusch overshooting, external balance (S−I, NFA, debt dynamics), trade flows (Marshall-Lerner, J-curve, Dutch disease), Taylor rule |
| Micro | Consumer choice, competition vs monopoly, externalities and the Pigouvian tax |
| Strategic interaction | Game theory (2×2: prisoner's dilemma, coordination, chicken, matching pennies) |
| Applied scenarios | AI boom (labour substituted by capital) |

Several models carry their own **scenario dials** above the first chart — the expectations
regime, the size of the zero-lower-bound shock, the micro and market dials, the externality
and tax, which game is played. All of them travel in the share link.

Add **shocks** to any economy: apply one or more named shocks (monetary, fiscal, technology boom, oil, risk premium, devaluation…) and every model then shows the economy *with* the shock and — in Compare — the same economy *without* it, with the difference called out on every figure.

## Features

- **Create an economy** — set technology, capital and labour, saving and growth, fiscal
  and monetary policy, and openness/size/exchange-rate regime.
- **Real-country presets** — ~10 stylised economies (US, Germany, Japan, Netherlands,
  Switzerland, Singapore, China, India, Brazil, Saudi Arabia). Figures are rounded
  approximations and fully editable.
- **Live sliders** — every model recomputes as you drag, and the curves morph to the new shape.
- **Shocks and comparisons** — apply named shocks; see the same model with and without them, with
dashed baseline curves and ▲/▼ deltas on every figure. "Pin baseline" freezes any economy to compare against.
- **Saved presets** — save your own economies in the browser (localStorage) and reload them later.
- **Glossary** — every symbol (Y, r, α, ε…) and switch (openness, country size, exchange-rate regime)
explained in plain language; hover any label for the short version.
- **Show the calculation** — each chart has an expandable block with the symbolic
  equations, your values substituted in, and the resulting numbers (rendered with KaTeX).
- **Comparative statics** — pick any parameter and the model is re-run 1% either side of it,
  tabulating every figure it reports against the base and the direction it moves. The classic
  *“G↑ ⇒ Y↑, r↑, I↓”* grid, read off real runs rather than hand-written.
- **Export** — the whole view, or any single panel, as a CSV: the figures, the series, the
  tables *and* the calculation steps, at full precision, ready to hand in. Any chart also
  downloads as a standalone SVG in the theme you are reading it in.
- **Every chart has a data table** — the plotted series as text, so the numbers can be read
  outright and the picture is not the only way in.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Engine invariant tests (Vitest) |

## Project structure

```
src/
  lib/econ/
    types.ts        Economy definition + validation
    math.ts         Linear solver, RK4 integrator, bisection
    expr.ts         Expression AST: evaluates numerically AND emits LaTeX
    trace.ts        CalcStep recording (the "exact calculation")
    panel.ts        Generic output shape every model returns
    models/         One file per model
    registry.ts     Model catalogue used by the UI
    countries.ts    Country presets
    shocks.ts       Shock presets applied on top of the economy
    glossary.ts     Plain-language reference for symbols and switches
    compare.ts      Merges a baseline run into the current run
  lib/presets-store.ts   User-saved presets in localStorage
  components/       Charts (SVG + Recharts), KaTeX maths, panels, simulator shell
  app/              Next.js App Router pages
docs/               Model notes and data sources
```

## Design notes

The **expression AST is the single source of truth**: an equation defined once can be
evaluated numerically *and* rendered as LaTeX, so what the UI shows is what the engine
computed. Each model returns `Panel`s (charts, scalars, notes, trace); the UI renders
them generically.

See [`docs/models.md`](docs/models.md) for the equations and sign conventions, and
[`DEPLOYMENT.md`](DEPLOYMENT.md) to deploy.
