import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const FEATURES = [
  {
    title: "Build an economy",
    body: "Set technology, capital and labour, saving and growth, fiscal and monetary policy, and how open the economy is — or start from a real-country preset.",
  },
  {
    title: "Short and long run",
    body: "Solow-Swan for the long run, IS-LM and AD-AS for the short run, and the dynamics that carry one to the other.",
  },
  {
    title: "Open economy",
    body: "Mundell-Fleming under fixed vs. floating rates, small vs. large countries, plus parity conditions, overshooting, external balance and trade flows.",
  },
  {
    title: "See the maths",
    body: "Every chart comes with the theory and a live, step-by-step trace of the exact calculation the engine ran.",
  },
];

function LogoMark() {
  return (
    <span
      aria-hidden
      className="grid h-8 w-8 place-items-center rounded-[10px] font-mono text-sm font-bold text-accentink accent-glow"
      style={{ background: "linear-gradient(135deg, var(--accent), color-mix(in oklab, var(--gain) 65%, var(--accent)))" }}
    >
      Σ
    </span>
  );
}

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0">
        <div
          className="aurora absolute -left-32 -top-40 h-[30rem] w-[30rem] rounded-full blur-[140px]"
          style={{ background: "color-mix(in oklab, var(--accent) 22%, transparent)" }}
        />
        <div
          className="aurora absolute -top-24 right-[-6rem] h-[26rem] w-[26rem] rounded-full blur-[140px]"
          style={{ background: "color-mix(in oklab, var(--gain) 18%, transparent)", animationDelay: "4s" }}
        />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <span className="text-base font-bold tracking-tight text-ink">EconoSim</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-6 pb-20 pt-10">
        <p className="reveal font-mono text-[0.6875rem] uppercase tracking-[0.2em] text-accent">
          Economics simulator
        </p>
        <h1
          className="reveal mt-4 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight text-ink sm:text-6xl"
          style={{ animationDelay: "60ms" }}
        >
          An economy you can build,{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(100deg, var(--accent), color-mix(in oklab, var(--gain) 80%, var(--accent)))" }}
          >
            shock and understand.
          </span>
        </h1>
        <p
          className="reveal mt-6 max-w-2xl text-lg leading-relaxed text-muted"
          style={{ animationDelay: "120ms" }}
        >
          Choose the parameters, watch the curves and time paths respond, introduce shocks, and open any diagram to
          see the exact calculations behind it. Everything runs in your browser.
        </p>

        <div className="reveal mt-9 flex flex-wrap items-center gap-3" style={{ animationDelay: "180ms" }}>
          <Link
            href="/simulator"
            className="shine relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-accent px-7 text-base font-medium text-accentink accent-glow transition-transform duration-200 hover:-translate-y-0.5"
          >
            Open the simulator →
          </Link>
          <span className="font-mono text-xs text-muted">
            IS-LM · AD-AS · Solow · Mundell-Fleming · Dornbusch
          </span>
        </div>

        <dl className="mt-20 grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="card card-hover reveal p-5"
              style={{ animationDelay: `${240 + i * 70}ms` }}
            >
              <dt className="text-base font-semibold tracking-tight text-ink">{f.title}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-muted">{f.body}</dd>
            </div>
          ))}
        </dl>

        <p className="reveal mt-16 font-mono text-[0.6875rem] text-muted" style={{ animationDelay: "540ms" }}>
          No backend, no database, no accounts — the models are computed in the browser.
        </p>
      </main>
    </div>
  );
}
