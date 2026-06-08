from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from billing import entitlements as ent
from billing.models import Subscription
from billing.services import sync_locks
from businesses.models import Business

User = get_user_model()

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}


def make_business(owner, path, name, age_minutes=0):
    """Create a business with a deterministic created_at so 'oldest' ordering is
    stable in tests (auto_now_add timestamps can collide on fast machines)."""
    b = Business.objects.create(owner=owner, path=path, name=name)
    Business.objects.filter(pk=b.pk).update(
        created_at=timezone.now() - timedelta(minutes=age_minutes)
    )
    b.refresh_from_db()
    return b


@override_settings(CACHES=LOCMEM)
class ProfileLimitTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901112233')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def grant(self, tier, days=None):
        expires = None if days is None else timezone.now() + timedelta(days=days)
        return Subscription.objects.create(user=self.user, tier=tier, expires_at=expires)

    def test_free_creates_one(self):
        res = self.client.post('/api/businesses/', {'path': 'a', 'name': 'A'}, format='json')
        self.assertEqual(res.status_code, 201)

    def test_free_second_blocked(self):
        make_business(self.user, 'a', 'A')
        res = self.client.post('/api/businesses/', {'path': 'b', 'name': 'B'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'profile_limit')

    def test_pro_allows_more(self):
        self.grant(ent.PRO, days=30)
        make_business(self.user, 'a', 'A')
        res = self.client.post('/api/businesses/', {'path': 'b', 'name': 'B'}, format='json')
        self.assertEqual(res.status_code, 201)


@override_settings(CACHES=LOCMEM)
class LockSyncTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901112244')

    def test_sync_locks_excess_on_downgrade(self):
        # Pro with 3 businesses, then no subscription => free (limit 1).
        make_business(self.user, 'a', 'A', age_minutes=30)  # oldest
        make_business(self.user, 'b', 'B', age_minutes=20)
        make_business(self.user, 'c', 'C', age_minutes=10)
        locked = sync_locks(self.user)
        self.assertEqual(locked, 2)
        self.assertFalse(Business.objects.get(path='a').is_locked)  # oldest kept
        self.assertTrue(Business.objects.get(path='b').is_locked)
        self.assertTrue(Business.objects.get(path='c').is_locked)

    def test_sync_locks_noop_within_limit(self):
        Subscription.objects.create(user=self.user, tier=ent.PRO, expires_at=None)
        make_business(self.user, 'a', 'A')
        make_business(self.user, 'b', 'B')
        self.assertEqual(sync_locks(self.user), 0)
        self.assertFalse(Business.objects.get(path='b').is_locked)

    def test_sync_locks_preserves_manual_choice(self):
        # Free user, A locked manually, B active (1 active == limit). No further locks.
        a = make_business(self.user, 'a', 'A', age_minutes=20)
        make_business(self.user, 'b', 'B', age_minutes=10)
        a.is_locked = True
        a.save(update_fields=['is_locked'])
        self.assertEqual(sync_locks(self.user), 0)
        self.assertTrue(Business.objects.get(path='a').is_locked)
        self.assertFalse(Business.objects.get(path='b').is_locked)


@override_settings(CACHES=LOCMEM)
class PublicVisibilityTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901112255')
        self.client = APIClient()

    def test_locked_hidden_from_public(self):
        make_business(self.user, 'open', 'Open')
        b = make_business(self.user, 'shut', 'Shut')
        b.is_locked = True
        b.save(update_fields=['is_locked'])
        self.assertEqual(self.client.get('/api/public/open/').status_code, 200)
        self.assertEqual(self.client.get('/api/public/shut/').status_code, 404)

    def test_branding_and_verified_flags(self):
        make_business(self.user, 'free', 'Free')
        res = self.client.get('/api/public/free/')
        self.assertFalse(res.data['branding_removed'])
        self.assertFalse(res.data['verified'])

        Subscription.objects.create(user=self.user, tier=ent.PRO, expires_at=None)
        res = self.client.get('/api/public/free/')
        self.assertTrue(res.data['branding_removed'])
        self.assertTrue(res.data['verified'])


@override_settings(CACHES=LOCMEM)
class ToggleLockTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901112266')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        # Free user (limit 1): A active, B locked.
        self.a = make_business(self.user, 'a', 'A', age_minutes=20)
        self.b = make_business(self.user, 'b', 'B', age_minutes=10)
        self.b.is_locked = True
        self.b.save(update_fields=['is_locked'])

    def test_activate_blocked_at_limit(self):
        res = self.client.post('/api/businesses/b/lock/', {'is_locked': False}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'profile_limit')

    def test_deactivate_then_activate(self):
        r1 = self.client.post('/api/businesses/a/lock/', {'is_locked': True}, format='json')
        self.assertEqual(r1.status_code, 200)
        self.assertTrue(r1.data['is_locked'])
        r2 = self.client.post('/api/businesses/b/lock/', {'is_locked': False}, format='json')
        self.assertEqual(r2.status_code, 200)
        self.assertFalse(r2.data['is_locked'])

    def test_cannot_toggle_others_business(self):
        other = User.objects.create_user(phone_number='+998909998877')
        make_business(other, 'x', 'X')
        res = self.client.post('/api/businesses/x/lock/', {'is_locked': True}, format='json')
        self.assertEqual(res.status_code, 404)
