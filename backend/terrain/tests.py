from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import FarmerProfile
from terrain.models import SoilAndErosion
from terrain.utils import build_bounding_box_polygon

User = get_user_model()


class FarmerTerrainEndpointTests(APITestCase):
    def test_build_bounding_box_polygon_is_closed(self):
        poly = build_bounding_box_polygon(9.6031, 77.1615)
        self.assertEqual(poly['type'], 'Polygon')
        ring = poly['coordinates'][0]
        self.assertEqual(len(ring), 5)
        self.assertEqual(ring[0], ring[-1])

    @patch('terrain.views.calculate_erosion_risk')
    def test_authenticated_farmer_terrain_computes_and_caches(self, mock_calc):
        mock_calc.return_value = {
            'erosion_risk_score': 34.2,
            'raw_slope_degrees': 14.5,
            'raw_rainfall_mm': 240.0,
            'tree_cover_pct': 61.3,
            'exposed_cover_pct': 12.4,
            'canopy_height_m': 13.8,
            'canopy_status': 'Highly Protected (Canopy: 13.8m)',
            'dynamic_description': 'Moderate seasonal precipitation (240.0 mm/month)...',
            'soil_type': 'Clay loam',
            'analyzed_from': '2021-01-01',
            'analyzed_to': '2026-11-14',
        }

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
        url = reverse('terrain:farmer_terrain')

        res1 = self.client.get(url)
        self.assertEqual(res1.status_code, status.HTTP_200_OK)
        self.assertFalse(res1.data['cached'])
        self.assertEqual(res1.data['erosion_risk_score'], 34.2)
        self.assertEqual(res1.data['soil_type'], 'Clay loam')
        self.assertEqual(mock_calc.call_count, 1)
        self.assertTrue(SoilAndErosion.objects.filter(farmer=profile).exists())

        res2 = self.client.get(url)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertTrue(res2.data['cached'])
        self.assertEqual(mock_calc.call_count, 1)
