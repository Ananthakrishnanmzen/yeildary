from __future__ import annotations

import logging
import traceback

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from rotation.models import RotationStrategyReport, default_constraint_weights
from rotation.services.gemini_advisor import _fallback_decision_matrix
from rotation.services.rotation_engine import (
    build_dynamic_gemini_payload,
    evaluate_market_context,
    run_rotation_pipeline_for_profile,
)

logger = logging.getLogger(__name__)


def _serialize_report(report: RotationStrategyReport) -> dict:
    meta = (report.structured_telemetry_payload or {}).get('_meta') or {}
    return {
        'status': report.status,
        'used_fallback': bool(meta.get('used_fallback', False)),
        'model_used': meta.get('model_used', ''),
        'constraint_weights': report.constraint_weights or default_constraint_weights(),
        'preferred_language': (
            report.profile.get_preferred_language_display()
            or report.profile.preferred_language
            or 'English'
        ),
        'preferred_language_code': report.profile.preferred_language or 'en',
        'location_name': report.profile.location_name or report.profile.place_name,
        'coordinates': {
            'lat': float(report.profile.latitude),
            'lon': float(report.profile.longitude),
        },
        'updated_at': report.updated_at.isoformat() if report.updated_at else None,
        'data': {
            'realtime_alerts': report.ai_alerts or [],
            'baseline': (report.strategies_matrix or {}).get('baseline', {}),
            'resilience_build': (report.strategies_matrix or {}).get('resilience_build', {}),
            'water_saver': (report.strategies_matrix or {}).get('water_saver', {}),
        },
    }


def _emergency_fallback_response(profile, weights=None) -> dict:
    w = weights or default_constraint_weights()
    market_data = evaluate_market_context(
        float(profile.latitude),
        float(profile.longitude),
        profile.crops_grown or [],
    )
    payload = build_dynamic_gemini_payload(profile, {}, {}, {}, market_data, w)
    matrix = _fallback_decision_matrix(payload)
    return {
        'status': 'completed',
        'used_fallback': True,
        'model_used': 'fallback',
        'constraint_weights': w,
        'preferred_language': profile.get_preferred_language_display() or profile.preferred_language or 'English',
        'preferred_language_code': profile.preferred_language or 'en',
        'location_name': profile.location_name or profile.place_name,
        'coordinates': {
            'lat': float(profile.latitude),
            'lon': float(profile.longitude),
        },
        'updated_at': None,
        'data': matrix,
    }


def _has_stale_placeholder(report: RotationStrategyReport, profile) -> bool:
    blob = f'{report.ai_alerts or ""} {report.strategies_matrix or ""}'
    stale_tokens = (
        'Regional Staple',
        'set GEMINI_API_KEY',
        'Fallback advisory active',
        'Current Field Crop',
    )
    if any(tok in blob for tok in stale_tokens):
        return True
    payload_lang = (
        ((report.structured_telemetry_payload or {}).get('farmer_context') or {}).get('preferred_language')
    )
    profile_lang = profile.get_preferred_language_display() or profile.preferred_language or 'English'
    return bool(payload_lang and payload_lang != profile_lang)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def module3_strategy_view(request):
    try:
        profile = getattr(request.user, 'farmer_profile', None)
        if profile is None:
            return Response({'detail': 'Farmer profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        force_refresh = request.query_params.get('refresh') == '1'
        requested_lang = (
            request.query_params.get('preferred_language')
            or request.query_params.get('language')
        )
        report = RotationStrategyReport.objects.filter(profile=profile).first()

        if (
            report is not None
            and report.status == RotationStrategyReport.Status.COMPLETED
            and report.strategies_matrix
            and not force_refresh
            and not requested_lang
            and not _has_stale_placeholder(report, profile)
        ):
            return Response(_serialize_report(report), status=status.HTTP_200_OK)

        report = run_rotation_pipeline_for_profile(
            profile,
            preferred_language=requested_lang,
            skip_gee_history=False if force_refresh else True,
        )
        return Response(_serialize_report(report), status=status.HTTP_200_OK)
    except Exception as exc:
        traceback.print_exc()
        logger.exception('Module 3 strategy endpoint caught error: %s', exc)
        profile = getattr(request.user, 'farmer_profile', None)
        if profile is not None:
            return Response(_emergency_fallback_response(profile), status=status.HTTP_200_OK)
        return Response({'status': 'completed', 'used_fallback': True, 'data': _fallback_decision_matrix({})}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def module3_recalculate_view(request):
    try:
        profile = getattr(request.user, 'farmer_profile', None)
        if profile is None:
            return Response({'detail': 'Farmer profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        body = request.data if isinstance(request.data, dict) else {}
        weights = {
            'water_availability': body.get('water_availability', 50),
            'budget': body.get('budget', 50),
            'market_demand': body.get('market_demand', 50),
        }
        preferred_language = body.get('preferred_language') or body.get('language')

        # Never re-run slow GEE historical pipelines inside synchronous recalculate.
        report = run_rotation_pipeline_for_profile(
            profile,
            weights=weights,
            preferred_language=preferred_language,
            skip_gee_history=True,
        )
        return Response(_serialize_report(report), status=status.HTTP_200_OK)
    except Exception as exc:
        traceback.print_exc()
        logger.exception('Module 3 recalculate caught error: %s', exc)
        profile = getattr(request.user, 'farmer_profile', None)
        if profile is not None:
            return Response(_emergency_fallback_response(profile), status=status.HTTP_200_OK)
        return Response({'status': 'completed', 'used_fallback': True, 'data': _fallback_decision_matrix({})}, status=status.HTTP_200_OK)
