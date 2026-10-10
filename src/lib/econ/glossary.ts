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
    group: "The switches",
    entries: [
      { symbol: "Closed / Open", name: "Openness", meaning: "Closed turns trade off and the open-economy models collapse to plain IS-LM. Open lets the country trade and borrow abroad." },
      { symbol: "Small / Large", name: "Country size", meaning: "Small means perfect capital mobility: the country takes the world interest rate as given (a horizontal BP curve) and its own policies do not move world rates. Large means its borrowing does move the world rate, so the BP curve slopes upward and policy spills over." },
      { symbol: "Floating / Fixed", name: "Exchange-rate regime", meaning: "Floating: the exchange rate adjusts and monetary policy is powerful. Fixed: the peg is held, the money supply adjusts instead, so fiscal policy is powerful and monetary policy loses its independent effect." },
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
