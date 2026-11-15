import type { DashboardPayload, RotationStrategy, Weighting } from "@/types";

export const MOCK_DASHBOARD: DashboardPayload = {
  farm: {
    id: "farm-idukki-01",
    name: "Cardamom Hill Estate",
    lat: 9.85,
    lon: 76.97,
    district: "Your Region",
    crop_type: "Cardamom",
  },
  telemetry: {
    farm_id: "farm-idukki-01",
    timestamp: "2026-01-15T12:00:00.000Z",
    nasa_power_temp: 26.4,
    gpm_precip: 8.2,
    smap_soil_moisture: 0.31,
    r2_geotiff_url: null,
  },
  impact: {
    farm_id: "farm-idukki-01",
    drought_risk_score: 62,
    thermal_stress_index: 71,
    run_off_vulnerability: 48,
    recommendation_text:
      "Soil moisture trending below seasonal baseline; consider drought-tolerant intercrop and mulching.",
  },
};

export const MOCK_STRATEGIES: RotationStrategy[] = [
  {
    id: "baseline",
    name: "Baseline",
    description: "Farmer's current rotation. Vulnerabilities flagged against SMAP moisture trends.",
    score: 54,
    waterDemand: 78,
    soilHealth: 45,
    cost: 30,
    marketDemand: 70,
  },
  {
    id: "resilience",
    name: "Resilience Build",
    description: "Nitrogen-fixing cover crops and deep-rooting varieties to rebuild organic matter.",
    score: 81,
    waterDemand: 52,
    soilHealth: 88,
    cost: 55,
    marketDemand: 62,
  },
  {
    id: "water-saver",
    name: "Water-Saver",
    description: "Drought-tolerant rotation prioritizing low evapotranspiration (ECOSTRESS/GRACE).",
    score: 76,
    waterDemand: 34,
    soilHealth: 60,
    cost: 40,
    marketDemand: 68,
  },
];

export const DEFAULT_WEIGHTS: Weighting = { water: 50, budget: 30, market: 20 };
