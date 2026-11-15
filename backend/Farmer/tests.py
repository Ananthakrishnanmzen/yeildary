import json

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.mail.backends.base import BaseEmailBackend
from django.test import TestCase, override_settings
from django.urls import resolve, reverse

from .models import FarmerProfile, PhoneVerification
from .services import normalize_phone_number

User = get_user_model()


class FarmerUrlTests(TestCase):
    def test_root_url_is_farmer_login(self):
        self.assertEqual(resolve('/').func.__name__, 'farmer_login')
        self.assertEqual(reverse('farmer:login'), '/')

    def test_signup_and_other_routes_reverse(self):
        self.assertEqual(reverse('farmer:signup'), '/signup/')
        self.assertEqual(reverse('farmer:login_page'), '/login/')
        self.assertEqual(reverse('farmer:dashboard'), '/dashboard/')
        self.assertEqual(reverse('farmer:password_reset'), '/password-reset/')

    def test_auth_pages_render(self):
        for url in [
            reverse('farmer:login'),
            reverse('farmer:signup'),
            reverse('farmer:password_reset'),
            reverse('farmer:terms'),
            reverse('farmer:privacy'),
            reverse('farmer:researcher_placeholder'),
        ]:
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 200)


class PhoneVerificationTests(TestCase):
    def test_normalizes_valid_numbers(self):
        self.assertEqual(normalize_phone_number('+91 98765 43210'), '+919876543210')
        self.assertEqual(normalize_phone_number('0091-98765-43210'), '+919876543210')

    def test_send_and_verify_code(self):
        response = self.client.post(
            reverse('farmer:phone_send_code'),
            data=json.dumps({'phone_number': '+919876543210'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertIn('dev_code', payload)
        self.assertEqual(len(payload['dev_code']), 6)

        response = self.client.post(
            reverse('farmer:phone_verify_code'),
            data=json.dumps(
                {
                    'phone_number': '+919876543210',
                    'code': payload['dev_code'],
                }
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.client.session['farmer_phone_verified']['phone'],
            '+919876543210',
        )

    def test_wrong_code_is_rejected(self):
        self.client.post(
            reverse('farmer:phone_send_code'),
            data=json.dumps({'phone_number': '+919876543210'}),
            content_type='application/json',
        )
        response = self.client.post(
            reverse('farmer:phone_verify_code'),
            data=json.dumps(
                {'phone_number': '+919876543210', 'code': '000000'}
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()['ok'])
        self.assertEqual(PhoneVerification.objects.get().attempts, 1)

    def test_resend_is_rate_limited(self):
        first = self.client.post(
            reverse('farmer:phone_send_code'),
            data=json.dumps({'phone_number': '+919876543210'}),
            content_type='application/json',
        )
        self.assertEqual(first.status_code, 200)
        second = self.client.post(
            reverse('farmer:phone_send_code'),
            data=json.dumps({'phone_number': '+919876543210'}),
            content_type='application/json',
        )
        self.assertEqual(second.status_code, 429)

    @override_settings(PHONE_VERIFICATION_RESEND_SECONDS=0)
    def test_existing_phone_cannot_request_code(self):
        user = User.objects.create_user(
            username='existing@example.com',
            email='existing@example.com',
            password='Verdant-Field-42!',
        )
        FarmerProfile.objects.create(
            user=user,
            phone_number='+919876543210',
            phone_verified=True,
            name='Existing Farmer',
            place_name='Idukki',
            latitude='9.85',
            longitude='76.97',
            farm_area_acres='2.00',
            crops_grown=['Rice'],
            gender='female',
            age=40,
            terms_accepted=True,
        )
        response = self.client.post(
            reverse('farmer:phone_send_code'),
            data=json.dumps({'phone_number': '+919876543210'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 409)


class FailingEmailBackend(BaseEmailBackend):
    """Email backend that always fails, used to simulate a broken SMTP setup."""

    def send_messages(self, email_messages):
        raise RuntimeError('SMTP is unavailable')


class EmailVerificationTests(TestCase):
    @override_settings(PHONE_VERIFICATION_DEV_MODE=True)
    def test_send_and_verify_code(self):
        response = self.client.post(
            reverse('farmer:email_send_code'),
            data=json.dumps({'email': 'farmer@example.com'}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertTrue(payload['ok'])
        self.assertEqual(len(payload['dev_code']), 6)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(payload['dev_code'], mail.outbox[0].body)

        response = self.client.post(
            reverse('farmer:email_verify_code'),
            data=json.dumps(
                {'email': 'farmer@example.com', 'code': payload['dev_code']}
            ),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            self.client.session['farmer_email_verified']['email'],
            'farmer@example.com',
        )

    @override_settings(
        PHONE_VERIFICATION_DEV_MODE=False,
        EMAIL_BACKEND='Farmer.tests.FailingEmailBackend',
    )
    def test_smtp_failure_is_reported(self):
        with self.assertLogs('Farmer.views', level='ERROR'):
            response = self.client.post(
                reverse('farmer:email_send_code'),
                data=json.dumps({'email': 'farmer@example.com'}),
                content_type='application/json',
            )
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()['ok'])


class FarmerSignupTests(TestCase):
    def _verify_phone(self, phone='+919876543210'):
        response = self.client.post(
            reverse('farmer:phone_send_code'),
            data=json.dumps({'phone_number': phone}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        code = response.json()['dev_code']
        response = self.client.post(
            reverse('farmer:phone_verify_code'),
            data=json.dumps({'phone_number': phone, 'code': code}),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)

    def _signup_data(self, **overrides):
        data = {
            'user_type': 'farmer',
            'name': 'Anitha Joseph',
            'email': 'anitha@example.com',
            'phone_number': '+919876543210',
            'place_name': 'Idukki, Kerala, India',
            'latitude': '9.850000',
            'longitude': '76.970000',
            'farm_area_acres': '2.50',
            'crops_grown': 'Rice, Banana, Black pepper, rice',
            'gender': 'female',
            'age': '42',
            'preferred_language': 'ml',
            'password': 'Verdant-Field-42!',
            'confirm_password': 'Verdant-Field-42!',
            'terms_accepted': 'on',
        }
        data.update(overrides)
        return data

    def test_signup_creates_user_profile_and_logs_in(self):
        self._verify_phone()
        response = self.client.post(
            reverse('farmer:signup'), data=self._signup_data()
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/dashboard/')

        user = User.objects.get(email='anitha@example.com')
        self.assertEqual(user.username, 'anitha@example.com')
        self.assertTrue(user.check_password('Verdant-Field-42!'))
        self.assertEqual(self.client.session['_auth_user_id'], str(user.pk))

        profile = FarmerProfile.objects.get(user=user)
        self.assertEqual(profile.name, 'Anitha Joseph')
        self.assertTrue(profile.phone_verified)
        self.assertEqual(profile.phone_number, '+919876543210')
        self.assertEqual(profile.place_name, 'Idukki, Kerala, India')
        self.assertEqual(str(profile.latitude), '9.850000')
        self.assertEqual(profile.farm_area_acres, 2.5)
        self.assertEqual(
            profile.crops_grown,
            ['Rice', 'Banana', 'Black pepper'],
        )
        self.assertTrue(profile.terms_accepted)
        self.assertIsNotNone(profile.terms_accepted_at)

    def test_signup_requires_verified_phone(self):
        response = self.client.post(
            reverse('farmer:signup'), data=self._signup_data()
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Verify this phone number')
        self.assertFalse(User.objects.filter(email='anitha@example.com').exists())

    def test_signup_rejects_mismatched_passwords(self):
        self._verify_phone()
        response = self.client.post(
            reverse('farmer:signup'),
            data=self._signup_data(confirm_password='Something-Else-42!'),
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'The passwords do not match.')
        self.assertFalse(User.objects.filter(email='anitha@example.com').exists())

    def test_signup_requires_terms_and_selected_place(self):
        self._verify_phone()
        data = self._signup_data()
        data.pop('terms_accepted')
        data['place_name'] = ''
        data['latitude'] = ''
        data['longitude'] = ''
        response = self.client.post(reverse('farmer:signup'), data=data)
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'must accept the Terms')
        self.assertContains(response, 'Search for and select a place')
        self.assertFalse(User.objects.filter(email='anitha@example.com').exists())

    def test_duplicate_email_is_rejected(self):
        User.objects.create_user(
            username='anitha@example.com',
            email='anitha@example.com',
            password='Verdant-Field-42!',
        )
        self._verify_phone()
        response = self.client.post(
            reverse('farmer:signup'), data=self._signup_data()
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'An account with this email already exists.')
        self.assertEqual(User.objects.filter(email='anitha@example.com').count(), 1)

    def test_signup_redirects_authenticated_users(self):
        user = User.objects.create_user(
            username='signed@example.com',
            email='signed@example.com',
            password='Verdant-Field-42!',
        )
        self.client.force_login(user)
        response = self.client.get(reverse('farmer:signup'))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/dashboard/')


class FarmerLoginTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='anitha@example.com',
            email='anitha@example.com',
            password='Verdant-Field-42!',
            first_name='Anitha',
        )

    def test_login_with_email(self):
        response = self.client.post(
            reverse('farmer:login'),
            {'email': 'anitha@example.com', 'password': 'Verdant-Field-42!'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/dashboard/')
        self.assertEqual(self.client.session['_auth_user_id'], str(self.user.pk))

    def test_login_is_case_insensitive_for_email(self):
        response = self.client.post(
            reverse('farmer:login'),
            {'email': 'ANITHA@EXAMPLE.COM', 'password': 'Verdant-Field-42!'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, '/dashboard/')

    def test_invalid_login_shows_error(self):
        response = self.client.post(
            reverse('farmer:login'),
            {'email': 'anitha@example.com', 'password': 'wrong-password'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Invalid email or password')

    def test_dashboard_requires_login(self):
        response = self.client.get(reverse('farmer:dashboard'))
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse('farmer:login'), response.url)
        self.assertIn('next=/dashboard/', response.url)

    def test_authenticated_dashboard_renders_profile_summary(self):
        FarmerProfile.objects.create(
            user=self.user,
            phone_number='+919876543210',
            phone_verified=True,
            name='Anitha Joseph',
            place_name='Idukki, Kerala',
            latitude='9.85',
            longitude='76.97',
            farm_area_acres='2.50',
            crops_grown=['Rice', 'Banana'],
            gender='female',
            age=42,
            preferred_language='ml',
            terms_accepted=True,
        )
        self.client.force_login(self.user)
        response = self.client.get(reverse('farmer:dashboard'))
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'Anitha Joseph')
        self.assertContains(response, 'Idukki, Kerala')
        self.assertContains(response, 'Rice')

    def test_logout_requires_post(self):
        self.client.force_login(self.user)
        get_response = self.client.get(reverse('farmer:logout'))
        self.assertEqual(get_response.status_code, 405)

        response = self.client.post(reverse('farmer:logout'))
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('farmer:login'))
        self.assertNotIn('_auth_user_id', self.client.session)


@override_settings(
    MAILERS={
        'default': {
            'BACKEND': 'django.core.mail.backends.locmem.EmailBackend',
        }
    }
)
class PasswordResetTests(TestCase):
    def test_password_reset_sends_email(self):
        User.objects.create_user(
            username='anitha@example.com',
            email='anitha@example.com',
            password='Verdant-Field-42!',
            first_name='Anitha',
        )
        mail.outbox.clear()
        response = self.client.post(
            reverse('farmer:password_reset'),
            {'email': 'anitha@example.com'},
        )
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, reverse('farmer:password_reset_done'))
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn('reset', mail.outbox[0].subject.lower())
        self.assertIn('/reset/', mail.outbox[0].body)
