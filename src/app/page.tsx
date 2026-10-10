import Link from "next/link";

const FEATURES = [
  { title: "Build an economy", body: "Set technology, capital and labour, saving and growth, fiscal and monetary policy, and how open the economy is — or start from a real-country preset." },
  { title: "Short and long run", body: "Solow-Swan for the long run, IS-LM and AD-AS for the short run, and the dynamics that carry one to the other." },
  { title: "Open economy", body: "Mundell-Fleming under fixed vs. floating rates, small vs. large countries, plus parity conditions, overshooting, external balance and trade flows." },
  { title: "See the maths", body: "Every chart comes with the theory and a live, step-by-step trace of the exact calculation the engine ran." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto w-full max-w-5xl px-6 py-16">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-600">EconoSim</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          An economics simulator you can build an economy in.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
          Choose the parameters, watch the curves and time paths respond, introduce shocks, and open any
          diagram to see the exact calculations behind it. Everything runs in your browser.
        </p>

        <div className="mt-8">
          <Link
            href="/simulator"
            className="inline-flex h-12 items-center justify-center rounded-full bg-blue-600 px-7 text-base font-medium text-white transition-colors hover:bg-blue-700"
          >
            Open the simulator →
          </Link>
        </div>

        <dl className="mt-16 grid gap-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-5">
              <dt className="text-base font-semibold">{f.title}</dt>
              <dd className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{f.body}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-12 text-xs text-neutral-500">
          No backend, no database, no accounts — the models are computed in the browser.
        </p>
      </main>
    </div>
  );
}
