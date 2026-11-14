export interface FarmerProfile {
  id: number;
  email: string;
  full_name: string;
  location_name: string;
  latitude: number;
  longitude: number;
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
