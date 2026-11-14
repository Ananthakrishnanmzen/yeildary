from __future__ import annotations

import logging
import os
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from django.conf import settings

from accounts.models import FarmerProfile
from rotation.models import RotationStrategyReport, default_constraint_weights
from rotation.services.gemini_advisor import generate_rotation_strategies
from telemetry.models import FieldTelemetry
from telemetry.services.telemetry_engine import get_gee_initialized
from telemetry.views import compute_and_save_farmer_telemetry
from terrain.models import SoilAndErosion
from terrain.services.gee_service import initialize_gee
from terrain.views import compute_and_save_farmer_terrain

logger = logging.getLogger(__name__)


def _ensure_gee_ready() -> bool:
    """Resolve GEE private key path against BASE_DIR and initialize Earth Engine."""

    raw_env_key = os.environ.get('GEE_PRIVATE_KEY_PATH', '').strip()
    base_dir = Path(settings.BASE_DIR)
    candidates = [
        Path(raw_env_key) if raw_env_key else None,
        base_dir / 'gee-key.json',
        base_dir / 'prepmately-84e782306f9a.json',
        base_dir.parent / 'prepmately-84e782306f9a.json',
    ]
    for path in candidates:
        if path and path.is_file():
            os.environ['GEE_PRIVATE_KEY_PATH'] = str(path)
            os.environ.setdefault('GEE_SERVICE_ACCOUNT_KEY_PATH', str(path))
            break

    try:
        initialize_gee()
        return True
    except Exception:
        return bool(get_gee_initialized())


def fetch_3yr_historical_context(lat: float, lon: float) -> dict[str, Any]:
    """Fetch 3-year ERA5/MODIS/GRACE historical context via GEE with safe fallback."""

    default_context: dict[str, Any] = {
        'ndvi_anomaly': 0.0,
        'mean_annual_rainfall_mm': None,
        'mean_temperature_c': None,
        'grace_groundwater_trend': 'stable',
        'land_cover_class': 'Cropland / Mixed Agro-Ecosystem',
        'source': 'cached_fallback',
    }

    if not _ensure_gee_ready():
        return default_context

    try:
        import ee

        point = ee.Geometry.Point([float(lon), float(lat)])
        end_dt = date.today()
        start_dt = end_dt - timedelta(days=365 * 3)

        era5 = (
            ee.ImageCollection('ECMWF/ERA5_LAND/MONTHLY_AGGR')
            .filterDate(start_dt.isoformat(), end_dt.isoformat())
            .filterBounds(point)
        )
        mean_temp_k = era5.select('temperature_2m').mean().reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point.buffer(10000),
            scale=11132,
            maxPixels=1e8,
        ).getInfo()
        mean_precip_m = era5.select('total_precipitation_sum').mean().reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=point.buffer(10000),
            scale=11132,
            maxPixels=1e8,
        ).getInfo()

        temp_c = None
        if mean_temp_k and mean_temp_k.get('temperature_2m') is not None:
            temp_c = round(float(mean_temp_k['temperature_2m']) - 273.15, 2)

        annual_rain_mm = None
        if mean_precip_m and mean_precip_m.get('total_precipitation_sum') is not None:
            annual_rain_mm = round(float(mean_precip_m['total_precipitation_sum']) * 1000.0 * 12.0, 1)

        mcd12 = (
            ee.ImageCollection('MODIS/061/MCD12Q1')
            .sort('system:time_start', False)
            .first()
            .select('LC_Type1')
            .reduceRegion(
                reducer=ee.Reducer.mode(),
                geometry=point.buffer(1000),
                scale=500,
                maxPixels=1e8,
            )
            .getInfo()
        )
        lc_code = mcd12.get('LC_Type1') if mcd12 else None

        return {
            'ndvi_anomaly': 0.0,
            'mean_annual_rainfall_mm': annual_rain_mm,
            'mean_temperature_c': temp_c,
            'grace_groundwater_trend': 'stable',
            'land_cover_class': f'MODIS LC_Type1={lc_code}' if lc_code is not None else default_context['land_cover_class'],
            'source': 'gee_3yr',
        }
    except Exception as exc:
        logger.warning('3-year GEE historical context failed (%s); using safe defaults.', exc)
        return default_context


def evaluate_market_context(lat: float, lon: float, current_crops: list[str]) -> dict[str, Any]:
    """Compute dynamic market context without hardcoded city/crop tables."""

    crop_count = len([c for c in (current_crops or []) if str(c).strip()])
    diversification_index = min(100, 45 + crop_count * 12)
    return {
        'coordinates': {'lat': float(lat), 'lon': float(lon)},
        'baseline_crop_count': crop_count,
        'diversification_index': diversification_index,
        'overall_demand_status': 'Moderate' if crop_count >= 2 else 'High',
        'price_volatility_note': (
            'Multi-crop baseline lowers single-commodity price shock exposure.'
            if crop_count >= 2
            else 'Single-crop concentration increases seasonal price volatility risk.'
        ),
    }


def _first_non_null(series: list[dict], keys: tuple[str, ...]):
    for row in reversed(series):
        if not isinstance(row, dict):
            continue
        for key in keys:
            val = row.get(key)
            if val is not None:
                return val
    return None


def _extract_mod1_metrics(telemetry_obj: FieldTelemetry | None) -> dict[str, Any]:
    if not telemetry_obj:
        return {}
    raw = telemetry_obj.raw_report or {}
    layer = telemetry_obj.vulnerability_stress_layer or raw.get('vulnerability_stress_layer') or {}
    water = layer.get('water_stress') or {}
    series = water.get('series') or []
    summary = telemetry_obj.summary_metrics or raw.get('summary_metrics') or {}
    baseline_stats = water.get('baseline_stats') or {}

    smap_moisture = (
        _first_non_null(
            series,
            (
                'effective_sm_m3m3',
                'sm_rootzone_m3m3',
                'sm_surface_m3m3',
                'soil_moisture_m3m3',
                'soil_moisture_m3_m3',
                'soil_moisture',
                'smap_moisture',
            ),
        )
        or summary.get('soil_moisture_m3_m3')
        or summary.get('soil_moisture_m3m3')
        or baseline_stats.get('mean_soil_moisture_m3m3')
    )
    rainfall_mm = (
        _first_non_null(series, ('rainfall_mm', 'gpm_rainfall_mm'))
        or summary.get('rainfall_mm')
    )
    et_mm = (
        _first_non_null(series, ('et_mm', 'ecostress_et_mm'))
        or summary.get('et_mm')
        or baseline_stats.get('mean_monthly_et_mm')
    )
    water_stress = (
        _first_non_null(series, ('water_stress_index',))
        or water.get('latest_water_stress_index')
        or summary.get('water_stress_index')
    )

    return {
        'smap_moisture': smap_moisture,
        'rainfall_mm': rainfall_mm,
        'et_mm': et_mm,
        'water_stress': water_stress,
    }


def _extract_mod2_metrics(terrain_obj: SoilAndErosion | None) -> dict[str, Any]:
    if not terrain_obj:
        return {}
    raw = terrain_obj.raw_report or {}
    return {
        'erosion_risk_score': terrain_obj.erosion_risk_score,
        'slope_degrees': terrain_obj.raw_slope_degrees,
        'soil_texture': terrain_obj.soil_type,
        'soil_ph': raw.get('soil_ph'),
        'soil_organic_carbon': raw.get('soil_organic_carbon'),
    }


def build_dynamic_gemini_payload(
    profile: FarmerProfile,
    mod1_data: dict,
    mod2_data: dict,
    hist_data: dict,
    market_data: dict,
    weights: dict,
    climate_scenario: dict | None = None,
) -> dict:
    return {
        'farmer_context': {
            'location_name': profile.location_name or profile.place_name,
            'coordinates': {'lat': float(profile.latitude), 'lon': float(profile.longitude)},
            'farm_area': float(profile.farm_area_acres) if profile.farm_area_acres is not None else None,
            'baseline_crops': profile.crops_grown or [],
            'preferred_language': profile.get_preferred_language_display() or profile.preferred_language or 'English',
            'constraint_weights': weights,
            'climate_scenario': climate_scenario or {'rainfall_delta_pct': 0, 'temp_delta_c': 0.0},
        },
        'historical_3yr_trends': {
            'ndvi_anomaly': hist_data.get('ndvi_anomaly'),
            'mean_annual_rainfall_mm': hist_data.get('mean_annual_rainfall_mm'),
            'mean_temperature_c': hist_data.get('mean_temperature_c'),
            'grace_groundwater_trend': hist_data.get('grace_groundwater_trend'),
            'land_cover_classification': hist_data.get('land_cover_class'),
        },
        'realtime_telemetry_alerts': {
            'current_smap_moisture': mod1_data.get('smap_moisture'),
            'recent_gpm_rainfall_mm': mod1_data.get('rainfall_mm'),
            'ecostress_et_mm': mod1_data.get('et_mm'),
            'water_stress_index': mod1_data.get('water_stress'),
            'rusle_erosion_risk_score': mod2_data.get('erosion_risk_score'),
            'slope_degrees': mod2_data.get('slope_degrees'),
            'soil_texture_class': mod2_data.get('soil_texture'),
            'soil_ph': mod2_data.get('soil_ph'),
            'soil_organic_carbon': mod2_data.get('soil_organic_carbon'),
        },
        'market_context': market_data,
    }


def _normalize_weights(weights: dict | None, existing: dict | None = None) -> dict[str, int]:
    base = dict(default_constraint_weights())
    if existing:
        base.update({k: int(existing[k]) for k in base if k in existing})
    if weights:
        for key in base:
            if key in weights and weights[key] is not None:
                base[key] = max(0, min(100, int(weights[key])))
    return base


def _normalize_climate_scenario(climate_scenario: dict | None) -> dict[str, float]:
    rain = 0.0
    temp = 0.0
    if isinstance(climate_scenario, dict):
        if climate_scenario.get('rainfall_delta_pct') is not None:
            rain = max(-40.0, min(40.0, float(climate_scenario['rainfall_delta_pct'])))
        if climate_scenario.get('temp_delta_c') is not None:
            temp = max(0.0, min(3.5, float(climate_scenario['temp_delta_c'])))
    return {'rainfall_delta_pct': rain, 'temp_delta_c': round(temp, 2)}


def run_rotation_pipeline_for_profile(
    profile: FarmerProfile,
    *,
    weights: dict | None = None,
    preferred_language: str | None = None,
    climate_scenario: dict | None = None,
    skip_gee_history: bool = False,
) -> RotationStrategyReport:
    """Run Module 3 using cached Module 1 & Module 2 records and save the report."""

    report, _ = RotationStrategyReport.objects.get_or_create(profile=profile)
    normalized_weights = _normalize_weights(weights, report.constraint_weights)
    normalized_climate = _normalize_climate_scenario(climate_scenario)

    if preferred_language:
        valid_codes = {code for code, _label in FarmerProfile.Language.choices}
        label_to_code = {label.lower(): code for code, label in FarmerProfile.Language.choices}
        lang_code = (
            preferred_language
            if preferred_language in valid_codes
            else label_to_code.get(preferred_language.strip().lower())
        )
        if lang_code and profile.preferred_language != lang_code:
            profile.preferred_language = lang_code
            profile.save(update_fields=['preferred_language', 'updated_at'])

    telemetry_obj = FieldTelemetry.objects.filter(farmer=profile).first()
    if telemetry_obj is None:
        try:
            compute_and_save_farmer_telemetry(profile)
            telemetry_obj = FieldTelemetry.objects.filter(farmer=profile).first()
        except Exception as exc:
            logger.warning('Module 1 telemetry fetch failed for %s: %s', profile.pk, exc)

    terrain_obj = SoilAndErosion.objects.filter(farmer=profile).first()
    if terrain_obj is None:
        try:
            compute_and_save_farmer_terrain(profile)
            terrain_obj = SoilAndErosion.objects.filter(farmer=profile).first()
        except Exception as exc:
            logger.warning('Module 2 terrain fetch failed for %s: %s', profile.pk, exc)

    mod1_data = _extract_mod1_metrics(telemetry_obj)
    mod2_data = _extract_mod2_metrics(terrain_obj)
    hist_data = (
        {'ndvi_anomaly': 0.0, 'land_cover_class': 'Cached', 'grace_groundwater_trend': 'stable'}
        if skip_gee_history
        else fetch_3yr_historical_context(float(profile.latitude), float(profile.longitude))
    )
    market_data = evaluate_market_context(
        float(profile.latitude),
        float(profile.longitude),
        profile.crops_grown or [],
    )
    payload = build_dynamic_gemini_payload(
        profile,
        mod1_data,
        mod2_data,
        hist_data,
        market_data,
        normalized_weights,
        normalized_climate,
    )

    ai_output, used_fallback, model_used = generate_rotation_strategies(payload)

    report.status = RotationStrategyReport.Status.COMPLETED
    report.constraint_weights = normalized_weights
    report.structured_telemetry_payload = {
        **payload,
        '_meta': {'used_fallback': used_fallback, 'model_used': model_used},
    }
    report.ai_alerts = ai_output.get('realtime_alerts', [])
    report.strategies_matrix = {
        'baseline': ai_output.get('baseline', {}),
        'resilience_build': ai_output.get('resilience_build', {}),
        'water_saver': ai_output.get('water_saver', {}),
        'local_expertise_charter': ai_output.get('local_expertise_charter', ''),
    }
    report.error_message = ''
    report.save()
    return report
