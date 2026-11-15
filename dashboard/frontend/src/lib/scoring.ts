import type { RotationStrategy, Weighting } from "@/types";

export function scoreStrategy(s: RotationStrategy, w: Weighting): number {
  const total = w.water + w.budget + w.market || 1;
  const waterScore = (100 - s.waterDemand) * (w.water / total);
  const budgetScore = (100 - s.cost) * (w.budget / total);
  const marketScore = s.marketDemand * (w.market / total);
  const soilBonus = s.soilHealth * 0.15;
  return Math.round(waterScore + budgetScore + marketScore + soilBonus);
}

export function rankStrategies(list: RotationStrategy[], w: Weighting): RotationStrategy[] {
  return [...list]
    .map((s) => ({ ...s, score: scoreStrategy(s, w) }))
    .sort((a, b) => b.score - a.score);
}
