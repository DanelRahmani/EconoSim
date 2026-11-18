import { mul, num, v } from "../expr";
import type { Economy, GameOptions } from "../types";
import type { Panel, TableCell } from "../panel";
import { Tracer, type CalcStep } from "../trace";
import { linspace } from "../math";

/**
 * 2×2 games: dominance, best responses and Nash equilibrium.
 *
 * `payoff[row][col] = [rowPlayerPayoff, colPlayerPayoff]`. Everything the panel
 * reports is computed from that matrix rather than written down per game, so the
 * same code answers "is defecting dominant?" for every game it can be asked:
 *
 *  - a strategy is a best response if nothing else does strictly better against
 *    the same opponent choice (ties count, so weak best responses are picked up);
 *  - a cell is a Nash equilibrium if both players are best-responding in it;
 *  - the mixed equilibrium comes from making each player indifferent. It is only
 *    reported when the resulting probability is strictly interior, which is why
 *    the prisoner's dilemma — with a dominant strategy — has none.
 *
 * The temptation payoff is the dial that turns mutual cooperation from a Nash
 * equilibrium (low temptation) into a dilemma (high temptation).
 */

/** `payoff[row][col] = [rowPlayerPayoff, colPlayerPayoff]`. */
type Payoffs = [
  [[number, number], [number, number]],
  [[number, number], [number, number]],
];

export interface GameDef {
  id: GameOptions["game"];
  label: string;
  blurb: string;
  rows: [string, string];
  cols: [string, string];
  payoff: (m: GameOptions) => Payoffs;
}

export const GAMES: GameDef[] = [
  {
    id: "prisoners",
    label: "Prisoner's dilemma",
    blurb: "Two firms choose whether to keep a price agreement. Defecting always pays more, however the other behaves.",
    rows: ["Cooperate", "Defect"],
    cols: ["Cooperate", "Defect"],
    // [C,C] = 3 each; defecting against a cooperator yields the temptation;
    // mutual defection is worse for both than mutual cooperation.
    payoff: (m) => [
      [
        [3, 3],
        [0, m.temptation],
      ],
      [
        [m.temptation, 0],
        [1, 1],
      ],
    ],
  },
  {
    id: "coordination",
    label: "Coordination",
    blurb: "Two firms choose a standard. Both prefer to match, and both prefer the same standard, so there are two equilibria.",
    rows: ["Standard A", "Standard B"],
    cols: ["Standard A", "Standard B"],
    payoff: () => [
      [
        [2, 2],
        [0, 0],
      ],
      [
        [0, 0],
        [1, 1],
      ],
    ],
  },
  {
    id: "chicken",
    label: "Game of chicken",
    blurb: "Two drivers approach head-on. Swerving is the safe choice; being the one who does not swerve is the best outcome, and neither swerving is the worst.",
    rows: ["Swerve", "Straight"],
    cols: ["Swerve", "Straight"],
    payoff: () => [
      [
        [3, 3],
        [2, 4],
      ],
      [
        [4, 2],
        [0, 0],
      ],
    ],
  },
  {
    id: "matching",
    label: "Matching pennies",
    blurb: "A zero-sum game: one player wins exactly what the other loses, and any predictable choice loses. There is no pure-strategy equilibrium at all.",
    rows: ["Heads", "Tails"],
    cols: ["Heads", "Tails"],
    payoff: () => [
      [
        [1, -1],
        [-1, 1],
      ],
      [
        [-1, 1],
        [1, -1],
      ],
    ],
  },
];

export function findGame(id: GameOptions["game"]): GameDef {
  return GAMES.find((g) => g.id === id) ?? GAMES[0];
}

export interface GameCore {
  def: GameDef;
  payoff: Payoffs;
  /** bestResponseRow[col] = rows that are a best reply to that column. */
  bestResponseRow: [boolean, boolean][];
  /** bestResponseCol[row] = columns that are a best reply to that row. */
  bestResponseCol: [boolean, boolean][];
  nash: [boolean, boolean][];
  nashCount: number;
  /** Dominant strategies, if any. */
  rowDominant: 0 | 1 | null;
  colDominant: 0 | 1 | null;
  /** Mixed equilibrium: probability the row player picks row 0, and the column player col 0. */
  mixed: { p: number; q: number; payoffs: [number, number] } | null;
  /** Payoff to the row player at the (first) pure equilibrium. */
  /** Payoffs in the equilibrium, when there is exactly one (pure, or else mixed). */
  equilibriumPayoff: [number, number] | null;
  /** Joint payoff lost when both defect instead of cooperating — prisoner's dilemma only. */
  dilemmaCost: number | null;
  /** Discount factor from which cooperation is sustainable in the repeated game. */
  cooperationThreshold: number | null;
  trace: CalcStep[];
}

export function gameCore(m: GameOptions): GameCore {
  const t = new Tracer();
  const def = findGame(m.game);
  const payoff = def.payoff(m);

  const bestResponseRow: [boolean, boolean][] = [false, false].map((_, j) => [
    payoff[0][j][0] >= payoff[1][j][0],
    payoff[1][j][0] >= payoff[0][j][0],
  ]) as [boolean, boolean][];
  const bestResponseCol: [boolean, boolean][] = [false, false].map((_, i) => [
    payoff[i][0][1] >= payoff[i][1][1],
    payoff[i][1][1] >= payoff[i][0][1],
  ]) as [boolean, boolean][];

  const nash: [boolean, boolean][] = [false, false].map((_, i) => [
    bestResponseRow[0][i] && bestResponseCol[i][0],
    bestResponseRow[1][i] && bestResponseCol[i][1],
  ]) as [boolean, boolean][];
  const nashCount = nash.flat().filter(Boolean).length;

  // Dominance: a strategy is dominant if it is a best response to *both* of the
  // opponent's pure choices and the opponent's choices differ in payoff to it.
  const rowIsDominant = (i: 0 | 1) => bestResponseRow[0][i] && bestResponseRow[1][i];
  const colIsDominant = (j: 0 | 1) => bestResponseCol[0][j] && bestResponseCol[1][j];
  const rowDominated = ([0, 1] as const).filter(rowIsDominant);
  const colDominated = ([0, 1] as const).filter(colIsDominant);
  const rowDominant = rowDominated.length === 1 && payoff[0][0][0] !== payoff[1][0][0] ? rowDominated[0] : null;
  const colDominant = colDominated.length === 1 && payoff[0][0][1] !== payoff[0][1][1] ? colDominated[0] : null;

  // Mixed equilibrium: make each player indifferent between their two choices.
  const b = (i: number, j: number) => payoff[i][j][0];
  const a = (i: number, j: number) => payoff[i][j][1];
  const d1 = b(0, 0) - b(0, 1) - b(1, 0) + b(1, 1);
  const d2 = a(0, 0) - a(1, 0) - a(0, 1) + a(1, 1);
  let mixed: GameCore["mixed"] = null;
  if (Math.abs(d1) > 1e-12 && Math.abs(d2) > 1e-12) {
    const q = (b(1, 1) - b(0, 1)) / d1;
    const p = (a(1, 1) - a(1, 0)) / d2;
    if (p > 1e-9 && p < 1 - 1e-9 && q > 1e-9 && q < 1 - 1e-9) {
      // Expected payoffs under the mixed profile.
      const rowPayoff = q * b(0, 0) + (1 - q) * b(0, 1);
      const colPayoff = p * a(0, 0) + (1 - p) * a(1, 0);
      mixed = { p, q, payoffs: [rowPayoff, colPayoff] };
    }
  }

  const firstNash: [number, number] = nash[0][0]
    ? [0, 0]
    : nash[0][1]
      ? [0, 1]
      : nash[1][0]
        ? [1, 0]
        : [1, 1];
  // A single equilibrium has one payoff. With two pure equilibria there is no
  // single answer (the model cannot say which one is played), so none is
  // reported; with none, the mixed equilibrium's expected payoffs are.
  const equilibriumPayoff: [number, number] | null =
    nashCount === 1 ? payoff[firstNash[0]][firstNash[1]] : nashCount === 0 && mixed ? mixed.payoffs : null;

  // Prisoner's dilemma extras.
  const isPd = def.id === "prisoners";
  const r = payoff[0][0][0];
  const pDefect = payoff[1][1][0];
  const temptation = payoff[0][1][1];
  const dilemmaCost = isPd ? 2 * (r - pDefect) : null;
  const cooperationThreshold =
    isPd && temptation > r && r > pDefect ? (temptation - r) / (temptation - pDefect) : null;

  t.step(
    "Joint payoff if both cooperate",
    2 * r,
    mul(num(2), v("R")),
    { R: r },
    "Written down for comparison with the equilibrium below",
  );
  if (equilibriumPayoff) t.step("Joint payoff in equilibrium", equilibriumPayoff[0] + equilibriumPayoff[1]);

  return {
    def,
    payoff,
    bestResponseRow,
    bestResponseCol,
    nash,
    nashCount,
    rowDominant,
    colDominant,
    mixed,
    equilibriumPayoff,
    dilemmaCost,
    cooperationThreshold,
    trace: t.steps,
  };
}

export function gameTheory(_e: Economy, m: GameOptions): Panel[] {
  const core = gameCore(m);
  const { def, payoff } = core;

  const cells: TableCell[][] = [0, 1].map((i) =>
    [0, 1].map((j) => ({
      text: `${payoff[i][j][0]}, ${payoff[i][j][1]}`,
      // Each payoff is underlined where it is that player's best response to the
      // other's choice; a cell with both underlined is a Nash equilibrium.
      parts: [
        { text: String(payoff[i][j][0]), underline: core.bestResponseRow[j][i] },
        { text: ", " },
        { text: String(payoff[i][j][1]), underline: core.bestResponseCol[i][j] },
      ],
      emphasis: core.nash[i][j],
    })),
  );

  const qRange = linspace(0, 1, 60);
  const b = (i: number, j: number) => payoff[i][j][0];
  const rowPayoff = (i: number, q: number) => q * b(i, 0) + (1 - q) * b(i, 1);

  const markers = core.mixed
    ? [{ x: core.mixed.q * 100, y: rowPayoff(0, core.mixed.q), label: "mixed" }]
    : [];

  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  // The row player's two payoff lines, at q = 0 and q = 1.
  const gap0 = b(0, 1) - b(1, 1);
  const gap1 = b(0, 0) - b(1, 0);
  const minGap = Math.min(Math.abs(gap0), Math.abs(gap1));
  const crossesInside = gap0 * gap1 < 0;
  const qCross = crossesInside ? gap0 / (gap0 - gap1) : 0;

  return [
    {
      id: "game-matrix",
      title: def.label,
      description: def.blurb,
      table: {
        columns: [def.cols[0], def.cols[1]],
        rows: [
          { label: def.rows[0], cells: cells[0] },
          { label: def.rows[1], cells: cells[1] },
        ],
        caption:
          "Each cell shows (row player's payoff, column player's payoff). A payoff is underlined when it is that player's best response to the other's choice; a cell with both underlined (tinted) is a Nash equilibrium.",
      },
      scalars: [
        {
          label: "Number of pure Nash equilibria",
          value: core.nashCount,
          hint: "How many cells of the matrix are Nash equilibria. They are the tinted cells above.",
        },
        ...(core.mixed
          ? [
              {
                label: `Mixed equilibrium: ${def.rows[0]}`,
                value: core.mixed.p,
                hint: "The probability that makes the other player indifferent",
              },
              { label: `Mixed equilibrium: ${def.cols[0]}`, value: core.mixed.q },
            ]
          : []),
        ...(core.equilibriumPayoff
          ? [
              {
                label: core.nashCount === 1 ? "Row player's equilibrium payoff" : "Row player's expected payoff (mixed)",
                value: core.equilibriumPayoff[0],
              },
              {
                label: core.nashCount === 1 ? "Column player's equilibrium payoff" : "Column player's expected payoff (mixed)",
                value: core.equilibriumPayoff[1],
              },
            ]
          : []),
        ...(core.dilemmaCost !== null
          ? [
              {
                label: "Joint payoff lost to the dilemma",
                value: core.dilemmaCost,
                hint: "What both players would gain together by cooperating, and what neither can reach on their own",
              },
            ]
          : []),
        ...(core.cooperationThreshold !== null
          ? [
              {
                label: "Discount factor needed for cooperation",
                value: core.cooperationThreshold,
                hint: "(T − R)/(T − P): in a repeated game, with enough patience, cooperation becomes an equilibrium",
              },
            ]
          : []),
      ],
      notes: [
        core.rowDominant !== null
          ? `${def.rows[core.rowDominant]} is a dominant strategy for the row player: it pays more whatever the other player does.`
          : `${def.rows[0]} and ${def.rows[1]} are both best responses sometimes, so neither dominates.`,
        core.colDominant !== null
          ? `${def.cols[core.colDominant]} is dominant for the column player.`
          : `Neither column choice is dominant.`,
        core.nashCount === 1
          ? "One Nash equilibrium. Play it and neither player has a reason to move, which is exactly what makes it self-enforcing, and also why it can be the bad outcome."
          : core.nashCount === 2
            ? "Two pure equilibria. Both are stable, so this game has an equilibrium-selection problem: conventions, history and expectations decide which one a market lands on. A one-shot payoff matrix cannot say which."
            : "No pure equilibrium. Any predictable choice can be exploited, so the only equilibrium is to randomise.",
        core.cooperationThreshold !== null
          ? `In a single play defecting is a dominant strategy, so cooperation is unreachable in the one-shot game. But if the game repeats indefinitely and players are patient enough (a discount factor of at least ${core.cooperationThreshold.toFixed(3)} here), cooperation becomes an equilibrium: the threat of future punishment is worth more than today's temptation.`
          : "The honest caveat: Nash equilibrium is a solution concept, not a prediction. It says nothing about how players get there, and in games with two equilibria it does not say which one a market chooses.",
      ],
      trace: core.trace,
    },
    {
      id: "game-best-response",
      title: `The row player's payoff against the column player's mixing`,
      description: `What the row player earns from each of their strategies, as the column player becomes more likely to play "${def.cols[0]}". Where the two lines cross, the row player is indifferent: the point that pins down the column player's equilibrium mixing probability.`,
      chart: {
        xLabel: `Probability the column player plays "${def.cols[0]}" (%)`,
        yLabel: "Row player's expected payoff",
        series: [
          {
            label: `Payoff from "${def.rows[0]}"`,
            points: qRange.map((q) => ({ x: q * 100, y: rowPayoff(0, q) })),
          },
          {
            label: `Payoff from "${def.rows[1]}"`,
            points: qRange.map((q) => ({ x: q * 100, y: rowPayoff(1, q) })),
            dashed: true,
          },
        ],
        markers,
        xBounds: [0, 100],
      },
      scalars: [
        ...(core.mixed
          ? [
              {
                label: "Lines cross at",
                value: core.mixed.q,
                hint: "Where the row player is indifferent: the column player's equilibrium mix",
              },
              { label: "Payoff at the crossing", value: core.mixed.payoffs[0] },
            ]
          : [
              {
                label: "Smallest gap between the lines",
                value: minGap,
                hint: "The lines are straight, so the smallest gap is at one end: q = 0 or q = 100%",
              },
            ]),
      ],
      notes: [
        core.mixed
          ? `The lines cross at ${pct(core.mixed.q)}. That is the column player's equilibrium mixture: any more or less of "${def.cols[0]}" and the row player would switch, and the column player's own payoff would fall.`
          : crossesInside
            ? `The row player's lines cross at ${pct(qCross)}, but the column player has a dominant strategy, so it never mixes and there is no mixed equilibrium.`
            : "The lines never cross: one of the row player's strategies is better whatever the column player does, so there is nothing to mix about.",
      ],
      trace: [],
    },
  ];
}
