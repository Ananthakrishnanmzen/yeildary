from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import FarmerProfile
from telemetry.models import FieldTelemetry

User = get_user_model()


class FarmerTelemetryEndpointTests(APITestCase):
    @patch('telemetry.views.VulnerabilityStressEngine.from_lat_lon')
    def test_authenticated_farmer_telemetry_computes_and_caches(self, mock_from_lat_lon):
        mock_engine = MagicMock()
        mock_engine.polygon_coords = [[[77.15, 9.59], [77.17, 9.59], [77.17, 9.61], [77.15, 9.61], [77.15, 9.59]]]
        mock_engine.build_vulnerability_stress_report.return_value = {
            'centroid': {'lat': 9.6031, 'lon': 77.1615},
            'territory_mode': 'Global (MODIS MOD16A2GF + GLDAS-2.1 + GPM IMERG + NASA POWER)',
            'window': {'start_date': '2020-01-01', 'end_date': '2026-11-14'},
            'summary_metrics': {'sentinel2': {'s2_ndvi': 0.68}, 'smap': {'sm_rootzone': 0.24}},
            'climate_fallback': {'status': 'ok'},
            'location_rating': {
                'overall_score': 84.5,
                'letter_grade': 'A',
                'risk_tier': 'High Productivity Zone (Favorable Agro-Climate)',
                'water_security_rate': 90.0,
                'thermal_resilience_rate': 85.0,
                'vegetation_vitality_rate': 82.0,
                'microclimate_stability_rate': 80.0,
                'recommendation': 'Maintain balanced monitoring.',
            },
            'vulnerability_stress_layer': {
                'water_stress': {'drought_warnings_count': 0, 'active_drought_warning': False, 'series': []},
                'vegetation_health': {'climate_vulnerability_proven': False, 'vulnerability_events': []},
                'microclimate': {'stress_summary': {'stomatal_vpd_stress_steps': 1, 'fungal_humidity_risk_steps': 0}},
            },
        }
        mock_from_lat_lon.return_value = mock_engine

        user = User.objects.create_user(
            username='asha@example.com',
            email='asha@example.com',
            password='StrongPassword123',
        )
        profile = FarmerProfile.objects.create(
            user=user,
            full_name='Asha Devi',
            location_name='Kumily, Kerala',
            latitude=9.603100,
            longitude=77.161500,
        )

        self.client.force_authenticate(user=user)
        url = reverse('telemetry:farmer_telemetry')

        # First call computes & caches using farmer's lat/lon
        res1 = self.client.get(url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertFalse(res1.data['cached'])
        self.assertEqual(res1.data['location_rating']['overall_score'], 84.5)
        mock_from_lat_lon.assert_called_once_with(lat=9.6031, lon=77.1615)
        self.assertTrue(FieldTelemetry.objects.filter(farmer=profile).exists())

        # Second call returns cached report without re-running engine
        res2 = self.client.get(url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data['cached'])
        self.assertEqual(mock_from_lat_lon.call_count, 1)
