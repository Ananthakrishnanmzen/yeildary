export type FarmProfile = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  district: string;
  crop_type: string;
};

export type EnvironmentalTelemetry = {
  farm_id: string;
  timestamp: string;
  nasa_power_temp: number;
  gpm_precip: number;
  smap_soil_moisture: number;
  r2_geotiff_url: string | null;
};

export type ImpactAnalysis = {
  farm_id: string;
  drought_risk_score: number;
  thermal_stress_index: number;
  run_off_vulnerability: number;
  recommendation_text: string;
};

export type DashboardPayload = {
  farm: FarmProfile;
  telemetry: EnvironmentalTelemetry;
  impact: ImpactAnalysis;
};

export type OverlayKey = "ecostress" | "smap" | "srtm";

export type RotationStrategy = {
  id: "baseline" | "resilience" | "water-saver";
  name: string;
  description: string;
  score: number;
  waterDemand: number;
  soilHealth: number;
  cost: number;
  marketDemand: number;
};

export type Weighting = {
  water: number;
  budget: number;
  market: number;
};
