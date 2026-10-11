/**
 * A plain-language reference for the symbols and switches used across the
 * models. Shown in the Glossary view and reused for hover explanations.
 */

export interface GlossaryEntry {
  symbol: string;
  latex?: string;
  name: string;
  meaning: string;
}

export interface GlossaryGroup {
  group: string;
  entries: GlossaryEntry[];
}

export const GLOSSARY: GlossaryGroup[] = [
  {
    group: "Output and income",
    entries: [
      { symbol: "Y", latex: "Y", name: "Output / income", meaning: "Real GDP: the total value of everything produced in the economy, which also equals total income earned." },
      { symbol: "y", latex: "y", name: "Output per worker", meaning: "Y divided by labour L. What the average worker produces." },
      { symbol: "Yn", latex: "Y_{n}", name: "Natural (potential) output", meaning: "What the economy produces when it is at its long-run trend, with no output gap. Comes from the Solow steady state." },
      { symbol: "ŷ", latex: "\\hat{y}", name: "Output per effective worker", meaning: "Output per unit of effective labour — used in the Solow model so growth in technology doesn't distort the picture." },
    ],
  },
  {
    group: "Production",
    entries: [
      { symbol: "A", latex: "A", name: "Technology (TFP)", meaning: "Total factor productivity — how much output you get from a given amount of capital and labour. A higher A shifts production up and raises potential output." },
      { symbol: "K", latex: "K", name: "Capital", meaning: "Machines, buildings, equipment and infrastructure used in production." },
      { symbol: "L", latex: "L", name: "Labour", meaning: "The workforce." },
      { symbol: "α", latex: "\\alpha", name: "Capital share", meaning: "The fraction of income that goes to capital (typically about 0.33). The remaining 1−α goes to labour. It also controls how quickly returns to capital diminish." },
      { symbol: "k̂", latex: "\\hat{k}", name: "Capital per effective worker", meaning: "K divided by (A·L) — the capital intensity the Solow model tracks over time." },
    ],
  },
  {
    group: "Rates and money",
    entries: [
      { symbol: "r", latex: "r", name: "Interest rate", meaning: "The domestic interest rate, set where the goods market (IS) and money market (LM) agree." },
      { symbol: "r*", latex: "r^{*}", name: "World interest rate", meaning: "The rate prevailing in world markets. A small open economy takes it as given." },
      { symbol: "rₙ", latex: "r_{n}", name: "Natural rate of interest", meaning: "The real policy rate that would hold output at potential with inflation stable. If a big enough demand shock pushes it below zero, the policy rate cannot follow and the economy hits the zero lower bound." },
      { symbol: "ρ", latex: "\\rho", name: "Risk premium", meaning: "An extra yield investors demand to hold a country's assets, above the world rate. Emerging markets typically pay a positive premium." },
      { symbol: "M", latex: "M", name: "Money supply", meaning: "The quantity of money the central bank has put into circulation." },
      { symbol: "P", latex: "P", name: "Price level", meaning: "Average prices. Real money balances are M/P." },
      { symbol: "π", latex: "\\pi", name: "Inflation", meaning: "The percentage change in the price level." },
      { symbol: "s", latex: "s", name: "Saving rate", meaning: "The share of income households save. Higher s builds more capital but does not raise long-run growth per worker." },
      { symbol: "δ", latex: "\\delta", name: "Depreciation", meaning: "The share of capital that wears out each period." },
      { symbol: "n", latex: "n", name: "Population growth", meaning: "How fast the workforce grows." },
      { symbol: "g", latex: "g", name: "Technological growth", meaning: "How fast productivity improves. Together with n and δ it sets break-even investment." },
    ],
  },
  {
    group: "Inflation and unemployment",
    entries: [
      { symbol: "π*", latex: "\\pi^{*}", name: "Inflation target", meaning: "The central bank's goal for inflation. The Phillips-curve panel is a disinflation from the rate now in place down to this target." },
      { symbol: "πᵉ", latex: "\\pi^{e}", name: "Expected inflation", meaning: "What firms and workers expect prices to do, and what they set wages and prices on. It is the expectations term of the Phillips curve — moveable at once by a credible announcement, and hardly at all by a decree." },
      { symbol: "uₙ", latex: "u_{n}", name: "Natural rate of unemployment", meaning: "The unemployment rate at which inflation neither rises nor falls. It is where the wage-setting and price-setting curves cross, so it follows from bargaining power and the mark-up, not from policy." },
      { symbol: "β", latex: "\\beta", name: "Phillips-curve slope", meaning: "How many points of inflation a one-point rise in unemployment above its natural rate buys. A larger β means the same disinflation costs less unemployment." },
      { symbol: "θ", latex: "\\theta", name: "Speed of expectations", meaning: "How much of the gap between actual and expected inflation people close each period. A larger θ means expectations catch up sooner, so the disinflation is over faster." },
      { symbol: "z", latex: "z", name: "Wage pressure", meaning: "Everything besides unemployment that strengthens workers' bargaining position — unemployment benefits, union strength, a minimum wage. A higher z shifts wage setting up and raises the natural rate." },
      { symbol: "m", latex: "m", name: "Firm's mark-up", meaning: "The margin firms charge over marginal cost. It fixes the real wage they can afford to pay (1/(1+m)), so a higher mark-up pushes the natural rate up." },
      { symbol: "γ", latex: "\\gamma", name: "Wage-setting slope", meaning: "How sharply the real wage workers can win falls as unemployment rises. The textbook natural rate is (m + z)/γ — an approximation to the exact WS = PS solution, which the model also reports." },
      { symbol: "Sacrifice ratio", latex: "1/(\\beta\\theta)", name: "Sacrifice ratio", meaning: "The excess unemployment, summed over the whole adjustment, needed to bring inflation down by one percentage point. Under adaptive expectations it is 1/(βθ); if the announcement is believed it is exactly zero." },
    ],
  },
  {
    group: "Fiscal and debt",
    entries: [
      { symbol: "pb", latex: "pb", name: "Primary balance", meaning: "The budget balance excluding interest payments, as a share of GDP. It is the only lever that offsets the snowball effect of existing debt." },
      { symbol: "r − g", latex: "r - g", name: "Interest–growth differential", meaning: "The snowball: when r exceeds g, existing debt grows faster than GDP and the ratio rises unless the primary balance covers the difference. When g exceeds r, debt melts away on its own." },
      { symbol: "b*", latex: "b^{*}", name: "Debt ratio that stays put", meaning: "The debt ratio where the primary balance exactly covers the snowball, so Δb = 0. With r > g it is an unstable knife edge — debt drifts away from it in both directions — so it is a dividing line, not a level the economy returns to." },
      { symbol: "T*", latex: "T^{*}", name: "Collapse date", meaning: "In the currency-crisis model, the period the peg breaks. Reserves shrink as the central bank sells them to defend the rate against a growing deficit, and the peg fails once they run out." },
      { symbol: "μ", latex: "\\mu", name: "Credit growth", meaning: "How fast domestic credit — financed by printing money — grows each period. The collapse date is T* = −ln(1 − R₀/M)/ln(1 + μ), so faster credit growth brings the crisis forward." },
    ],
  },
  {
    group: "Open economy",
    entries: [
      { symbol: "ε", latex: "\\varepsilon", name: "Real exchange rate", meaning: "The price of domestic goods relative to foreign goods. A rise is an appreciation, which reduces net exports." },
      { symbol: "q", latex: "q", name: "Real exchange rate (parity view)", meaning: "q = S·P*/P — the same idea expressed with the nominal rate S and price levels." },
      { symbol: "NX", latex: "NX", name: "Net exports", meaning: "Exports minus imports — the trade balance." },
      { symbol: "CA", latex: "CA", name: "Current account", meaning: "National saving minus investment. A surplus builds foreign assets, a deficit builds debt." },
      { symbol: "S−I", latex: "S - I", name: "Saving minus investment", meaning: "The identity behind the current account: what the country saves beyond what it invests is lent abroad." },
    ],
  },
  {
    group: "Micro",
    entries: [
      { symbol: "MRS", latex: "MRS", name: "Marginal rate of substitution", meaning: "How much of the good on the vertical axis the consumer will give up for one more unit of the horizontal one. At the optimum it equals the price ratio pₓ/p_y — if it did not, trading along the budget line would do better." },
      { symbol: "Lerner index", latex: "(P - MC)/P", name: "Lerner index", meaning: "Mark-up expressed as a share of price. It is zero under perfect competition and rises with market power; with linear demand it works out to (a − c)/(a + c)." },
      { symbol: "Deadweight loss", name: "Deadweight loss", meaning: "Surplus destroyed rather than merely transferred: the value of the units that would have been produced at marginal cost but are not. Under monopoly it is the triangle (a − c)²/8b." },
      { symbol: "Pigouvian tax", name: "Pigouvian tax", meaning: "A tax per unit set exactly equal to the marginal external cost, so private cost is raised to social cost and the market produces the efficient quantity. Set it either side of that and some deadweight loss remains." },
    ],
  },
  {
    group: "The switches",
    entries: [
      { symbol: "Closed / Open", name: "Openness", meaning: "Closed turns trade off and the open-economy models collapse to plain IS-LM. Open lets the country trade and borrow abroad." },
      { symbol: "Small / Large", name: "Country size", meaning: "Small means perfect capital mobility: the country takes the world interest rate as given (a horizontal BP curve) and its own policies do not move world rates. Large means its borrowing does move the world rate, so the BP curve slopes upward and policy spills over." },
      { symbol: "Floating / Fixed", name: "Exchange-rate regime", meaning: "Floating: the exchange rate adjusts and monetary policy is powerful. Fixed: the peg is held, the money supply adjusts instead, so fiscal policy is powerful and monetary policy loses its independent effect." },
      { symbol: "Adaptive / Credible", name: "Expectations regime", meaning: "How expectations behave when the central bank disinflates. Adaptive: people learn from realised inflation, so unemployment has to rise above its natural rate and the sacrifice ratio is 1/(βθ). Credible: the announcement is believed at once, expectations jump to the target, and the disinflation costs nothing — the Lucas-critique lesson." },
      { symbol: "Prisoner's dilemma / Coordination / Chicken / Matching pennies", name: "Which 2×2 game", meaning: "The payoffs of all four games are solved generically, so the panel reports dominant strategies, Nash equilibria and whether the dilemma is real for whichever one is chosen." },
      { symbol: "Y = A·Kᵅ·L¹⁻ᵅ", latex: "Y = A\\,K^{\\alpha}L^{1-\\alpha}", name: "Cobb-Douglas production", meaning: "The production function everything builds on. Notice α is the 'technology share' of capital: it says how much of income capital earns." },
      { symbol: "Golden rule", name: "Golden rule", meaning: "The saving rate that maximises long-run consumption — it happens exactly where s = α." },
      { symbol: "Marshall-Lerner", name: "Marshall-Lerner condition", meaning: "A depreciation improves the trade balance only if the export and import price elasticities sum to more than one." },
      { symbol: "Overshooting", name: "Dornbusch overshooting", meaning: "Because prices are sticky, a money shock pushes the exchange rate past its long-run value before it comes back." },
    ],
  },
];

export const GLOSSARY_ENTRIES: GlossaryEntry[] = GLOSSARY.flatMap((g) => g.entries);

export function lookup(symbol: string): GlossaryEntry | undefined {
  return GLOSSARY_ENTRIES.find((e) => e.symbol === symbol);
}
