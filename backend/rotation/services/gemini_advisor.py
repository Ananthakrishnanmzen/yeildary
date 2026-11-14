from __future__ import annotations

import json
import logging
import os
from typing import Literal

from django.conf import settings
from google import genai
from google.genai import types
from google.genai.errors import APIError, ServerError
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

FALLBACK_MODELS = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.0-flash',
]


class StrategyDetail(BaseModel):
    strategy_name: str
    recommended_crop_sequence: list[str]
    suitability_score: int = Field(ge=0, le=100)
    water_efficiency_score: int = Field(ge=0, le=100)
    soil_health_impact_pct: int = Field(ge=-100, le=100)
    market_viability_score: int = Field(ge=0, le=100)
    market_demand_status: Literal['High', 'Moderate', 'Crashing']
    agronomic_reasoning: str


class AlertItem(BaseModel):
    alert_title: str
    alert_message: str
    severity: Literal['HIGH', 'MEDIUM', 'LOW']


class RotationResponseSchema(BaseModel):
    realtime_alerts: list[AlertItem]
    baseline: StrategyDetail
    resilience_build: StrategyDetail
    water_saver: StrategyDetail


def _clamp_int(value: float, low: int, high: int) -> int:
    return max(low, min(high, int(round(value))))


def _fallback_decision_matrix(payload: dict) -> dict:
    """Return a deterministic, telemetry-grounded fallback matrix if Gemini is unavailable."""

    farmer = payload.get('farmer_context') or {}
    telemetry = payload.get('realtime_telemetry_alerts') or {}
    market = payload.get('market_context') or {}

    location = farmer.get('location_name') or 'Registered Farm'
    lang = farmer.get('preferred_language') or 'English'
    baseline_crops = [c for c in (farmer.get('baseline_crops') or []) if str(c).strip()]
    if not baseline_crops:
        baseline_crops = ['Current Field Crop']

    weights = farmer.get('constraint_weights') or {}
    water_w = float(weights.get('water_availability', 50))
    budget_w = float(weights.get('budget', 50))
    market_w = float(weights.get('market_demand', 50))

    smap = telemetry.get('current_smap_moisture')
    rain = telemetry.get('recent_gpm_rainfall_mm')
    stress = telemetry.get('water_stress_index')
    erosion = telemetry.get('rusle_erosion_risk_score')
    slope = telemetry.get('slope_degrees')
    soil_texture = telemetry.get('soil_texture_class') or 'local soil profile'

    stress_val = float(stress) if stress is not None else 35.0
    erosion_val = float(erosion) if erosion is not None else 30.0
    slope_val = float(slope) if slope is not None else 4.0
    smap_str = f'{float(smap):.3f} m³/m³' if smap is not None else 'N/A'
    rain_str = f'{float(rain):.1f} mm/mo' if rain is not None else 'N/A'

    market_status = market.get('overall_demand_status') or 'Moderate'
    if market_status not in ('High', 'Moderate', 'Crashing'):
        market_status = 'Moderate'

    alerts = [
        {
            'alert_title': f'Telemetry Advisory ({location})',
            'alert_message': (
                f'Soil moisture is {smap_str}, Water Stress Index is {stress_val:.1f}, '
                f'and RUSLE Erosion Risk is {erosion_val:.1f}/100 (slope {slope_val:.1f}°). '
                f'Fallback advisory active (configured language: {lang}).'
            ),
            'severity': 'HIGH' if (erosion_val >= 65 or stress_val >= 65) else 'MEDIUM',
        }
    ]
    if erosion_val >= 60:
        alerts.append(
            {
                'alert_title': 'Topsoil Erosion Mitigation Required',
                'alert_message': (
                    f'High RUSLE score ({erosion_val:.1f}/100) on {slope_val:.1f}° slope and '
                    f'{rain_str} rainfall. Prioritize contour cover cropping and residue retention.'
                ),
                'severity': 'HIGH',
            }
        )

    baseline_suitability = _clamp_int(78 - erosion_val * 0.28 - stress_val * 0.18, 25, 92)
    resilience_suitability = _clamp_int(76 + (budget_w - 50) * 0.12 - erosion_val * 0.08, 45, 96)
    water_suitability = _clamp_int(74 + (100 - water_w) * 0.15 - stress_val * 0.05, 45, 95)

    return {
        'realtime_alerts': alerts,
        'baseline': {
            'strategy_name': 'Baseline Continuation',
            'recommended_crop_sequence': baseline_crops[:3],
            'suitability_score': baseline_suitability,
            'water_efficiency_score': _clamp_int(72 - stress_val * 0.4, 20, 90),
            'soil_health_impact_pct': _clamp_int(10 - erosion_val * 0.35, -60, 40),
            'market_viability_score': _clamp_int(55 + market_w * 0.25, 30, 95),
            'market_demand_status': market_status,
            'agronomic_reasoning': (
                f'Evaluates continuing {", ".join(baseline_crops[:3])} on {soil_texture} '
                f'under {smap_str} soil moisture and {erosion_val:.1f}/100 RUSLE erosion risk.'
            ),
        },
        'resilience_build': {
            'strategy_name': 'Soil Resilience & Cover Rotation',
            'recommended_crop_sequence': [
                baseline_crops[0],
                'Nitrogen-Fixing Legume Cover',
                'Deep-Rooted Mulch Crop',
            ],
            'suitability_score': resilience_suitability,
            'water_efficiency_score': _clamp_int(74 + (100 - stress_val) * 0.12, 40, 95),
            'soil_health_impact_pct': _clamp_int(32 + min(25, erosion_val * 0.25), 10, 85),
            'market_viability_score': _clamp_int(62 + market_w * 0.24, 35, 95),
            'market_demand_status': 'High' if market_w >= 65 else 'Moderate',
            'agronomic_reasoning': (
                f'Balances {baseline_crops[0]} with a nitrogen-fixing legume and protective cover '
                f'to stabilize {soil_texture} on a {slope_val:.1f}° slope.'
            ),
        },
        'water_saver': {
            'strategy_name': 'Low-ET Water-Saver Rotation',
            'recommended_crop_sequence': [
                'Low-ET Drought-Tolerant Pulse',
                baseline_crops[0],
                'Short-Cycle Oilseed',
            ],
            'suitability_score': water_suitability,
            'water_efficiency_score': _clamp_int(84 + (100 - water_w) * 0.1, 55, 98),
            'soil_health_impact_pct': 22,
            'market_viability_score': _clamp_int(58 + market_w * 0.25, 35, 94),
            'market_demand_status': 'Moderate',
            'agronomic_reasoning': (
                f'Targets water conservation under {stress_val:.1f} Water Stress Index and '
                f'{rain_str} recent precipitation by pairing low-ET crops with moisture retention.'
            ),
        },
    }


def generate_rotation_strategies(payload: dict) -> tuple[dict, bool, str]:
    """Call Gemini with model fallback; never raise on model/key failure."""

    api_key = getattr(settings, 'GEMINI_API_KEY', None) or os.environ.get('GEMINI_API_KEY', '').strip()
    if not api_key:
        logger.warning('GEMINI_API_KEY is not configured; returning fallback rotation matrix.')
        return _fallback_decision_matrix(payload), True, 'fallback'

    preferred_lang = (
        payload.get('farmer_context', {}).get('preferred_language') or 'English'
    )
    system_instruction = (
        'You are an autonomous Precision Agriculture Systems Intelligence Engine analyzing NASA Earth Observation data. '
        'Infer the agro-climatic zone strictly from farmer_context.coordinates and the provided telemetry values. '
        'Evaluate farmer_context.baseline_crops and select regionally, climatically, and pedologically appropriate '
        'rotation crops for that exact global coordinate—never output generic placeholders like "Regional Staple". '
        f'CRITICAL: Write all human-readable values (alert_title, alert_message, strategy_name, agronomic_reasoning) fluently in {preferred_lang}. '
        "Keep JSON keys and market_demand_status ('High', 'Moderate', 'Crashing') and severity ('HIGH', 'MEDIUM', 'LOW') in English."
    )

    configured_model = os.environ.get('GEMINI_MODEL', '').strip()
    models_to_try: list[str] = []
    for candidate in [configured_model, *FALLBACK_MODELS]:
        if candidate and candidate not in models_to_try:
            models_to_try.append(candidate)

    try:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=15000),
        )
    except Exception as exc:
        logger.warning('Failed to initialize Gemini client (%s); returning fallback rotation matrix.', exc)
        return _fallback_decision_matrix(payload), True, 'fallback'
    contents = json.dumps(payload)

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type='application/json',
                    response_schema=RotationResponseSchema,
                    temperature=0.2,
                    http_options=types.HttpOptions(timeout=15000),
                ),
            )
            parsed = json.loads(response.text)
            return parsed, False, model_name
        except (APIError, ServerError, ValueError, TypeError, json.JSONDecodeError) as exc:
            logger.warning('Gemini model %s failed (%s); trying next fallback.', model_name, exc)
        except Exception as exc:
            logger.warning('Unexpected Gemini error on %s (%s); trying next fallback.', model_name, exc)

    logger.error('All Gemini models failed; returning fallback rotation matrix.')
    return _fallback_decision_matrix(payload), True, 'fallback'
