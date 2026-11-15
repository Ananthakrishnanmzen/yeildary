export default function WhyCard({
  crop,
  rationale,
  sources,
}: {
  crop: string;
  rationale: string;
  sources?: string[];
}) {
  const chips = sources ?? ["FAO GAEZ", "ECOSTRESS", "USDA AMS"];
  return (
    <article className="relative overflow-hidden rounded-lg border border-lime/40 bg-panel/90 p-5 glass-strong">
      <div className="perf-edge absolute -top-1 left-0 right-0 h-2" aria-hidden />
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-data text-[10px] uppercase tracking-[0.25em] text-muted">
          Field Note · AI
        </span>
        <span className="rounded-full border border-lime/50 bg-lime/10 px-2.5 py-0.5 font-data text-[10px] font-bold uppercase tracking-wider text-lime">
          Recommended
        </span>
      </div>
      <h4 className="mb-3 font-display text-2xl tracking-tight text-lime">{crop}</h4>
      <p className="font-data text-xs leading-relaxed text-lime/90">{rationale}</p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {chips.map((s) => (
          <span
            key={s}
            className="rounded-full border border-lime/30 bg-lime/5 px-2.5 py-1 font-data text-[9px] uppercase tracking-wider text-lime/80"
          >
            {s}
          </span>
        ))}
      </div>
      <div className="perf-edge absolute -bottom-1 left-0 right-0 h-2" aria-hidden />
    </article>
  );
}
