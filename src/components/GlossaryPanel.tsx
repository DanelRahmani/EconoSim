import { GLOSSARY } from "@/lib/econ/glossary";
import { MathBlock } from "./math/MathBlock";

/** Reference view: what every symbol and switch in the models means. */
export function GlossaryPanel() {
  return (
    <section className="card reveal p-5">
      <h3 className="text-base font-semibold tracking-tight text-ink">Glossary</h3>
      <p className="mt-1 text-sm text-muted">
        Every symbol and switch used across the models, in plain language. Elsewhere in the app, click the small
        <span className="mx-1 inline-grid h-4 w-4 place-items-center rounded-full border border-hairline align-middle text-[0.5625rem] font-bold text-muted">
          i
        </span>
        next to a control to open a short explanation.
      </p>

      {GLOSSARY.map((group) => (
        <div key={group.group} className="mt-6">
          <div className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted">{group.group}</div>
          <dl className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {group.entries.map((e) => (
              <div
                key={`${group.group}-${e.symbol}`}
                className="glossary-math rounded-xl border border-hairline bg-surface2/50 p-3.5 transition-colors hover:border-accent/40"
              >
                <dt className="flex min-w-0 items-baseline gap-2.5">
                  <span className="shrink-0 text-accent">
                    {e.latex ? <MathBlock latex={e.latex} /> : <span className="font-mono text-sm">{e.symbol}</span>}
                  </span>
                  <span className="text-sm font-semibold tracking-tight text-ink">{e.name}</span>
                </dt>
                <dd className="mt-1.5 text-xs leading-relaxed text-muted">{e.meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}
