from __future__ import annotations

import logging

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
    return {
        'status': report.status,
        'used_fallback': report.used_fallback,
        'model_used': report.model_used,
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def module3_strategy_view(request):
    profile = getattr(request.user, 'farmer_profile', None)
    if profile is None:
        return Response({'detail': 'Farmer profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    force_refresh = request.query_params.get('refresh') == '1'
    report = RotationStrategyReport.objects.filter(profile=profile).first()

    if report is None or force_refresh or not report.strategies_matrix:
        try:
            report = run_rotation_pipeline_for_profile(
                profile,
                skip_gee_history=False if force_refresh else True,
            )
        except Exception as exc:
            logger.exception('Module 3 strategy endpoint caught error for profile %s: %s', profile.pk, exc)
            return Response(_emergency_fallback_response(profile), status=status.HTTP_200_OK)

    return Response(_serialize_report(report), status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def module3_recalculate_view(request):
    profile = getattr(request.user, 'farmer_profile', None)
    if profile is None:
        return Response({'detail': 'Farmer profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    body = request.data if isinstance(request.data, dict) else {}
    weights = {
        'water_availability': body.get('water_availability', 50),
        'budget': body.get('budget', 50),
        'market_demand': body.get('market_demand', 50),
    }
    preferred_language = body.get('preferred_language')

    try:
        # Never re-run slow GEE historical pipelines inside synchronous recalculate.
        report = run_rotation_pipeline_for_profile(
            profile,
            weights=weights,
            preferred_language=preferred_language,
            skip_gee_history=True,
        )
        return Response(_serialize_report(report), status=status.HTTP_200_OK)
    except Exception as exc:
        logger.exception('Module 3 recalculate caught error for profile %s: %s', profile.pk, exc)
        return Response(_emergency_fallback_response(profile, weights), status=status.HTTP_200_OK)
