# Country preset sources

The presets are **stylised approximations, not precise calibrations**. They are starting
points meant to be edited. Values are rounded from public macro datasets in the style of:

- **World Bank** — gross capital formation (% of GDP) for the saving rate; population
  growth; GDP growth.
- **Penn World Table (PWT)** — capital share and TFP-growth style parameters.
- **AMECO / OECD** — European aggregates.

The monetary variables (`M`, `P`, `k`, `h`) are **not** country data — they default to
indexed values so every preset starts internally consistent.

| Country | α | s | n | g | δ | Size | Regime | r* | ρ |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| United States | 0.33 | 0.21 | 0.5% | 1.5% | 5% | large | floating | 2% | 0 |
| Germany | 0.33 | 0.22 | 0.0% | 1.2% | 5% | small | floating | 2% | 0 |
| Japan | 0.35 | 0.26 | −0.5% | 1.0% | 5% | large | floating | 1% | 0.5% |
| Netherlands | 0.32 | 0.21 | 0.4% | 1.3% | 5% | small | floating | 2% | 0.2% |
| Switzerland | 0.32 | 0.26 | 0.7% | 1.1% | 5% | small | floating | 1% | 0 |
| Singapore | 0.34 | 0.30 | 0.7% | 2.0% | 5% | small | floating | 2% | 0.3% |
| China | 0.40 | 0.43 | 0.2% | 3.0% | 5% | large | fixed | 3% | 1.0% |
| India | 0.38 | 0.31 | 0.9% | 3.0% | 5% | large | floating | 4% | 2.5% |
| Brazil | 0.38 | 0.18 | 0.5% | 1.0% | 5% | large | floating | 4% | 4.0% |
| Saudi Arabia | 0.42 | 0.30 | 1.5% | 2.0% | 5% | small | fixed | 4% | 1.5% |

If you need defensible figures for a specific year, replace the values in
`src/lib/econ/countries.ts` and cite the vintage here.
