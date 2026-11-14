from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import FarmerProfile
from rotation.services.gemini_advisor import generate_rotation_strategies
from telemetry.models import FieldTelemetry
from terrain.models import SoilAndErosion


class Module3RotationTests(TestCase):
    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create_user(
            username='farmer@example.com',
            email='farmer@example.com',
            password='StrongPassword123!',
        )
        self.profile = FarmerProfile.objects.create(
            user=self.user,
            full_name='Test Farmer',
            location_name='Idukki, Kerala',
            latitude=9.815478,
            longitude=76.999160,
            farm_area_acres=2.5,
            crops_grown=['Cardamom', 'Black Pepper'],
            preferred_language='ml',
        )
        FieldTelemetry.objects.create(
            farmer=self.profile,
            latitude=9.815478,
            longitude=76.999160,
            summary_metrics={
                'soil_moisture_m3_m3': 0.42,
                'rainfall_mm': 451.3,
                'et_mm': 85.0,
                'water_stress_index': 32.1,
            },
        )
        SoilAndErosion.objects.create(
            farmer=self.profile,
            erosion_risk_score=90.0,
            raw_slope_degrees=24.8,
            raw_rainfall_mm=451.3,
            soil_type='Clay Loam',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_gemini_fallback_returns_matrix_instead_of_raising(self):
        payload = {
            'farmer_context': {
                'location_name': 'Idukki, Kerala',
                'baseline_crops': ['Cardamom'],
                'preferred_language': 'Malayalam',
                'constraint_weights': {'water_availability': 50, 'budget': 50, 'market_demand': 50},
            },
            'realtime_telemetry_alerts': {
                'current_smap_moisture': 0.42,
                'water_stress_index': 32.1,
                'rusle_erosion_risk_score': 90.0,
                'slope_degrees': 24.8,
            },
            'market_context': {'overall_demand_status': 'Moderate'},
        }
        with patch('rotation.services.gemini_advisor.genai.Client', side_effect=RuntimeError('503 UNAVAILABLE')):
            result, used_fallback, model_used = generate_rotation_strategies(payload)
        self.assertTrue(used_fallback)
        self.assertEqual(model_used, 'fallback')
        self.assertIn('baseline', result)
        self.assertIn('resilience_build', result)
        self.assertIn('water_saver', result)

    def test_strategy_and_recalculate_endpoints_return_200_on_fallback(self):
        with patch('rotation.services.gemini_advisor.genai.Client', side_effect=RuntimeError('503 UNAVAILABLE')):
            res = self.client.get(reverse('module3-strategy'))
            self.assertEqual(res.status_code, 200)
            self.assertEqual(res.data['status'], 'completed')
            self.assertIn('baseline', res.data['data'])

            recalc = self.client.post(
                reverse('module3-recalculate'),
                {'water_availability': 80, 'budget': 40, 'market_demand': 70, 'preferred_language': 'en'},
                format='json',
            )
            self.assertEqual(recalc.status_code, 200)
            self.assertEqual(recalc.data['constraint_weights']['water_availability'], 80)
            self.assertEqual(recalc.data['preferred_language_code'], 'en')
