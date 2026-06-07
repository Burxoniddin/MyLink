from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from billing import entitlements as ent
from billing.models import Subscription
from billing.services import effective_tier, get_entitlements

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
