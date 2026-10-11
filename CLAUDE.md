# EconoSim — working notes for the next session

_Last updated 2026-10-11 · 21 models · 109 tests · live at <https://econosim.danelrahmani.com>_
_(the session log below carries the commit hashes; `git log` is the truth for HEAD)_

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
  comparativeStatics.ts  sweepPanel() — the "G↑ ⇒ Y↑, r↑, I↓" grid, built from a model's
                         own scalars so it cannot disagree with the panels above it
  glossary.ts            symbol reference shown in the Glossary tab
  models/*.ts            one file per model — 21 of them
  engine.test.ts         the whole suite (114 tests)
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

**A new scenario dial is more than one edit.** Add it to `RunOptions` in `registry.ts` (plus
a `DEFAULT_*` and `DEFAULT_OPTIONS`), to the five touch points in `Simulator.tsx` (the state,
the `options` memo, the apply-on-load effect, the `shareUrl` call, and a control), and to
`SimState` + `encodeState` + `decodeState` in `permalink.ts`. Miss the permalink trio and a
shared link silently drops the dial; miss the control and the dial is unreachable.

**Prefer a dial to a new model when the feature spans every model.** The comparative-statics
panel is one `RunOptions.sweep` field and one appended panel, so it works on all 21 models
with no per-model code. Making it a model in `MODELS` would have needed `registry.ts`
imported from inside a model file — the cycle this codebase already avoids elsewhere.

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

1. ~~**The permalink does not carry the six scenario dials.**~~ **Closed.** `SimState`
   carries all six (`expectations`, `micro`, `market`, `externality`, `game`, `zlb`), and
   each is clamped on the way in to the range its own slider offers — the decoder's
   `bounded()` helper is shared by every dial, so a hand-edited link cannot reach a state
   the UI cannot show. `GAME_IDS` is derived from `GAMES` in `gameTheory.ts` and
   `EXPECTATION_MODES` sits beside the union in `types.ts`, so the guards cannot drift from
   the types they check.
2. ~~**`glossary.ts` knows nothing about the new models.**~~ **Closed.** π*, πᵉ, uₙ, β, θ,
   z, m, γ, the sacrifice ratio, pb, r−g, b*, T*, μ, rₙ, MRS, the Lerner index, deadweight
   loss and the Pigouvian tax are all in, in three new groups, plus the expectations and
   game switches.
3. ~~**`README.md` and `docs/models.md` list only the original model set.**~~ **Closed.**
   Both cover all 21 models; `docs/models.md` carries the closed forms (`1/(βθ)`,
   `(a−c)²/8b`, `x²/(2b)`, `(t−x)²/2b`, `−ln(1−R₀/M)/ln(1+μ)`, `(T−R)/(T−P)`).
4. ~~**Not deployed.**~~ **Closed.** Live at <https://econosim.danelrahmani.com>.
5. `docs/data-sources.md` is **provenance, not a roadmap**: it records where the country
   presets' rounded figures come from and is titled to say so. Nothing to do unless the
   presets are recalibrated, in which case cite the vintage there.

Nothing else is known broken. The next work is new capability, not repair.

---

## Suggested next work, in priority order

**Tier 1 — the best teaching payload per line of code**
- **Parameter sweeps as an axis.** Chart a parameter on the x-axis instead of time or a state
  variable, to answer questions like "which saving rate maximises steady-state consumption?".
  Needs a small generalisation of the chart spec.
- **Export.** CSV of every panel and PNG/SVG of a chart. The ethos is "show the exact
  calculation" — students need to hand the working in.
- **A data-table view behind every chart.** Serves two masters: accessibility (the SVG paths
  currently have no text alternative) and credibility.

**Tier 2 — turns a sandbox into a course companion**
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

- This session — **comparative statics.** A new `RunOptions.sweep` dial appends a panel that
  re-runs the current model 1% either side of one parameter and tabulates every figure the
  model reports against its base, with the direction it moves — the classic
  *"G↑ ⇒ Y↑, r↑, I↓"* grid. It is a dial rather than a model so it works on all 21 models
  with no per-model code and no import cycle. Rows are the model's own scalars, and a nudge
  that would trip a range guard is dropped with a note instead of being clamped, so the
  arrows only ever describe a step that really happened. IS-LM gained an *Investment I*
  scalar — the crowding-out leg the panel was missing, and the one the classic grid needs.
  109 → 114 tests.
- `3009c70` — **the four handoff gaps closed.** The permalink carries all six scenario dials
  (each clamped to its slider's range, with the game list derived from `GAMES` and the
  expectations modes sitting beside their union); the glossary gained three groups covering
  the ten new models; the README table and `docs/models.md` were brought up to 21 models with
  their closed forms; and the app was confirmed live at <https://econosim.danelrahmani.com>.
  Also corrected the external-balance wording in `docs/models.md`, which still described
  `pb/(r−g)` as a steady state. 108 → 109 tests.
- `fdebd03` — the `CLAUDE.md` handoff note itself.
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
