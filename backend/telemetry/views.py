import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import FarmerProfile
from telemetry.models import FieldTelemetry
from telemetry.services.telemetry_engine import VulnerabilityStressEngine

logger = logging.getLogger(__name__)


def compute_and_save_farmer_telemetry(profile: FarmerProfile) -> dict:
    """Run Module 1 VulnerabilityStressEngine using the farmer's saved lat/lon and persist it."""
    lat = float(profile.latitude)
    lon = float(profile.longitude)

    engine = VulnerabilityStressEngine.from_lat_lon(lat=lat, lon=lon)
    report = engine.build_vulnerability_stress_report()

    loc_key = f'farmer_{profile.pk}'
    FieldTelemetry.objects.update_or_create(
        farmer=profile,
        defaults={
            'location_id': loc_key,
            'location_name': profile.location_name,
            'latitude': report['centroid']['lat'],
            'longitude': report['centroid']['lon'],
            'territory_mode': report.get('territory_mode', ''),
            'start_date': report.get('window', {}).get('start_date', '2020-01-01'),
            'end_date': report.get('window', {}).get('end_date', ''),
            'polygon_coords': engine.polygon_coords,
            'summary_metrics': report.get('summary_metrics', {}),
            'climate_fallback': report.get('climate_fallback', {}),
            'vulnerability_stress_layer': report.get('vulnerability_stress_layer', {}),
            'raw_report': report,
        },
    )
    return {
        'location_id': loc_key,
        'location_name': profile.location_name,
        **report,
    }


class FarmerTelemetryView(APIView):
    """GET /api/telemetry/ — Fetch (or compute via Module 1) telemetry for the logged-in farmer."""

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
            existing = FieldTelemetry.objects.filter(farmer=profile).first()
            if existing and existing.raw_report:
                return Response(
                    {
                        'location_id': existing.location_id,
                        'location_name': existing.location_name or profile.location_name,
                        'cached': True,
                        'updated_at': existing.updated_at.isoformat(),
                        **existing.raw_report,
                    },
                    status=status.HTTP_200_OK,
                )

        try:
            payload = compute_and_save_farmer_telemetry(profile)
            payload['cached'] = False
            return Response(payload, status=status.HTTP_200_OK)
        except Exception as exc:
            logger.exception('Module 1 telemetry calculation failed for farmer %s', profile.pk)
            return Response(
                {'detail': f'Telemetry calculation failed: {exc}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )
