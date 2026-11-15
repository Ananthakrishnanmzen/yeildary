"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { rankStrategies, scoreStrategy } from "@/lib/scoring";
import { MOCK_STRATEGIES, DEFAULT_WEIGHTS } from "@/lib/mockData";
import type { RotationStrategy, Weighting } from "@/types";

const STRATEGY_COLOR: Record<RotationStrategy["id"], string> = {
  baseline: "var(--muted)",
  resilience: "var(--violet)",
  "water-saver": "var(--sky)",
};

export default function RotationStrategyPanel() {
  const [weights, setWeights] = useState<Weighting>(DEFAULT_WEIGHTS);
  const ranked = useMemo(() => rankStrategies(MOCK_STRATEGIES, weights), [weights]);
  const winner = ranked[0];

  const update = (key: keyof Weighting, v: number) =>
    setWeights((w) => ({ ...w, [key]: v }));

  return (
    <section aria-labelledby="rotation-title" className="glass rounded-lg p-5 contour-bg">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="rotation-title" className="font-data text-[10px] uppercase tracking-[0.2em] text-muted">
            Rotation Strategy Engine
          </h3>
          <p className="mt-1 font-data text-[11px] text-text/80">
            Tune priorities to re-rank candidate rotations. Winner:{" "}
            <span className="font-bold text-lime">{winner.name}</span>
          </p>
        </div>
        <span className="rounded-full border border-lime/40 bg-lime/10 px-3 py-1 font-data text-[10px] font-bold uppercase tracking-wider text-lime">
          {winner.score} pts
        </span>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {(["water", "budget", "market"] as const).map((key) => (
          <label key={key} className="block">
            <div className="mb-1.5 flex items-center justify-between font-data text-[10px] uppercase tracking-wider text-muted">
              <span>
                {key === "budget" ? "Budget" : key === "water" ? "Water Availability" : "Market Demand"}
              </span>
              <span className="text-text tabular">{weights[key]}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={weights[key]}
              onChange={(e) => update(key, Number(e.target.value))}
              className="w-full accent-[color:var(--lime)]"
              aria-label={key}
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {ranked.map((s, i) => (
          <StrategyCard key={s.id} strategy={s} rank={i + 1} weights={weights} />
        ))}
      </div>
    </section>
  );
}

function StrategyCard({
  strategy,
  rank,
  weights,
}: {
  strategy: RotationStrategy;
  rank: number;
  weights: Weighting;
}) {
  const score = scoreStrategy(strategy, weights);
  const color = STRATEGY_COLOR[strategy.id];
  const isWinner = rank === 1;
  return (
    <article
      className="relative rounded-lg border p-4 transition-all"
      style={{
        borderColor: isWinner ? color : "var(--line)",
        background: isWinner ? `${color}14` : "rgba(7,9,13,0.6)",
        boxShadow: isWinner ? `0 0 24px ${color}33` : "none",
      }}
    >
      {isWinner && (
        <span className="absolute right-3 top-3 text-lime" aria-label="Top ranked">
          <Trophy className="h-4 w-4" />
        </span>
      )}
      <div className="mb-2 flex items-center justify-between">
        <span className="font-data text-[10px] uppercase tracking-wider text-muted">#{rank}</span>
        <span className="font-data text-xl font-bold tabular" style={{ color }}>
          {score}
        </span>
      </div>
      <h4 className="mb-1 font-display text-sm tracking-tight text-text">{strategy.name}</h4>
      <p className="mb-3 font-data text-[10px] leading-relaxed text-muted">{strategy.description}</p>
      <div className="grid grid-cols-2 gap-1 font-data text-[10px] text-muted">
        <span>Water {strategy.waterDemand}</span>
        <span>Soil {strategy.soilHealth}</span>
        <span>Cost {strategy.cost}</span>
        <span>Market {strategy.marketDemand}</span>
      </div>
    </article>
  );
}
