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
    <details className="group mt-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-900/40">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 marker:content-none">
        <span className="inline-flex items-center gap-2">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Show the calculation
          <span className="text-xs font-normal text-neutral-500">({steps.length} steps)</span>
        </span>
      </summary>
      <ol className="px-3 pb-3 pt-1 space-y-3">
        {rendered.map((s, i) => (
          <li key={i} className="text-sm border-l-2 border-neutral-300 dark:border-neutral-700 pl-3">
            <div className="font-medium text-neutral-800 dark:text-neutral-200">{s.label}</div>
            {s.symbolic && (
              <div className="my-1 text-neutral-700 dark:text-neutral-300 overflow-x-auto">
                <MathBlock latex={s.symbolic} />
              </div>
            )}
            {s.substituted && s.substituted !== s.symbolic && (
              <div className="my-1 text-neutral-600 dark:text-neutral-400 overflow-x-auto">
                <span className="text-xs mr-1">=</span>
                <MathBlock latex={s.substituted} />
              </div>
            )}
            <div className="mt-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-400">
              = {fmtNum(s.value, 4)}
            </div>
            {s.note && <div className="mt-0.5 text-xs text-neutral-500">{s.note}</div>}
          </li>
        ))}
      </ol>
    </details>
  );
}
