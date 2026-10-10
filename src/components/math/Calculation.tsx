import type { CalcStep } from "@/lib/econ/trace";
import { renderStep } from "@/lib/econ/trace";
import { fmtNum } from "@/lib/format";
import { MathBlock } from "./MathBlock";

/**
 * The "Show the calculation" block. Renders the engine's recorded steps —
 * the symbolic form, the same expression with your values substituted, and the
 * result — inside a native <details> disclosure.
 */
export function Calculation({ steps }: { steps: CalcStep[] }) {
  if (!steps.length) return null;
  const rendered = steps.map(renderStep);
  return (
    <details className="calc-math group mt-4 rounded-xl border border-hairline bg-surface2/50">
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-3.5 py-3 text-sm font-medium text-ink marker:content-none">
        <span aria-hidden className="text-accent transition-transform duration-300 group-open:rotate-90">
          ▶
        </span>
        Show the calculation
        <span className="font-mono text-[0.6875rem] font-normal text-muted">{steps.length} steps</span>
      </summary>
      <ol className="space-y-4 px-3.5 pb-4 pt-1">
        {rendered.map((s, i) => (
          <li key={i} className="border-l-2 border-accent/30 pl-3.5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[0.6875rem] text-accent">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm font-medium text-ink">{s.label}</span>
            </div>
            {s.symbolic && (
              <div className="my-1.5 overflow-x-auto text-ink/90">
                <MathBlock latex={s.symbolic} />
              </div>
            )}
            {s.substituted && s.substituted !== s.symbolic && (
              <div className="my-1.5 overflow-x-auto text-muted">
                <span className="mr-1 text-sm">=</span>
                <MathBlock latex={s.substituted} />
              </div>
            )}
            <div className="mt-1.5 inline-flex rounded-md bg-gain/10 px-2 py-0.5 font-mono text-[0.8125rem] text-gain">
              = {fmtNum(s.value, 4)}
            </div>
            {s.note && <div className="mt-1.5 text-xs leading-relaxed text-muted">{s.note}</div>}
          </li>
        ))}
      </ol>
    </details>
  );
}
