from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

User = get_user_model()

# Use in-memory cache in tests (DatabaseCache table isn't created by migrations).
LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


@override_settings(CACHES=LOCMEM)
class AuthTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        cache.clear()

    def test_email_register_and_password_login(self):
        r = self.client.post('/api/auth/email/otp/', {'email': 'a@b.com'}, format='json')
        self.assertEqual(r.status_code, 200)
        code = cache.get('otp_email_a@b.com')
        self.assertIsNotNone(code)

        r = self.client.post('/api/auth/register/', {'method': 'email', 'identifier': 'a@b.com', 'code': code, 'password': 'secret1'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertIn('token', r.data)

        r = self.client.post('/api/auth/login-password/', {'identifier': 'a@b.com', 'password': 'secret1'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('token', r.data)

        r = self.client.post('/api/auth/login-password/', {'identifier': 'a@b.com', 'password': 'wrong'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_phone_register(self):
        phone = '+998901112299'
        self.client.post('/api/auth/otp/', {'phone_number': phone}, format='json')
        code = cache.get(f'otp_{phone}')
        r = self.client.post('/api/auth/register/', {'method': 'phone', 'identifier': phone, 'code': code, 'password': 'secret1'}, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(User.objects.filter(phone_number=phone).exists())

    def test_register_duplicate_rejected(self):
        User.objects.create_user(password='x', email='dup@b.com')
        cache.set('otp_email_dup@b.com', '123456', 300)
        r = self.client.post('/api/auth/register/', {'method': 'email', 'identifier': 'dup@b.com', 'code': '123456', 'password': 'secret1'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_register_bad_code(self):
        cache.set('otp_email_x@b.com', '111111', 300)
        r = self.client.post('/api/auth/register/', {'method': 'email', 'identifier': 'x@b.com', 'code': '999999', 'password': 'secret1'}, format='json')
        self.assertEqual(r.status_code, 400)

    @patch('users.views.send_sms', return_value=True)
    def test_otp_flow(self, mock_sms):
        phone = '+998901112233'
        r = self.client.post('/api/auth/otp/', {'phone_number': phone}, format='json')
        self.assertEqual(r.status_code, 200)
        code = cache.get(f'otp_{phone}')
        self.assertIsNotNone(code)

        r = self.client.post('/api/auth/login/', {'phone_number': phone, 'code': code}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('token', r.data)
        self.assertTrue(User.objects.filter(phone_number=phone).exists())

    def test_me_requires_auth(self):
        self.assertEqual(self.client.get('/api/me/').status_code, 401)

    def test_set_password_then_login(self):
        user = User.objects.create_user(phone_number='+998900000000')
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)

        r = self.client.post('/api/auth/set-password/', {'password': 'newpass1'}, format='json')
        self.assertEqual(r.status_code, 200)

        self.client.credentials()
        r = self.client.post('/api/auth/login-password/', {'identifier': '+998900000000', 'password': 'newpass1'}, format='json')
        self.assertEqual(r.status_code, 200)

    def test_me_returns_has_password(self):
        user = User.objects.create_user(phone_number='+998900000002', password='p')
        token = Token.objects.create(user=user)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        r = self.client.get('/api/me/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['has_password'])

    def test_token_sliding_expiry(self):
        user = User.objects.create_user(phone_number='+998900000001')
        token = Token.objects.create(user=user)
        # Force the token to look 8 days old (> 7 day TTL).
        Token.objects.filter(pk=token.pk).update(created=timezone.now() - timedelta(days=8))

        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        r = self.client.get('/api/me/')
        self.assertEqual(r.status_code, 401)
        # Expired token should be deleted.
        self.assertFalse(Token.objects.filter(key=token.key).exists())

    def test_reset_password_by_code_and_autologin(self):
        User.objects.create_user(email='reset@b.com', password='oldpass1')
        cache.set('otp_email_reset@b.com', '654321', 300)
        r = self.client.post('/api/auth/reset-password-code/', {'method': 'email', 'identifier': 'reset@b.com', 'code': '654321', 'new_password': 'newpass2'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('token', r.data)  # auto-login

        r = self.client.post('/api/auth/login-password/', {'identifier': 'reset@b.com', 'password': 'newpass2'}, format='json')
        self.assertEqual(r.status_code, 200)


@override_settings(CACHES=LOCMEM)
class ReferralTests(TestCase):
    def setUp(self):
        from users.models import ReferralCode
        self.client = APIClient()
        cache.clear()
        self.referrer = User.objects.create_user(phone_number='+998901230001')
        self.code = ReferralCode.get_or_create_for(self.referrer).code

    def _register_email(self, email, ref=None):
        self.client.post('/api/auth/email/otp/', {'email': email}, format='json')
        code = cache.get(f'otp_email_{email}')
        payload = {'method': 'email', 'identifier': email, 'code': code, 'password': 'secret1'}
        if ref is not None:
            payload['ref'] = ref
        return self.client.post('/api/auth/register/', payload, format='json')

    def test_register_with_ref_sets_referred_by(self):
        r = self._register_email('friend@x.com', ref=self.code)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.get(email='friend@x.com').referred_by_id, self.referrer.id)

    def test_register_with_bad_ref_ignored(self):
        r = self._register_email('friend2@x.com', ref='NOPE99')
        self.assertEqual(r.status_code, 201)
        self.assertIsNone(User.objects.get(email='friend2@x.com').referred_by)

    def test_referral_endpoint_returns_code_and_stats(self):
        token = Token.objects.create(user=self.referrer)
        self.client.credentials(HTTP_AUTHORIZATION='Token ' + token.key)
        r = self.client.get('/api/referral/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['code'], self.code)
        self.assertIn('ref=' + self.code, r.data['link'])
        self.assertEqual(r.data['total_referred'], 0)
        self.assertEqual(r.data['cap'], 12)

    def test_referral_requires_auth(self):
        self.assertEqual(self.client.get('/api/referral/').status_code, 401)
