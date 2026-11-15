import Link from "next/link";
import { HeroChart } from "@/components/HeroChart";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Wordmark } from "@/components/ui/Wordmark";

const FEATURES = [
  {
    kicker: "Construct",
    title: "Build an economy",
    body: "Set technology, capital and labour, saving and growth, fiscal and monetary policy, and how open the economy is. Or start from a real-country preset.",
  },
  {
    kicker: "Solow, IS-LM, AD-AS",
    title: "Short and long run",
    body: "Solow-Swan for the long run, IS-LM and AD-AS for the short run, and the dynamics that carry one to the other.",
  },
  {
    kicker: "Mundell-Fleming, Dornbusch",
    title: "Open economy",
    body: "Mundell-Fleming under fixed vs. floating rates, small vs. large countries, plus parity conditions, overshooting, external balance and trade flows.",
  },
  {
    kicker: "Trace",
    title: "See the maths",
    body: "Every chart comes with the theory and a live, step-by-step trace of the exact calculation the engine ran.",
  },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      {/* The one gradient the system allows: a faint radial tint behind the hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[36rem]"
        style={{ background: "radial-gradient(60% 55% at 20% 0%, var(--tint), transparent 70%)" }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
        <Wordmark />
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-12 sm:px-6">
        <p className="reveal font-mono text-[0.8125rem] text-muted">An economics simulator</p>
        <h1
          className="reveal mt-4 max-w-3xl font-display text-[2.75rem] font-normal leading-[1.08] tracking-[-0.02em] text-ink sm:text-[4rem]"
          style={{ animationDelay: "60ms" }}
        >
          An economy you can build, <em className="text-accent">shock and understand.</em>
        </h1>
        <p
          className="reveal mt-6 max-w-2xl text-base leading-7 text-muted"
          style={{ animationDelay: "120ms" }}
        >
          Choose the parameters, watch the curves and time paths respond, introduce shocks, and open any diagram to
          see the exact calculations behind it. Everything runs in your browser.
        </p>

        <div className="reveal mt-9 flex flex-wrap items-center gap-4" style={{ animationDelay: "180ms" }}>
          <Link
            href="/simulator"
            className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-accentink transition-colors duration-200 hover:bg-accenthover"
          >
            Open the simulator
          </Link>
          <span className="font-mono text-[0.8125rem] text-muted">
            IS-LM · AD-AS · Solow · Mundell-Fleming · Dornbusch
          </span>
        </div>

        <div className="reveal mt-14 max-w-3xl" style={{ animationDelay: "220ms" }}>
          <HeroChart />
        </div>

        <hr className="seam mt-24" />

        <h2 className="mt-16 font-display text-2xl font-semibold tracking-[-0.01em] text-ink">What it does</h2>
        <dl className="mt-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`reveal grid gap-2 py-10 sm:grid-cols-[14rem_1fr] sm:gap-10 ${i > 0 ? "seam-top" : ""}`}
              style={{ animationDelay: `${240 + i * 70}ms` }}
            >
              <div className="font-mono text-[0.8125rem] text-muted">{f.kicker}</div>
              <div>
                <dt className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">{f.title}</dt>
                <dd className="mt-2 max-w-2xl text-base leading-7 text-muted">{f.body}</dd>
              </div>
            </div>
          ))}
        </dl>
      </main>

      <footer className="relative z-10 seam-top">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="font-mono text-[0.8125rem] text-muted">
            No backend, no database, no accounts. The models are computed in the browser.
          </p>
          <nav aria-label="Elsewhere" className="flex items-center gap-5 text-sm font-medium">
            <a href="https://danelrahmani.com" className="link-thread text-accent">
              danelrahmani.com
            </a>
            <a href="https://github.com/DanelRahmani/EconoSim" className="link-thread text-accent">
              Source on GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
