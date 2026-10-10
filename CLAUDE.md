# EconoSim — working notes for the next session

_Last updated 2026-10-11 · `master` @ `7592ea5` · 21 models · 108 tests · all pushed_

This file is the handoff note: what exists, how to extend it without breaking it, what is
known to be missing, and what to do next. Read the "Conventions that bite" section before
editing anything — most of it was learned the hard way.

---

## What this is

A browser-only economics simulator. You construct an economy, then explore textbook models
as **equilibrium curves** and **dynamic time paths**, apply shocks, and see the exact
arithmetic that produced every figure. No backend, no database, no data feeds — all compute
is client-side, which is a deliberate design constraint, not an omission.

Stack: Next.js 16 (App Router, Turbopack) · React 19 · TypeScript strict · Tailwind 4 ·
Recharts 3 · KaTeX · Vitest 5. Private repo: `DanelRahmani/EconoSim` (branch `master`).

The governing principle: **the maths shown is the maths executed.** Every model records its
own `CalcStep[]` as it computes, and the expression AST that renders LaTeX is the same one
that evaluates numerically. Never hand-write an explanation of a calculation.

---

## Commands

```powershell
npm run dev        # localhost:3000, simulator at /simulator
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (Next 16 config, strict react-hooks rules)
npx vitest run     # the whole suite, node environment
npm run build      # production build
```

**PowerShell 5.1 has no `&&`.** Always gate explicitly, or a failing step is ignored and you
commit broken code:

```powershell
npm run typecheck; if ($LASTEXITCODE -ne 0) { throw "typecheck FAILED" }
npm run lint;      if ($LASTEXITCODE -ne 0) { throw "lint FAILED" }
npx vitest run;    if ($LASTEXITCODE -ne 0) { throw "tests FAILED" }
npm run build;     if ($LASTEXITCODE -ne 0) { throw "build FAILED" }
```

---

## Where things live

```
src/lib/econ/            the engine — pure, no React
  types.ts               Economy + every scenario-options interface + validateEconomy
  defaults.ts            defaultEconomy() — the internally consistent baseline
  expr.ts                expression AST: evaluates numerically AND emits LaTeX
  trace.ts               Tracer / CalcStep — records the arithmetic as it runs
  math.ts                solveLinear, rk4, bisection, linspace, clamp, round
  panel.ts               the output types: Panel, ChartSpec, TimeSeriesSpec, TableSpec, Scalar
  registry.ts            RunOptions, DEFAULT_* constants, the MODELS array
  shocks.ts              preset shocks + the user-defined shock builder
  permalink.ts           encode/decode the whole view into ?s=
  glossary.ts            symbol reference shown in the Glossary tab
  models/*.ts            one file per model — 21 of them
  engine.test.ts         the whole suite (108 tests)
src/components/          PanelCard renders any Panel; CurveChart (SVG), TimeSeriesChart (Recharts)
src/app/                 landing page + /simulator
docs/models.md           equations and sign conventions (STALE — see gaps below)
```

Every model is `(economy, runOptions) => Panel[]`. The UI renders panels generically, so a
new model needs no new UI unless it needs its own dials.

### The 21 models

| Group | Models |
| --- | --- |
| Foundations | Cobb-Douglas |
| Long run | Solow-Swan, AK endogenous growth |
| Short run | IS-LM, AD-AS, Zero lower bound |
| Inflation & unemployment | Phillips curve, WS-PS labour market |
| Fiscal & debt | Debt dynamics, Currency crisis |
| Open economy | Mundell-Fleming |
| International macro | Parity conditions, Dornbusch overshooting, External balance, Trade flows, Policy rule |
| Micro | Consumer choice, Competition vs monopoly, Externalities & tax |
| Strategic interaction | Game theory (2×2, four games) |
| Applied scenarios | AI boom |

---

## How to add a model

1. **Write `src/lib/econ/models/yourModel.ts`.** Export a `yourModelCore()` that does the
   maths with a `Tracer`, and a `yourModel(e, opts)` that returns `Panel[]`. Build the
   trace with real `Expr` objects so the working renders itself.
2. **Register it in `registry.ts`** — add to `MODELS` with `id`, `label`, `group`, `blurb`,
   `run`. Group order in the sidebar follows first appearance in the array, so insert it at
   the position you want the group to appear.
3. **Parameters** live in `Economy` (genuine economic structure) and need four touch points:
   `types.ts`, `defaults.ts`, `validateEconomy()` if it needs a range guard, and a `PARAMS`
   entry in `Simulator.tsx` with a `group` that appears in `GROUP_ORDER`.
   **Scenario dials** (hypotheticals, model-specific switches) go in `RunOptions` instead,
   following the `AiOptions` pattern: an interface in `types.ts`, a `DEFAULT_*` in
   `registry.ts`, a control component in `Simulator.tsx`, and an entry in `scenarioControls`.
4. **Test it.** Add a `describe` block to `engine.test.ts`. Assert *identities* where you can
   — the closed form versus the simulated path — rather than hand-computed numbers.
5. **Gate**: typecheck → lint → test → build, then commit.

The "every model runs and produces finite output" test covers new models automatically, so
registering a broken one fails the suite immediately.

---

## Conventions that bite

**Never emit a non-finite `Scalar` or trace value.** That smoke test asserts every scalar and
every `trace` value `Number.isFinite`. If a figure does not exist (no steady state, no mixed
equilibrium, no collapse date), omit the row with a conditional spread and explain in a note
— do not pass `NaN` or `Infinity`.

**The expression AST has no logarithm**, and `pow` of a negative base is not meaningful. If a
step cannot be typeset faithfully, pass `undefined` for the `expr` and put the formula in the
note. Displaying fake maths is worse than displaying none.

**Two guards, two lanes.** `validateEconomy()` checks *ranges* and surfaces a warning banner.
The permalink decoder checks *types and enums* against the real defaults. Do not duplicate
one in the other.

**Lint is strict about hooks.** `react-hooks/set-state-in-effect` and `react-hooks/refs` are
errors. Established patterns: do all `setState` inside `requestAnimationFrame` callbacks (see
`useAnimatedNumber`, `useTweenedEconomy`, and the permalink load in `Simulator`), and read
browser state through a module-level store with `useSyncExternalStore` (`theme-store.ts`,
`presets-store.ts`).

**Recharts specifics.** Do not add its built-in `<Legend>` — there is already an interactive
HTML legend and two legends overlap. Axis ticks bypass the tooltip formatter, so both axes
need `tickFormatter={formatTick}` or you get `10.000000000000002` on the axis. Any custom
tooltip must be in-flow, never absolutely positioned inside the scrolling parameter sidebar,
or it gets clipped.

**Default-economy calibration is interlocked.** `piE = 0.05` (so the Taylor rule gives a
sensible nominal rate and the Phillips model opens on a *disinflation*), and `markup = 0.03`
with `wagePush = 0.02` (so the WS-PS linearisation `(m+z)/γ` lands exactly on `un = 0.05`).
Change one of these and the defaults stop being mutually consistent — check the other models
before moving them.

**`next dev` rewrites `AGENTS.md`.** Leave that file alone; the block is regenerated on every
dev-server start, and removing it just recreates the uncommitted change.

---

## Known gaps — concrete next actions

1. **The permalink does not carry the six new scenario dials.** `SimState` in `permalink.ts`
   still holds only `economy, model, compare, horizon, ai, shocks`. Section A added
   `expectations`, `micro`, `market`, `externality`, `game` and `zlb` to `RunOptions`, so a
   shared link preserves the model and economy but *not* the game choice, the ZLB shock size,
   the expectations regime, or the micro dials. Extend `SimState`, `encodeState`/`decodeState`,
   add sanitisers (bounded numbers, valid enum values), and extend the two permalink tests.
   Small job, and it directly undermines the feature that was just shipped.
2. **`glossary.ts` knows nothing about the new models.** There is no entry for π\*, uₙ, z, m,
   γ, β, the sacrifice ratio, T\*, rₙ, the Lerner index, deadweight loss or MRS. The glossary
   is the app's reference tab, so this is a visible hole.
3. **`README.md` and `docs/models.md` list only the original model set.** The README table
   stops at the International-macro group; `docs/models.md` has headings for Production,
   Solow, IS-LM, AD-AS, MF, parity, external balance, trade flows and Dornbusch only. Both
   need the ten additions, and `docs/models.md` should carry the closed-form results
   (`1/(βθ)`, `(a−c)²/8b`, `x²/(2b)`, `−ln(1−R₀/M)/ln(1+μ)`, `(T−R)/(T−P)`).
4. **Not deployed.** Vercel is still on the original to-do list. `npm run build` is green and
   the app is fully static, so this should be a one-command job — worth doing before the next
   feature round so there is a live link to share.
5. **`docs/data-sources.md`** describes sourcing for a project that deliberately has no data
   sources. Either rewrite it as "why there are no data feeds" or delete it.

---

## Suggested next work, in priority order

**Tier 1 — finish what was started (small, high value)**
- Carry the six scenario dials through the permalink (gap 1).
- Update the glossary, README and `docs/models.md` (gaps 2–3).
- Deploy to Vercel (gap 4).

**Tier 2 — the best teaching payload per line of code**
- **Comparative-statics table.** Re-run each model at ±ε on a chosen parameter and tabulate
  the direction of every endogenous variable — the classic *"G↑ ⇒ Y↑, r↑, I↓"* grid. The
  engine already has `runModel`; this is mostly presentation, and the new `TableSpec` panel
  type makes it nearly free.
- **Parameter sweeps as an axis.** Chart a parameter on the x-axis instead of time or a state
  variable, to answer questions like "which saving rate maximises steady-state consumption?".
  Needs a small generalisation of the chart spec.
- **Export.** CSV of every panel and PNG/SVG of a chart. The ethos is "show the exact
  calculation" — students need to hand the working in.
- **A data-table view behind every chart.** Serves two masters: accessibility (the SVG paths
  currently have no text alternative) and credibility.

**Tier 3 — turns a sandbox into a course companion**
- **Teaching scenario library:** named one-click setups (oil shock 1973, Volcker disinflation,
  ERM 1992, the 2008 lower bound, Japan's 1990s). Mostly configuration and prose now that the
  models exist.
- **Two-economy A/B comparison** (US vs Japan). `mergePanels` already does current-vs-baseline.
- **Prediction mode:** hide a figure, change a parameter, ask the student for the sign before
  revealing it.
- **Lecture mode:** print stylesheet and larger type for projection.

**Deliberately skipped, and why.** No NK DSGE, HANK or search-and-matching models — each is a
project of its own for one insight. No real data feeds — that would break the "no backend,
fully static, no APIs" design. No stochastic simulation — cheap to add, but it contradicts
the exact-arithmetic promise the trace panels make.

---

## Session log

Work in this session, newest first:

- `7592ea5` — **Section A: the ten missing models.** Phillips curve with adaptive vs credible
  expectations (sacrifice ratio `1/(βθ)`, costless when believed), WS-PS labour market
  (derives uₙ, exact solution and linearisation side by side), debt dynamics (`r−g` drift, the
  stabilising primary balance), AK endogenous growth (growth as a policy variable, against
  Solow's exogenous rate), first-generation currency crisis (collapse dated from the credit
  path), zero lower bound (the IS-LM kink, the natural rate going negative, the multiplier
  comparison 2.5 on the floor vs 1.11 off it), consumer choice, competition vs monopoly,
  externalities and the Pigouvian tax, and 2×2 game theory solved generically. Added a
  `TableSpec` panel type and dashed time-series lines. 53 → 108 tests.
  Two mistakes found and fixed on the way: the credible-expectations case was reporting
  adaptive-mode unemployment at impact; and the app claimed the debt ratio *converges* to
  `pb/(r−g)` when in fact that is an unstable knife edge the ratio drifts away from — the
  wording was wrong in `externalBalance.ts` too and is now corrected in both.
- `497cb50` — **Permalink.** The whole view packs into one `?s=` parameter (base64url of
  versioned JSON), with a Share button that also keeps the address bar in step so a refresh
  restores the view. Decoding treats the URL as a trust boundary and validates every field.
- `33d3361` — Rounded chart axis ticks (they were showing raw float noise) and added the AI
  boom substitution scenario.
- `976492a`, `2638068`, `f00a585`, `07c4d20` — Runway design system, dark/light theming with
  no-flash script, motion, saved presets, glossary, the shock builder and the time window.

---

## Open questions for Danel

1. **Is this aimed at one specific course, or is it a general portfolio piece?** If it is
   course-specific, the syllabus should overrule the textbook canon in Tier 3 — it decides
   whether the next additions are more macro, more game theory, or more micro.
2. **Should the default economy stay a stylised "Baseline", or open on a real country?** The
   country presets exist but are not the default.
3. **Is there an intended audience beyond you?** There is no onboarding, no landing-page
   explanation of what the app is for, and no worked examples. If other students will use it,
   that is the gap to close first — not more models.
