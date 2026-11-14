from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class FarmerAuthFlowTests(APITestCase):
    def test_register_token_and_profile_flow(self):
        register_url = reverse('accounts:register')
        payload = {
            'email': 'asha.farmer@example.com',
            'password': 'StrongPassword123',
            'full_name': 'Asha Devi',
            'location_name': 'Kumily, Kerala',
            'latitude': 9.603100,
            'longitude': 77.161500,
        }
        reg_res = self.client.post(register_url, payload, format='json')
        self.assertEqual(reg_res.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', reg_res.data)
        self.assertEqual(reg_res.data['profile']['full_name'], 'Asha Devi')

        # Unauthenticated profile request must fail with 401
        profile_url = reverse('accounts:profile')
        unauth_res = self.client.get(profile_url)
        self.assertEqual(unauth_res.status_code, status.HTTP_401_UNAUTHORIZED)

        # Obtain JWT via /api/token/
        token_url = reverse('accounts:token_obtain_pair')
        token_res = self.client.post(
            token_url,
            {'email': 'asha.farmer@example.com', 'password': 'StrongPassword123'},
            format='json',
        )
        self.assertEqual(token_res.status_code, status.HTTP_200_OK)
        access_token = token_res.data['access']

        # Fetch protected profile with Bearer token
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access_token}')
        profile_res = self.client.get(profile_url)
        self.assertEqual(profile_res.status_code, status.HTTP_200_OK)
        self.assertEqual(profile_res.data['email'], 'asha.farmer@example.com')
        self.assertEqual(profile_res.data['full_name'], 'Asha Devi')
        self.assertEqual(profile_res.data['location_name'], 'Kumily, Kerala')
        self.assertAlmostEqual(profile_res.data['latitude'], 9.6031, places=4)
        self.assertAlmostEqual(profile_res.data['longitude'], 77.1615, places=4)
