import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import FarmerProfile
from terrain.models import SoilAndErosion
from terrain.services.gee_service import GEEComputationError, calculate_erosion_risk
from terrain.utils import build_bounding_box_polygon

logger = logging.getLogger(__name__)


def compute_and_save_farmer_terrain(profile: FarmerProfile) -> dict:
    """Run Module 2 calculate_erosion_risk using the farmer's saved lat/lon and persist it."""
    lat = float(profile.latitude)
    lon = float(profile.longitude)
    polygon = build_bounding_box_polygon(lat, lon)

    gee_result = calculate_erosion_risk(polygon)
    date_range = f"{gee_result['analyzed_from']} to {gee_result['analyzed_to']}"

    report_payload = {
        'score': gee_result['erosion_risk_score'],
        'erosion_risk_score': gee_result['erosion_risk_score'],
        'raw_slope_degrees': gee_result['raw_slope_degrees'],
        'raw_rainfall_mm': gee_result['raw_rainfall_mm'],
        'tree_cover_pct': gee_result['tree_cover_pct'],
        'exposed_cover_pct': gee_result['exposed_cover_pct'],
        'canopy_height_m': gee_result['canopy_height_m'],
        'canopy_status': gee_result['canopy_status'],
        'dynamic_description': gee_result['dynamic_description'],
        'soil_type': gee_result['soil_type'],
        'location_name': profile.location_name,
        'analyzed_from': gee_result['analyzed_from'],
        'analyzed_to': gee_result['analyzed_to'],
        'date_range': date_range,
    }

    SoilAndErosion.objects.update_or_create(
        farmer=profile,
        defaults={
            'erosion_risk_score': gee_result['erosion_risk_score'],
            'raw_slope_degrees': gee_result['raw_slope_degrees'],
            'raw_rainfall_mm': gee_result['raw_rainfall_mm'],
            'tree_cover_pct': gee_result['tree_cover_pct'],
            'exposed_cover_pct': gee_result['exposed_cover_pct'],
            'canopy_height_m': gee_result['canopy_height_m'],
            'canopy_status': gee_result['canopy_status'],
            'dynamic_description': gee_result['dynamic_description'],
            'soil_type': gee_result['soil_type'],
            'analyzed_from': gee_result['analyzed_from'],
            'analyzed_to': gee_result['analyzed_to'],
            'raw_report': report_payload,
        },
    )
    return report_payload


class FarmerTerrainView(APIView):
    """GET /api/terrain/ — Fetch (or compute via Module 2) erosion & soil report for the logged-in farmer."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        try:
            profile = request.user.farmer_profile
        except FarmerProfile.DoesNotExist:
            return Response(
                {'detail': 'Farmer profile not found.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        force_refresh = request.query_params.get('refresh') in ('1', 'true', 'yes')

        if not force_refresh:
            existing = SoilAndErosion.objects.filter(farmer=profile).first()
            if existing and existing.raw_report:
                return Response(
                    {
                        'cached': True,
                        'updated_at': existing.updated_at.isoformat(),
                        **existing.raw_report,
                    },
                    status=status.HTTP_200_OK,
                )

        try:
            payload = compute_and_save_farmer_terrain(profile)
            payload['cached'] = False
            return Response(payload, status=status.HTTP_200_OK)
        except GEEComputationError as exc:
            logger.exception('Module 2 GEE computation failed for farmer %s', profile.pk)
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        except Exception as exc:
            logger.exception('Module 2 terrain analysis failed for farmer %s', profile.pk)
            return Response(
                {'detail': f'Terrain analysis failed: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
