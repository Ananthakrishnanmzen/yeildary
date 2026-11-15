import Link from "next/link";

const STATS = [
  { value: "25", label: "Earth-observation datasets" },
  { value: "3", label: "Neon overlay layers" },
  { value: "1", label: "Field notebook per farm" },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-text">
      {/* atmospheric background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(132,204,22,0.12) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 100%, rgba(56,189,248,0.08) 0%, transparent 60%), radial-gradient(ellipse 50% 40% at 10% 80%, rgba(167,139,250,0.08) 0%, transparent 60%)",
        }}
      />
      <div aria-hidden className="contour-bg pointer-events-none absolute inset-0 opacity-60" />

      <div className="relative mx-auto flex min-h-screen max-w-[1200px] flex-col px-6 py-10">
        {/* top strip */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="h-2 w-2 animate-pulse-dot rounded-full bg-lime" />
            <span className="font-display text-lg tracking-tight text-text">Yieldary AI</span>
          </div>
          <span className="font-data text-[10px] uppercase tracking-[0.2em] text-muted">
            Orbital Field Notebook
          </span>
        </header>

        {/* hero */}
        <section className="flex flex-1 flex-col justify-center py-16">
          <p className="mb-6 font-data text-[11px] uppercase tracking-[0.3em] text-lime">
            NASA Earth Observation · Farm Adaptation
          </p>
          <h1 className="font-display text-[clamp(3rem,9vw,7.5rem)] leading-[0.95] tracking-tight text-text">
            Read the field
            <br />
            <span className="text-lime">from orbit.</span>
          </h1>
          <p className="mt-8 max-w-xl font-body text-base leading-relaxed text-muted">
            Yieldary AI fuses Sentinel-2 imagery, ECOSTRESS heat, SMAP moisture and SRTM
            terrain into one orbital notebook — so every crop recommendation carries its
            evidence, not just its answer.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 rounded-md border border-lime/50 bg-lime/15 px-6 py-3 font-data text-xs font-bold uppercase tracking-wider text-lime transition hover:bg-lime/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime"
            >
              Open Dashboard
              <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <a
              href="#datasets"
              className="inline-flex items-center gap-2 rounded-md border border-line px-6 py-3 font-data text-xs font-bold uppercase tracking-wider text-muted transition hover:border-muted hover:text-text"
            >
              Explore 25 datasets
            </a>
          </div>

          {/* stats */}
          <dl className="mt-16 grid grid-cols-1 gap-6 border-t border-line pt-8 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <dt className="font-display text-4xl tracking-tight text-text tabular">{s.value}</dt>
                <dd className="font-data text-[10px] uppercase tracking-[0.2em] text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* dataset preview anchor */}
        <section id="datasets" className="pb-10">
          <div className="rounded-lg border border-line bg-panel/60 p-6 glass">
            <p className="font-data text-[10px] uppercase tracking-[0.2em] text-muted">
              Progressive disclosure
            </p>
            <p className="mt-2 max-w-2xl font-body text-sm leading-relaxed text-text/80">
              Twenty-five sources, grouped by vulnerability, terrain and rotation strategy.
              Open the dashboard to toggle neon overlays and read the &ldquo;Why&rdquo; card
              behind every recommendation.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
