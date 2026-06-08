from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from billing import entitlements as ent
from billing.models import PromoCode, PromoRedemption, Subscription
from billing.services import PromoError, effective_tier, get_entitlements, redeem_promo

User = get_user_model()


class EntitlementTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901234567')

    def test_default_free(self):
        self.assertEqual(effective_tier(self.user), ent.FREE)

    def test_oddiy_permanent(self):
        Subscription.objects.create(user=self.user, tier=ent.ODDIY, period=ent.ONETIME, expires_at=None)
        self.assertEqual(effective_tier(self.user), ent.ODDIY)

    def test_pro_active(self):
        Subscription.objects.create(
            user=self.user, tier=ent.PRO, period=ent.P1M,
            expires_at=timezone.now() + timedelta(days=10),
        )
        self.assertEqual(effective_tier(self.user), ent.PRO)

    def test_pro_overrides_oddiy(self):
        Subscription.objects.create(user=self.user, tier=ent.ODDIY, expires_at=None)
        Subscription.objects.create(
            user=self.user, tier=ent.PRO, period=ent.P1M,
            expires_at=timezone.now() + timedelta(days=5),
        )
        self.assertEqual(effective_tier(self.user), ent.PRO)

    def test_expired_pro_falls_back_to_oddiy(self):
        Subscription.objects.create(user=self.user, tier=ent.ODDIY, expires_at=None)
        Subscription.objects.create(
            user=self.user, tier=ent.PRO, period=ent.P1M,
            expires_at=timezone.now() - timedelta(days=1),
        )
        self.assertEqual(effective_tier(self.user), ent.ODDIY)

    def test_expired_pro_falls_back_to_free(self):
        Subscription.objects.create(
            user=self.user, tier=ent.PRO, period=ent.P1M,
            expires_at=timezone.now() - timedelta(days=1),
        )
        self.assertEqual(effective_tier(self.user), ent.FREE)

    def test_lifetime_pro(self):
        Subscription.objects.create(user=self.user, tier=ent.PRO, period='', expires_at=None, source='gift')
        self.assertEqual(effective_tier(self.user), ent.PRO)

    def test_get_entitlements_payload(self):
        e = get_entitlements(self.user)
        self.assertEqual(e['tier'], ent.FREE)
        self.assertEqual(e['features']['profile_limit'], 1)
        self.assertEqual(e['usage']['businesses'], 0)
        self.assertEqual(e['usage']['profile_limit'], 1)


class PromoCodeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901112233')

    def test_redeem_lifetime_pro(self):
        PromoCode.objects.create(code='lifepro', grant_tier=ent.PRO, duration_days=None)
        sub = redeem_promo(self.user, 'LIFEPRO')
        self.assertEqual(sub.tier, ent.PRO)
        self.assertIsNone(sub.expires_at)
        self.assertEqual(sub.source, 'promo')
        self.assertEqual(effective_tier(self.user), ent.PRO)
        self.assertEqual(PromoRedemption.objects.filter(user=self.user).count(), 1)

    def test_code_is_case_and_space_insensitive(self):
        PromoCode.objects.create(code='Welcome10', grant_tier=ent.ODDIY, duration_days=30)
        sub = redeem_promo(self.user, '  welcome10 ')
        self.assertEqual(sub.tier, ent.ODDIY)
        self.assertIsNotNone(sub.expires_at)

    def test_duration_days_sets_expiry(self):
        PromoCode.objects.create(code='PRO30', grant_tier=ent.PRO, duration_days=30)
        before = timezone.now() + timedelta(days=29)
        after = timezone.now() + timedelta(days=31)
        sub = redeem_promo(self.user, 'PRO30')
        self.assertTrue(before < sub.expires_at < after)

    def test_not_found(self):
        with self.assertRaises(PromoError) as ctx:
            redeem_promo(self.user, 'NOPE')
        self.assertEqual(ctx.exception.reason, 'not_found')

    def test_empty_code(self):
        with self.assertRaises(PromoError) as ctx:
            redeem_promo(self.user, '   ')
        self.assertEqual(ctx.exception.reason, 'not_found')

    def test_inactive(self):
        PromoCode.objects.create(code='OFF', grant_tier=ent.PRO, is_active=False)
        with self.assertRaises(PromoError) as ctx:
            redeem_promo(self.user, 'OFF')
        self.assertEqual(ctx.exception.reason, 'inactive')

    def test_expired(self):
        PromoCode.objects.create(code='OLD', grant_tier=ent.PRO,
                                 valid_until=timezone.now() - timedelta(days=1))
        with self.assertRaises(PromoError) as ctx:
            redeem_promo(self.user, 'OLD')
        self.assertEqual(ctx.exception.reason, 'expired')

    def test_exhausted(self):
        promo = PromoCode.objects.create(code='ONE', grant_tier=ent.PRO, max_redemptions=1)
        other = User.objects.create_user(phone_number='+998905556677')
        redeem_promo(other, 'ONE')
        promo.refresh_from_db()
        self.assertEqual(promo.redeemed_count, 1)
        with self.assertRaises(PromoError) as ctx:
            redeem_promo(self.user, 'ONE')
        self.assertEqual(ctx.exception.reason, 'exhausted')

    def test_once_per_user(self):
        PromoCode.objects.create(code='SOLO', grant_tier=ent.PRO, duration_days=30, once_per_user=True)
        redeem_promo(self.user, 'SOLO')
        with self.assertRaises(PromoError) as ctx:
            redeem_promo(self.user, 'SOLO')
        self.assertEqual(ctx.exception.reason, 'already_used')

    def test_repeatable_when_not_once_per_user(self):
        PromoCode.objects.create(code='MULTI', grant_tier=ent.ODDIY, duration_days=30,
                                 once_per_user=False, max_redemptions=None)
        redeem_promo(self.user, 'MULTI')
        redeem_promo(self.user, 'MULTI')
        self.assertEqual(PromoRedemption.objects.filter(user=self.user).count(), 2)

    def test_redeem_endpoint(self):
        PromoCode.objects.create(code='APIPRO', grant_tier=ent.PRO, duration_days=30)
        from rest_framework.test import APIClient
        from rest_framework.authtoken.models import Token
        client = APIClient()
        token = Token.objects.create(user=self.user)
        client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        res = client.post('/api/promo/redeem/', {'code': 'apipro'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['entitlements']['tier'], ent.PRO)

    def test_redeem_endpoint_bad_code(self):
        from rest_framework.test import APIClient
        from rest_framework.authtoken.models import Token
        client = APIClient()
        token = Token.objects.create(user=self.user)
        client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        res = client.post('/api/promo/redeem/', {'code': 'ghost'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'not_found')
