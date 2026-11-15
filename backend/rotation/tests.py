from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
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
                {
                    'water_availability': 80,
                    'budget': 40,
                    'market_demand': 70,
                    'equipment_access': 30,
                    'rainfall_delta_pct': -20,
                    'temp_delta_c': 1.5,
                    'preferred_language': 'en',
                },
                format='json',
            )
            self.assertEqual(recalc.status_code, 200)
            self.assertEqual(recalc.data['constraint_weights']['water_availability'], 80)
            self.assertEqual(recalc.data['constraint_weights']['equipment_access'], 30)
            self.assertEqual(recalc.data['climate_scenario']['rainfall_delta_pct'], -20.0)
            self.assertEqual(recalc.data['climate_scenario']['temp_delta_c'], 1.5)
            self.assertEqual(recalc.data['preferred_language_code'], 'en')
            self.assertIn('pest_cycle_disruption_score', recalc.data['data']['resilience_build'])
            self.assertIn('forage_biomass_potential', recalc.data['data']['resilience_build'])
            self.assertTrue(recalc.data['data']['local_expertise_charter'])

    def test_agri_suite_endpoints(self):
        metrics_res = self.client.get('/api/dashboard/metrics/')
        self.assertEqual(metrics_res.status_code, 200)
        self.assertIn('cluster_name', metrics_res.data)

        prof_res = self.client.get('/api/field-profile/?lat=9.8959&lon=76.7184')
        self.assertEqual(prof_res.status_code, 200)
        self.assertEqual(prof_res.data['status'], 'success')
        self.assertIn('crop_recommendations', prof_res.data)

        sim_res = self.client.post(
            '/api/simulate-rotation/',
            {'water_weight': 0.7, 'profit_weight': 0.8, 'soil_recovery_weight': 0.9, 'labor_weight': 0.5},
            format='json',
        )
        self.assertEqual(sim_res.status_code, 200)
        self.assertIn('top_rotation_regime', sim_res.data)

        diag_res = self.client.post('/api/diagnostics/scan/', {'sample_key': 'banana_sigatoka'})
        self.assertEqual(diag_res.status_code, 200)
        self.assertIn('diagnosis_badge', diag_res.data)

        voice_res = self.client.post('/api/voice/chat/', {'query_text': 'banana leaf spot', 'language': 'ml'}, format='json')
        self.assertEqual(voice_res.status_code, 200)
        self.assertIn('answer_text', voice_res.data)

        crm_res = self.client.get('/api/crm/farmers/')
        self.assertEqual(crm_res.status_code, 200)
        self.assertTrue(len(crm_res.data) >= 10)

        scheme_res = self.client.post(
            '/api/schemes/match/',
            {'crop': 'Paddy', 'land_category': 'small', 'farmer_category': 'general'},
            format='json',
        )
        self.assertEqual(scheme_res.status_code, 200)
        self.assertGreater(scheme_res.data['total_matched'], 0)

    def test_voice_chat_gemini_integration(self):
        voice_res = self.client.post(
            '/api/voice/chat/',
            {
                'query_text': 'how to protect banana from leaf spot?',
                'language': 'en',
            },
            format='json',
        )
        self.assertEqual(voice_res.status_code, 200)
        self.assertIn('answer_text', voice_res.data)
        self.assertEqual(voice_res.data['detected_intent'], 'Pest & Disease Advisory')

    def test_voice_chat_direct_profile_records(self):
        voice_res = self.client.post(
            '/api/voice/chat/',
            {
                'query_text': 'what is my farm profile?',
                'language': 'en',
            },
            format='json',
        )
        self.assertEqual(voice_res.status_code, 200)
        self.assertEqual(voice_res.data['detected_intent'], 'Farm Land & Crop Records')
        self.assertTrue(voice_res.data.get('farmer_context_used', False))
        self.assertIn('2.5', voice_res.data['answer_text'])

    def test_voice_chat_farmer_crops_query(self):
        voice_res = self.client.post(
            '/api/voice/chat/',
            {
                'query_text': 'what crops do I grow on my land?',
                'language': 'en',
            },
            format='json',
        )
        self.assertEqual(voice_res.status_code, 200)
        self.assertEqual(voice_res.data['detected_intent'], 'Farm Land & Crop Records')
        self.assertTrue(voice_res.data.get('farmer_context_used', False))
        self.assertTrue('Cardamom' in voice_res.data['answer_text'] or 'Black Pepper' in voice_res.data['answer_text'])

    def test_voice_chat_farmer_acreage_query(self):
        voice_res = self.client.post(
            '/api/voice/chat/',
            {
                'query_text': 'how much land acreage do I have?',
                'language': 'en',
            },
            format='json',
        )
        self.assertEqual(voice_res.status_code, 200)
        self.assertEqual(voice_res.data['detected_intent'], 'Farm Land & Crop Records')
        self.assertTrue(voice_res.data.get('farmer_context_used', False))
        self.assertIn('2.5', voice_res.data['answer_text'])

    def test_voice_chat_indirect_land_problem(self):
        voice_res = self.client.post(
            '/api/voice/chat/',
            {
                'query_text': 'what is the problem on my land?',
                'language': 'en',
            },
            format='json',
        )
        self.assertEqual(voice_res.status_code, 200)
        self.assertEqual(voice_res.data['detected_intent'], 'Farm Land Diagnostics')
        self.assertTrue(voice_res.data.get('farmer_context_used', False))
        self.assertIn('Water Stress', voice_res.data['answer_text'])

    def test_voice_chat_indirect_crop_improvement(self):
        voice_res = self.client.post(
            '/api/voice/chat/',
            {
                'query_text': 'how can I improve my crop growing?',
                'language': 'en',
            },
            format='json',
        )
        self.assertEqual(voice_res.status_code, 200)
        self.assertEqual(voice_res.data['detected_intent'], 'Crop Improvement Strategy')
        self.assertTrue(voice_res.data.get('farmer_context_used', False))
        self.assertIn('improve', voice_res.data['answer_text'].lower())

    def test_diagnostics_scan_valid_leaf_upload(self):
        fake_image = SimpleUploadedFile("banana_sigatoka_leaf.jpg", b"fake_jpeg_bytes", content_type="image/jpeg")
        res = self.client.post("/api/diagnostics/scan/", {"file": fake_image}, format="multipart")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get("is_valid_specimen", False))
        self.assertIn("Sigatoka", res.data["diagnosis_badge"])
        self.assertGreater(len(res.data.get("organic_remediation", [])), 0)
        self.assertGreater(len(res.data.get("chemical_schedule", [])), 0)
        self.assertGreater(len(res.data.get("soil_amendment", [])), 0)

    def test_diagnostics_scan_soil_health_card(self):
        fake_card = SimpleUploadedFile("soil_health_card.png", b"fake_png_bytes", content_type="image/png")
        res = self.client.post("/api/diagnostics/scan/", {"file": fake_card}, format="multipart")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data.get("is_valid_specimen", False))
        self.assertEqual(res.data.get("specimen_type"), "soil_report")
        self.assertIn("Acidic", res.data["diagnosis_badge"])

    def test_diagnostics_scan_invalid_file_extension(self):
        fake_pdf = SimpleUploadedFile("document.pdf", b"%PDF-fake", content_type="application/pdf")
        res = self.client.post("/api/diagnostics/scan/", {"file": fake_pdf}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.data.get("is_valid_specimen", True))
        self.assertIn("Unsupported file format", res.data["message"])

    def test_diagnostics_scan_exceeds_size_limit(self):
        huge_bytes = b"0" * (25 * 1024 * 1024 + 1024)
        huge_file = SimpleUploadedFile("huge_field_leaf.jpg", huge_bytes, content_type="image/jpeg")
        res = self.client.post("/api/diagnostics/scan/", {"file": huge_file}, format="multipart")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(res.data.get("is_valid_specimen", True))
        self.assertIn("exceeds the 25MB limit", res.data["message"])

    def test_diagnostics_scan_non_agricultural_image(self):
        fake_car = SimpleUploadedFile("car_photo.jpg", b"fake_bytes", content_type="image/jpeg")
        res = self.client.post("/api/diagnostics/scan/", {"file": fake_car}, format="multipart")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data.get("is_valid_specimen", True))
        self.assertEqual(res.data.get("specimen_type"), "unrecognized")
        self.assertIn("only scans Soil Reports and Crop Leaf Images", res.data.get("rejection_reason", ""))
    def test_diagnostics_samples_excludes_soil_health_card(self):
        res = self.client.get("/api/diagnostics/samples/")
        self.assertEqual(res.status_code, 200)
        sample_ids = [s["id"] for s in res.data]
        self.assertNotIn("soil_health_card", sample_ids)
        for s in res.data:
            self.assertTrue("leaf" in s["name"].lower() or "foliage" in s["name"].lower())

    def test_diagnostics_scan_non_leaf_non_soil_rejected(self):
        fake_dog = SimpleUploadedFile("pet_dog_face.jpg", b"fake_bytes", content_type="image/jpeg")
        res = self.client.post("/api/diagnostics/scan/", {"file": fake_dog}, format="multipart")
        self.assertEqual(res.status_code, 200)
        self.assertFalse(res.data.get("is_valid_specimen", True))
        self.assertEqual(res.data.get("specimen_type"), "unrecognized")
