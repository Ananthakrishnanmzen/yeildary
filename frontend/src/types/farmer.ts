export interface FarmerProfile {
  id: number;
  email: string;
  full_name: string;
  location_name: string;
  latitude: number;
  longitude: number;
  crops_grown?: string[];
  preferred_language?: string;
  created_at?: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  location_name: string;
  latitude: number;
  longitude: number;
}

export interface LocationRating {
  overall_score: number;
  letter_grade: string;
  risk_tier: string;
  badge_class?: string;
  water_security_rate: number;
  thermal_resilience_rate: number;
  vegetation_vitality_rate: number;
  microclimate_stability_rate: number;
  limiting_factor?: string;
  recommendation: string;
}

export interface WaterStressSeriesItem {
  date: string;
  sm_rootzone_m3m3: number | null;
  sm_surface_m3m3?: number | null;
  soil_moisture_m3m3?: number | null;
  et_mm: number;
  rainfall_mm: number;
  water_stress_index: number;
  drought_warning: boolean;
  drought_severity: string;
}

export interface TelemetryReport {
  location_id?: string;
  location_name?: string;
  cached?: boolean;
  territory_mode: string;
  window: {
    start_date: string;
    end_date: string;
  };
  summary_metrics: {
    sentinel2?: { s2_ndvi?: number };
    smap?: { sm_rootzone?: number };
    era5_temp?: { era5_temp_c?: number };
    era5_precip?: { era5_precip_mm?: number };
  };
  location_rating: LocationRating;
  vulnerability_stress_layer: {
    water_stress: {
      series: WaterStressSeriesItem[];
      drought_warnings_count: number;
      active_drought_warning: boolean;
      baseline_stats?: {
        mean_soil_moisture_m3m3?: number;
        mean_monthly_et_mm?: number;
      };
    };
    vegetation_health: {
      climate_vulnerability_proven: boolean;
      vulnerability_events: Array<Record<string, unknown>>;
      heatwave_ndvi_correlation?: {
        pearson_r_max_temp_vs_ndvi?: number | null;
      };
      correlation?: {
        pearson_r_max_temp_vs_ndvi?: number | null;
      };
    };
    microclimate: {
      assimilation_model?: string;
      stress_summary?: {
        stomatal_vpd_stress_steps?: number;
        fungal_humidity_risk_steps?: number;
      };
    };
  };
}

export interface TerrainReport {
  cached?: boolean;
  score: number;
  erosion_risk_score: number;
  raw_slope_degrees: number;
  raw_rainfall_mm: number;
  tree_cover_pct: number;
  exposed_cover_pct: number;
  canopy_height_m: number;
  canopy_status: string;
  dynamic_description: string;
  soil_type: string;
  location_name: string;
  analyzed_from: string;
  analyzed_to: string;
  date_range: string;
}

export interface ConstraintWeights {
  water_availability: number;
  budget: number;
  market_demand: number;
}

export interface AlertItem {
  alert_title: string;
  alert_message: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface StrategyDetail {
  strategy_name: string;
  recommended_crop_sequence: string[];
  suitability_score: number;
  water_efficiency_score: number;
  soil_health_impact_pct: number;
  market_viability_score: number;
  market_demand_status: 'High' | 'Moderate' | 'Crashing';
  agronomic_reasoning: string;
}

export interface Module3StrategyData {
  realtime_alerts: AlertItem[];
  baseline: StrategyDetail;
  resilience_build: StrategyDetail;
  water_saver: StrategyDetail;
}

export interface Module3StrategyResponse {
  status: 'processing' | 'completed' | 'failed';
  used_fallback: boolean;
  model_used: string;
  constraint_weights: ConstraintWeights;
  preferred_language: string;
  preferred_language_code: string;
  location_name: string;
  coordinates: { lat: number; lon: number };
  updated_at: string | null;
  data: Module3StrategyData;
}
