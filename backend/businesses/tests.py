from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from billing import entitlements as ent
from billing.models import Subscription
from billing.services import sync_locks
from businesses.models import (
    MAX_BIO_CHARS, MAX_BLOCKS_PER_SECTION, Business, BusinessMembership, ContentBlock,
    Event, MediaSection, NfcOrder,
)
from businesses.access import claim_pending_invites

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

    def test_free_second_created_locked(self):
        # Creation is unlimited on every tier; over-limit pages arrive inactive
        # (locked) and the owner activates them after freeing a slot / upgrade.
        make_business(self.user, 'a', 'A')
        res = self.client.post('/api/businesses/', {'path': 'b', 'name': 'B'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertTrue(Business.objects.get(path='b').is_locked)
        self.assertFalse(Business.objects.get(path='a').is_locked)
        # Activating the locked one while at limit is rejected.
        lock = self.client.post('/api/businesses/b/lock/', {'is_locked': False}, format='json')
        self.assertEqual(lock.status_code, 403)
        self.assertEqual(lock.data['reason'], 'profile_limit')

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


@override_settings(CACHES=LOCMEM)
class TogglePinTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901112277')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        # Pro so both pages stay active (no lock noise) while testing ordering.
        Subscription.objects.create(user=self.user, tier=ent.PRO, expires_at=None)
        self.a = make_business(self.user, 'a', 'A', age_minutes=20)  # older
        self.b = make_business(self.user, 'b', 'B', age_minutes=10)  # newer

    def test_pin_and_unpin(self):
        r = self.client.post('/api/businesses/a/pin/', {'is_pinned': True}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['is_pinned'])
        self.assertTrue(Business.objects.get(path='a').is_pinned)
        r2 = self.client.post('/api/businesses/a/pin/', {'is_pinned': False}, format='json')
        self.assertEqual(r2.status_code, 200)
        self.assertFalse(Business.objects.get(path='a').is_pinned)

    def test_pinned_floats_to_top(self):
        # Default: newest (b) first. Pin the older (a) => a floats to the top.
        res = self.client.get('/api/businesses/')
        self.assertEqual([x['path'] for x in res.data], ['b', 'a'])
        self.client.post('/api/businesses/a/pin/', {'is_pinned': True}, format='json')
        res = self.client.get('/api/businesses/')
        self.assertEqual([x['path'] for x in res.data], ['a', 'b'])

    def test_cannot_pin_others_business(self):
        other = User.objects.create_user(phone_number='+998909990011')
        make_business(other, 'x', 'X')
        res = self.client.post('/api/businesses/x/pin/', {'is_pinned': True}, format='json')
        self.assertEqual(res.status_code, 404)


@override_settings(CACHES=LOCMEM)
class TemplateTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901113311')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_default_template_is_classic(self):
        b = make_business(self.user, 'a', 'A')
        self.assertEqual(b.template, 'classic')

    def test_free_cannot_change_template(self):
        # Free: templates=1 — faqat 'classic'; boshqa tanlov jimgina e'tiborsiz.
        make_business(self.user, 'a', 'A')
        res = self.client.put('/api/businesses/a/', {'path': 'a', 'name': 'A', 'template': 'restoran'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(Business.objects.get(path='a').template, 'classic')

    def test_paid_tier_unlocks_templates_in_order(self):
        from billing.services import grant_subscription
        grant_subscription(self.user, 'oddiy')  # templates=3: classic, restoran, moda
        make_business(self.user, 'a', 'A')
        res = self.client.put('/api/businesses/a/', {'path': 'a', 'name': 'A', 'template': 'restoran'}, format='json')
        self.assertEqual(res.data['template'], 'restoran')
        # 3 talikdan tashqaridagi shablon o'tmaydi
        self.client.put('/api/businesses/a/', {'path': 'a', 'name': 'A', 'template': 'avto'}, format='json')
        self.assertEqual(Business.objects.get(path='a').template, 'restoran')

    def test_pro_gets_all_templates(self):
        from billing.services import grant_subscription
        grant_subscription(self.user, 'pro')
        make_business(self.user, 'a', 'A')
        res = self.client.put('/api/businesses/a/', {'path': 'a', 'name': 'A', 'template': 'fitnes'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['template'], 'fitnes')

    def test_downgraded_owner_can_return_to_classic(self):
        b = make_business(self.user, 'a', 'A')
        b.template = 'avto'
        b.save(update_fields=['template'])
        self.client.put('/api/businesses/a/', {'path': 'a', 'name': 'A', 'template': 'classic'}, format='json')
        self.assertEqual(Business.objects.get(path='a').template, 'classic')

    def test_free_create_with_paid_template_falls_back(self):
        res = self.client.post('/api/businesses/', {'path': 'b', 'name': 'B', 'template': 'moda'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Business.objects.get(path='b').template, 'classic')

    def test_invalid_template_rejected(self):
        make_business(self.user, 'a', 'A')
        res = self.client.put('/api/businesses/a/', {'path': 'a', 'name': 'A', 'template': 'bogus'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_public_payload_includes_template(self):
        b = make_business(self.user, 'a', 'A')
        b.template = 'moda'
        b.save(update_fields=['template'])
        res = APIClient().get('/api/public/a/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['template'], 'moda')


@override_settings(CACHES=LOCMEM)
class AssetTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901113300')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.biz = make_business(self.user, 'brand', 'Brand')

    def test_free_qr_png_forbidden(self):
        res = self.client.get('/api/businesses/brand/qr.png')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'qr')

    def test_story_open_to_free(self):
        # Instagram-story image is ungated (watermarked marketing).
        res = self.client.get('/api/businesses/brand/story.png')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'image/png')
        self.assertGreater(len(res.content), 0)

    def test_oddiy_png_ok_pdf_forbidden(self):
        Subscription.objects.create(user=self.user, tier=ent.ODDIY, expires_at=None)
        png = self.client.get('/api/businesses/brand/qr.png')
        self.assertEqual(png.status_code, 200)
        self.assertEqual(png['Content-Type'], 'image/png')
        self.assertGreater(len(png.content), 0)
        pdf = self.client.get('/api/businesses/brand/qr.pdf')
        self.assertEqual(pdf.status_code, 403)

    def test_pro_all_formats(self):
        Subscription.objects.create(user=self.user, tier=ent.PRO, expires_at=None)
        for ext, ctype in [('qr.png', 'image/png'), ('qr.pdf', 'application/pdf'), ('card.pdf', 'application/pdf')]:
            res = self.client.get(f'/api/businesses/brand/{ext}')
            self.assertEqual(res.status_code, 200, ext)
            self.assertEqual(res['Content-Type'], ctype, ext)
            self.assertGreater(len(res.content), 0, ext)

    def test_cannot_download_others(self):
        other = User.objects.create_user(phone_number='+998909995544')
        Subscription.objects.create(user=other, tier=ent.PRO, expires_at=None)
        make_business(other, 'theirs', 'Theirs')
        res = self.client.get('/api/businesses/theirs/qr.png')
        self.assertEqual(res.status_code, 404)

    def test_card_theme_variants(self):
        """Vizitka rangi biznes sahifasi temasidan olinadi — har bir shablon/
        palitra/rejim kombinatsiyasi yaroqli PDF qaytarishi kerak."""
        Subscription.objects.create(user=self.user, tier=ent.PRO, expires_at=None)
        biz = Business.objects.get(path='brand')
        cases = [
            ('classic', 'default', ''), ('classic', 'ocean', ''), ('classic', 'noir', 'light'),
            ('restoran', 'default', ''), ('moda', 'default', ''), ('moda', 'default', 'dark'),
            ('klinika', 'default', ''), ('avto', 'default', 'light'), ('fitnes', 'default', ''),
        ]
        for template, theme, mode in cases:
            Business.objects.filter(pk=biz.pk).update(template=template, theme=theme, theme_mode=mode)
            res = self.client.get('/api/businesses/brand/card.pdf')
            label = f'{template}/{theme}/{mode}'
            self.assertEqual(res.status_code, 200, label)
            self.assertTrue(res.content.startswith(b'%PDF'), label)
            self.assertIn('card.pdf', res['Content-Disposition'], label)

    def test_card_still_pro_gated(self):
        Subscription.objects.create(user=self.user, tier=ent.ODDIY, expires_at=None)
        res = self.client.get('/api/businesses/brand/card.pdf')
        self.assertEqual(res.status_code, 403)


@override_settings(CACHES=LOCMEM)
class MediaSectionTests(TestCase):
    """Media sections (grouped blocks): section count is tier-gated (``banners``),
    each section holds at most MAX_BLOCKS_PER_SECTION blocks."""

    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901114400')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.biz = make_business(self.user, 'brand', 'Brand')

    def grant(self, tier):
        Subscription.objects.create(user=self.user, tier=tier, expires_at=None)

    def _add_section(self, name='Filiallar'):
        return self.client.post('/api/businesses/brand/sections/', {'name': name}, format='json')

    def _add_block(self, section_id, **data):
        return self.client.post('/api/businesses/brand/blocks/', {'section': section_id, **data}, format='json')

    def test_free_cannot_create_section(self):
        res = self._add_section()
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'section_limit')

    def test_oddiy_section_limit_three(self):
        self.grant(ent.ODDIY)
        for i in range(3):
            self.assertEqual(self._add_section(f's{i}').status_code, 201)
        over = self._add_section('x')
        self.assertEqual(over.status_code, 403)
        self.assertEqual(over.data['reason'], 'section_limit')

    def test_section_block_hard_limit_ten(self):
        self.grant(ent.PRO)
        sid = self._add_section().data['id']
        for i in range(MAX_BLOCKS_PER_SECTION):
            self.assertEqual(self._add_block(sid, block_type='text', text=f't{i}').status_code, 201)
        over = self._add_block(sid, block_type='text', text='x')
        self.assertEqual(over.status_code, 403)
        self.assertEqual(over.data['reason'], 'section_block_limit')

    def test_block_requires_own_section(self):
        self.grant(ent.PRO)
        # No section at all → rejected.
        res = self.client.post('/api/businesses/brand/blocks/', {'block_type': 'text', 'text': 'x'}, format='json')
        self.assertEqual(res.status_code, 400)
        # A section belonging to another business → rejected.
        other = User.objects.create_user(phone_number='+998909994433')
        Subscription.objects.create(user=other, tier=ent.PRO, expires_at=None)
        other_biz = make_business(other, 'theirs', 'Theirs')
        foreign = MediaSection.objects.create(business=other_biz, name='X')
        res = self._add_block(foreign.id, block_type='text', text='x')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'invalid_section')

    def test_oddiy_video_forbidden(self):
        self.grant(ent.ODDIY)
        sid = self._add_section().data['id']
        res = self._add_block(sid, block_type='video', embed_url='https://youtu.be/x')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'banner_video')

    def test_pro_video_ok_and_order(self):
        self.grant(ent.PRO)
        sid = self._add_section().data['id']
        a = self._add_block(sid, block_type='video', embed_url='https://youtu.be/x')
        b = self._add_block(sid, block_type='text', text='hello')
        self.assertEqual(a.status_code, 201)
        self.assertEqual(b.status_code, 201)
        self.assertLess(a.data['order'], b.data['order'])

    def test_section_reorder(self):
        self.grant(ent.PRO)
        ids = [self._add_section(f's{i}').data['id'] for i in range(3)]
        self.client.post('/api/businesses/brand/sections/reorder/', {'order': list(reversed(ids))}, format='json')
        res = self.client.get('/api/businesses/brand/sections/')
        self.assertEqual([s['id'] for s in res.data], list(reversed(ids)))

    def test_section_rename_and_delete_cascades(self):
        self.grant(ent.PRO)
        sid = self._add_section('Old').data['id']
        self._add_block(sid, block_type='text', text='x')
        res = self.client.patch(f'/api/sections/{sid}/', {'name': 'New'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['name'], 'New')
        self.assertEqual(self.client.delete(f'/api/sections/{sid}/').status_code, 204)
        self.assertEqual(ContentBlock.objects.filter(business=self.biz).count(), 0)

    def test_block_delete(self):
        self.grant(ent.PRO)
        sid = self._add_section().data['id']
        bid = self._add_block(sid, block_type='text', text='x').data['id']
        self.assertEqual(self.client.delete(f'/api/blocks/{bid}/').status_code, 204)
        self.assertEqual(ContentBlock.objects.filter(business=self.biz).count(), 0)

    def test_sections_in_public_payload(self):
        self.grant(ent.PRO)
        sid = self._add_section('Promo bo\'lim').data['id']
        self._add_block(sid, block_type='text', title='Promo', text='Sale')
        self._add_section('Empty')  # blocksiz bo'lim publicda ko'rinmaydi
        res = self.client.get('/api/public/brand/')
        self.assertEqual(len(res.data['media_sections']), 1)
        section = res.data['media_sections'][0]
        self.assertEqual(section['name'], "Promo bo'lim")
        self.assertEqual(section['blocks'][0]['title'], 'Promo')

    def test_cannot_create_on_others(self):
        other = User.objects.create_user(phone_number='+998909994434')
        Subscription.objects.create(user=other, tier=ent.PRO, expires_at=None)
        make_business(other, 'theirs2', 'Theirs2')
        res = self.client.post('/api/businesses/theirs2/sections/', {'name': 'x'}, format='json')
        self.assertEqual(res.status_code, 404)


@override_settings(CACHES=LOCMEM)
class TrackTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901115500')
        self.biz = make_business(self.user, 'brand', 'Brand')
        self.client = APIClient()  # anonymous visitor

    def test_track_view_and_click(self):
        self.assertEqual(self.client.post('/api/track/', {'path': 'brand', 'event_type': 'view'}, format='json').status_code, 201)
        self.assertEqual(self.client.post('/api/track/', {'path': 'brand', 'event_type': 'click', 'label': 'Instagram'}, format='json').status_code, 201)
        self.assertEqual(Event.objects.filter(business=self.biz).count(), 2)

    def test_bad_event_type(self):
        res = self.client.post('/api/track/', {'path': 'brand', 'event_type': 'hack'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Event.objects.count(), 0)

    def test_unknown_path_noop(self):
        res = self.client.post('/api/track/', {'path': 'nope', 'event_type': 'view'}, format='json')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(Event.objects.count(), 0)

    def test_locked_page_not_tracked(self):
        self.biz.is_locked = True
        self.biz.save(update_fields=['is_locked'])
        res = self.client.post('/api/track/', {'path': 'brand', 'event_type': 'view'}, format='json')
        self.assertEqual(res.status_code, 204)
        self.assertEqual(Event.objects.count(), 0)


@override_settings(CACHES=LOCMEM)
class AnalyticsTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901115511')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.biz = make_business(self.user, 'brand', 'Brand')

    def grant(self, tier):
        Subscription.objects.create(user=self.user, tier=tier, expires_at=None)

    def seed(self):
        Event.objects.create(business=self.biz, event_type='view')
        Event.objects.create(business=self.biz, event_type='view')
        Event.objects.create(business=self.biz, event_type='click', label='Instagram')

    def test_free_forbidden(self):
        res = self.client.get('/api/businesses/brand/analytics/')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'analytics')

    def test_oddiy_partial_no_top_links(self):
        self.grant(ent.ODDIY)
        self.seed()
        res = self.client.get('/api/businesses/brand/analytics/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['level'], 'partial')
        self.assertEqual(res.data['days'], 7)
        self.assertEqual(res.data['totals']['view'], 2)
        self.assertEqual(res.data['totals']['click'], 1)
        self.assertNotIn('top_links', res.data)

    def test_pro_full_with_top_links(self):
        self.grant(ent.PRO)
        self.seed()
        res = self.client.get('/api/businesses/brand/analytics/')
        self.assertEqual(res.data['level'], 'full')
        self.assertEqual(res.data['days'], 30)
        self.assertEqual(len(res.data['daily']), 31)
        self.assertEqual(res.data['top_links'][0]['label'], 'Instagram')
        self.assertEqual(res.data['top_links'][0]['clicks'], 1)

    def test_cannot_view_others(self):
        other = User.objects.create_user(phone_number='+998909991122')
        make_business(other, 'theirs', 'Theirs')
        res = self.client.get('/api/businesses/theirs/analytics/')
        self.assertEqual(res.status_code, 404)


@override_settings(CACHES=LOCMEM)
class ThemeGateTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901116600')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        self.biz = make_business(self.user, 'brand', 'Brand')

    def test_free_cannot_change_theme(self):
        res = self.client.patch('/api/businesses/brand/', {'theme': 'ocean'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.biz.refresh_from_db()
        self.assertEqual(self.biz.theme, 'default')  # gated -> ignored

    def test_pro_can_change_theme(self):
        Subscription.objects.create(user=self.user, tier=ent.PRO, expires_at=None)
        res = self.client.patch('/api/businesses/brand/', {'theme': 'ocean'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.biz.refresh_from_db()
        self.assertEqual(self.biz.theme, 'ocean')

    def test_theme_in_public_payload(self):
        res = self.client.get('/api/public/brand/')
        self.assertEqual(res.data['theme'], 'default')

    def test_theme_mode_ungated_and_public(self):
        # Dark/light mode is part of the template choice — even free can set it.
        res = self.client.patch('/api/businesses/brand/', {'theme_mode': 'light'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.biz.refresh_from_db()
        self.assertEqual(self.biz.theme_mode, 'light')
        pub = self.client.get('/api/public/brand/')
        self.assertEqual(pub.data['theme_mode'], 'light')

    def test_theme_mode_invalid_rejected(self):
        res = self.client.patch('/api/businesses/brand/', {'theme_mode': 'neon'}, format='json')
        self.assertEqual(res.status_code, 400)


@override_settings(CACHES=LOCMEM)
class NfcOrderTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901117700')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    @patch('businesses.views.send_telegram_message')
    def test_create_order_forwards_to_telegram(self, mock_tg):
        res = self.client.post('/api/nfc/orders/',
                               {'full_name': 'Ali', 'phone': '+998901112233', 'quantity': 5, 'note': 'logo bilan'},
                               format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(NfcOrder.objects.filter(user=self.user).count(), 1)
        mock_tg.assert_called_once()

    @patch('businesses.views.send_telegram_message')
    def test_list_returns_only_own_orders(self, mock_tg):
        other = User.objects.create_user(phone_number='+998909990022')
        NfcOrder.objects.create(user=other, full_name='X', phone='+998900000000', quantity=1)
        NfcOrder.objects.create(user=self.user, full_name='Me', phone='+998901112233', quantity=2)
        res = self.client.get('/api/nfc/orders/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['full_name'], 'Me')

    def test_requires_auth(self):
        self.client.credentials()
        res = self.client.post('/api/nfc/orders/', {'full_name': 'A', 'phone': '1', 'quantity': 1}, format='json')
        self.assertEqual(res.status_code, 401)

    @patch('businesses.views.send_telegram_message')
    def test_invalid_quantity_rejected(self, mock_tg):
        res = self.client.post('/api/nfc/orders/',
                               {'full_name': 'Ali', 'phone': '+998901112233', 'quantity': 0}, format='json')
        self.assertEqual(res.status_code, 400)

    @patch('businesses.views.send_telegram_message')
    def test_phone_required_and_format(self, mock_tg):
        # Missing phone → required.
        r1 = self.client.post('/api/nfc/orders/', {'full_name': 'A', 'quantity': 1}, format='json')
        self.assertEqual(r1.status_code, 400)
        self.assertIn('phone', r1.data)
        # Garbage phone → format error.
        r2 = self.client.post('/api/nfc/orders/',
                              {'full_name': 'A', 'phone': '12-34', 'quantity': 1}, format='json')
        self.assertEqual(r2.status_code, 400)
        self.assertIn('phone', r2.data)

    @patch('businesses.views.send_telegram_message')
    def test_phone_normalized(self, mock_tg):
        # Local 9-digit form is normalised to +998…
        res = self.client.post('/api/nfc/orders/',
                              {'full_name': 'A', 'phone': '90 123 45 67', 'quantity': 1}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(NfcOrder.objects.get().phone, '+998901234567')

    @patch('businesses.views.send_telegram_message')
    def test_own_business_attaches(self, mock_tg):
        biz = make_business(self.user, 'mine', 'Mine')
        res = self.client.post('/api/nfc/orders/',
                              {'full_name': 'A', 'phone': '+998901112233', 'quantity': 1, 'business': biz.id},
                              format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(NfcOrder.objects.get().business_id, biz.id)
        self.assertEqual(res.data['business_name'], 'Mine')

    @patch('businesses.views.send_telegram_message')
    def test_cannot_attach_others_business(self, mock_tg):
        other = User.objects.create_user(phone_number='+998909990033')
        biz = make_business(other, 'theirs', 'Theirs')
        res = self.client.post('/api/nfc/orders/',
                              {'full_name': 'A', 'phone': '+998901112233', 'quantity': 1, 'business': biz.id},
                              format='json')
        self.assertEqual(res.status_code, 400)  # not in the user's queryset


def auth_client(user):
    client = APIClient()
    token = Token.objects.create(user=user)
    client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
    return client


@override_settings(CACHES=LOCMEM)
class TeamMembershipTests(TestCase):
    """4e — business team/roles (admin/editor/viewer) + pending invites."""

    def setUp(self):
        # Owner is Pro (team feature requires Pro).
        self.owner = User.objects.create_user(phone_number='+998900000001')
        Subscription.objects.create(user=self.owner, tier=ent.PRO, expires_at=None)
        self.business = make_business(self.owner, 'shop', 'Shop')
        self.owner_client = auth_client(self.owner)

    def add_member(self, role, email=None, phone=None):
        user = User.objects.create_user(phone_number=phone, email=email)
        m = BusinessMembership.objects.create(business=self.business, user=user, role=role)
        return user, m

    # --- inviting ---
    def test_owner_invites_existing_user(self):
        invitee = User.objects.create_user(email='bob@x.com')
        res = self.owner_client.post(
            '/api/businesses/shop/members/', {'identifier': 'bob@x.com', 'role': 'editor'}, format='json')
        self.assertEqual(res.status_code, 201)
        m = BusinessMembership.objects.get(business=self.business, user=invitee)
        self.assertEqual(m.role, 'editor')
        self.assertIsNotNone(m.accepted_at)

    def test_phone_invite_unregistered_is_pending_then_claimed(self):
        res = self.owner_client.post(
            '/api/businesses/shop/members/', {'identifier': '+998900000077', 'role': 'viewer'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(len(mail.outbox), 0)  # phone invites send nothing
        m = BusinessMembership.objects.get(invite_phone='+998900000077')
        self.assertIsNone(m.user_id)  # pending
        # The invitee registers later → invite is claimed.
        newcomer = User.objects.create_user(phone_number='+998900000077')
        claimed = claim_pending_invites(newcomer)
        self.assertEqual(claimed, 1)
        m.refresh_from_db()
        self.assertEqual(m.user_id, newcomer.id)

    def test_email_invite_without_account_creates_user_and_mails(self):
        with patch('businesses.views.get_random_string', return_value='Temp2345xy'):
            res = self.owner_client.post(
                '/api/businesses/shop/members/', {'identifier': 'new@x.com', 'role': 'editor'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertIs(res.data['email_sent'], True)
        user = User.objects.get(email='new@x.com')
        self.assertTrue(user.has_usable_password())
        m = BusinessMembership.objects.get(business=self.business, user=user)
        self.assertEqual(m.role, 'editor')
        self.assertIsNotNone(m.accepted_at)  # active immediately, not pending
        self.assertEqual(len(mail.outbox), 1)
        body = mail.outbox[0].body
        self.assertIn('Temp2345xy', body)
        self.assertIn('/login', body)
        # The temp password actually works for password login.
        login = APIClient().post(
            '/api/auth/login-password/', {'identifier': 'new@x.com', 'password': 'Temp2345xy'}, format='json')
        self.assertEqual(login.status_code, 200)

    def test_email_invite_existing_user_sends_notice(self):
        User.objects.create_user(email='old@x.com')
        res = self.owner_client.post(
            '/api/businesses/shop/members/', {'identifier': 'old@x.com', 'role': 'viewer'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertIs(res.data['email_sent'], True)
        self.assertEqual(len(mail.outbox), 1)
        self.assertNotIn('parol', mail.outbox[0].body.lower())  # no credentials in notice
        self.assertIn('/dashboard', mail.outbox[0].body)

    def test_email_invite_smtp_failure_still_201(self):
        with patch('businesses.emails.send_mail', side_effect=OSError('smtp down')):
            res = self.owner_client.post(
                '/api/businesses/shop/members/', {'identifier': 'flaky@x.com', 'role': 'viewer'}, format='json')
        self.assertEqual(res.status_code, 201)
        self.assertIs(res.data['email_sent'], False)
        user = User.objects.get(email='flaky@x.com')
        self.assertTrue(BusinessMembership.objects.filter(business=self.business, user=user).exists())

    def test_email_invite_claims_other_pending_invites(self):
        # A pending invite from ANOTHER business addressed to the same email
        # attaches to the freshly created account.
        other_owner = User.objects.create_user(phone_number='+998900000088')
        Subscription.objects.create(user=other_owner, tier=ent.PRO, expires_at=None)
        other_biz = make_business(other_owner, 'otherbiz', 'Other')
        BusinessMembership.objects.create(business=other_biz, role='viewer', invite_email='multi@x.com')

        res = self.owner_client.post(
            '/api/businesses/shop/members/', {'identifier': 'multi@x.com', 'role': 'viewer'}, format='json')
        self.assertEqual(res.status_code, 201)
        user = User.objects.get(email='multi@x.com')
        self.assertEqual(BusinessMembership.objects.filter(user=user).count(), 2)
        self.assertFalse(BusinessMembership.objects.filter(user__isnull=True, invite_email='multi@x.com').exists())

    def test_invite_blocked_without_pro(self):
        free_owner = User.objects.create_user(phone_number='+998900000099')
        make_business(free_owner, 'freeshop', 'Free')
        res = auth_client(free_owner).post(
            '/api/businesses/freeshop/members/', {'identifier': 'a@x.com', 'role': 'viewer'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'team')

    def test_cannot_invite_owner(self):
        res = self.owner_client.post(
            '/api/businesses/shop/members/',
            {'identifier': self.owner.phone_number, 'role': 'admin'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'owner')

    def test_duplicate_member_rejected(self):
        self.add_member('viewer', email='c@x.com')
        res = self.owner_client.post(
            '/api/businesses/shop/members/', {'identifier': 'c@x.com', 'role': 'admin'}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'already_member')

    # --- role-gated access ---
    def test_editor_can_edit_viewer_cannot(self):
        editor, _ = self.add_member('editor', phone='+998900000010')
        viewer, _ = self.add_member('viewer', phone='+998900000011')
        payload = {'path': 'shop', 'name': 'Renamed', 'links': []}
        self.assertEqual(auth_client(editor).put('/api/businesses/shop/', payload, format='json').status_code, 200)
        res = auth_client(viewer).put('/api/businesses/shop/', payload, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'role')

    def test_viewer_can_read(self):
        viewer, _ = self.add_member('viewer', phone='+998900000012')
        self.assertEqual(auth_client(viewer).get('/api/businesses/shop/').status_code, 200)

    def test_non_member_gets_404(self):
        stranger = User.objects.create_user(phone_number='+998900000013')
        self.assertEqual(auth_client(stranger).get('/api/businesses/shop/').status_code, 404)

    def test_only_owner_can_delete(self):
        admin, _ = self.add_member('admin', phone='+998900000014')
        self.assertEqual(auth_client(admin).delete('/api/businesses/shop/').status_code, 403)
        self.assertEqual(self.owner_client.delete('/api/businesses/shop/').status_code, 204)

    def test_admin_manages_members_editor_cannot(self):
        admin, _ = self.add_member('admin', phone='+998900000015')
        editor, _ = self.add_member('editor', phone='+998900000016')
        self.assertEqual(auth_client(admin).get('/api/businesses/shop/members/').status_code, 200)
        self.assertEqual(auth_client(editor).get('/api/businesses/shop/members/').status_code, 403)

    # --- dashboard list + role exposure ---
    def test_shared_business_in_member_dashboard(self):
        member, _ = self.add_member('viewer', phone='+998900000017')
        res = auth_client(member).get('/api/businesses/')
        self.assertEqual(res.status_code, 200)
        paths = {b['path']: b['role'] for b in res.data}
        self.assertEqual(paths.get('shop'), 'viewer')

    def test_shared_business_does_not_count_toward_member_limit(self):
        # Free member already owns their 1 page; a shared page must not block them.
        member, _ = self.add_member('viewer', phone='+998900000018')
        c = auth_client(member)
        # They still have their full free quota (1 owned page).
        res = c.post('/api/businesses/', {'path': 'mine', 'name': 'Mine'}, format='json')
        self.assertEqual(res.status_code, 201)

    def test_public_endpoint_hides_owner_identity(self):
        # owner_name must never leak on the anonymous public page payload.
        res = APIClient().get('/api/public/shop/')
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data['owner_name'])
        self.assertIsNone(res.data['role'])

    def test_change_role_and_remove(self):
        member, m = self.add_member('viewer', phone='+998900000019')
        res = self.owner_client.patch(f'/api/members/{m.id}/', {'role': 'admin'}, format='json')
        self.assertEqual(res.status_code, 200)
        m.refresh_from_db()
        self.assertEqual(m.role, 'admin')
        self.assertEqual(self.owner_client.delete(f'/api/members/{m.id}/').status_code, 204)
        self.assertFalse(BusinessMembership.objects.filter(id=m.id).exists())


@override_settings(CACHES=LOCMEM)
class PublicFeaturedTests(TestCase):
    """Landing 'Bizning mijozlar' carousel source."""

    def test_only_featured_and_active(self):
        owner = User.objects.create_user(phone_number='+998901119001')
        shown = make_business(owner, 'shown', 'Shown')
        Business.objects.filter(pk=shown.pk).update(is_featured=True)
        hidden_locked = make_business(owner, 'hidlock', 'HidLock')
        Business.objects.filter(pk=hidden_locked.pk).update(is_featured=True, is_locked=True)
        make_business(owner, 'plain', 'Plain')  # not featured

        res = APIClient().get('/api/public/featured/')
        self.assertEqual(res.status_code, 200)
        paths = [b['path'] for b in res.data]
        self.assertEqual(paths, ['shown'])
        self.assertEqual(set(res.data[0]), {'path', 'name', 'logo'})


@override_settings(CACHES=LOCMEM)
class ContactPhoneTests(TestCase):
    """Contact form: phone or email — at least one is required."""

    def _post(self, **data):
        return APIClient().post('/api/contact/', data, format='json')

    def test_phone_only_ok(self):
        res = self._post(name='Ali', phone='+998901234567', message='Salom')
        self.assertEqual(res.status_code, 201)

    def test_email_only_ok(self):
        res = self._post(name='Ali', contact='a@b.com', message='Salom')
        self.assertEqual(res.status_code, 201)

    def test_neither_rejected(self):
        res = self._post(name='Ali', message='Salom')
        self.assertEqual(res.status_code, 400)


@override_settings(CACHES=LOCMEM)
class BioLimitTests(TestCase):
    """The page bio (description) is capped at MAX_BIO_CHARS characters."""

    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901112233')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def test_at_limit_accepted(self):
        bio = 'a' * MAX_BIO_CHARS
        res = self.client.post('/api/businesses/', {'path': 'a', 'name': 'A', 'description': bio},
                               format='json')
        self.assertEqual(res.status_code, 201)
        self.assertEqual(Business.objects.get(path='a').description, bio)

    def test_over_limit_rejected(self):
        bio = 'a' * (MAX_BIO_CHARS + 1)
        res = self.client.post('/api/businesses/', {'path': 'a', 'name': 'A', 'description': bio},
                               format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'][0], 'bio_too_long')
        self.assertFalse(Business.objects.filter(path='a').exists())

    def test_update_over_limit_rejected(self):
        make_business(self.user, 'a', 'A')
        res = self.client.patch('/api/businesses/a/',
                                {'description': 'a' * (MAX_BIO_CHARS + 1)},
                                format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(Business.objects.get(path='a').description, '')

    def test_surrounding_whitespace_not_counted(self):
        # Chekka bo'shliqlar limitga kirmaydi — editor ham trim qilib sanaydi.
        bio = '  ' + 'a' * MAX_BIO_CHARS + '  \n'
        res = self.client.post('/api/businesses/', {'path': 'a', 'name': 'A', 'description': bio},
                               format='json')
        self.assertEqual(res.status_code, 201)


@override_settings(CACHES=LOCMEM)
class BlogOrderTests(TestCase):
    def test_list_respects_admin_order(self):
        from businesses.models import BlogPost
        BlogPost.objects.create(slug='newest', title='Newest', body='x', order=5)
        BlogPost.objects.create(slug='first', title='First', body='x', order=1)
        res = APIClient().get('/api/blog/?lang=uz')
        self.assertEqual(res.status_code, 200)
        self.assertEqual([p['slug'] for p in res.data], ['first', 'newest'])
