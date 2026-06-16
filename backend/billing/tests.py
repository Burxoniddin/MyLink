from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from billing import entitlements as ent
from billing.models import PromoCode, PromoRedemption, ReferralReward, Subscription
from billing.services import (
    PromoError, REFERRAL_YEARLY_CAP, effective_plan, effective_tier,
    get_entitlements, grant_pro_extension, grant_subscription, redeem_promo,
)

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


class ReferralRewardTests(TestCase):
    def setUp(self):
        self.referrer = User.objects.create_user(phone_number='+998900000001')
        self.friend = User.objects.create_user(phone_number='+998900000002', referred_by=self.referrer)

    def test_friend_pro_conversion_rewards_referrer(self):
        self.assertEqual(effective_tier(self.referrer), ent.FREE)
        grant_subscription(self.friend, ent.PRO, duration_days=30, source='promo')
        self.assertEqual(effective_tier(self.referrer), ent.PRO)  # +1 month Pro
        self.assertEqual(ReferralReward.objects.filter(referrer=self.referrer).count(), 1)

    def test_no_double_reward_for_same_friend(self):
        grant_subscription(self.friend, ent.PRO, duration_days=30, source='promo')
        grant_subscription(self.friend, ent.PRO, duration_days=30, source='promo')
        self.assertEqual(ReferralReward.objects.filter(referrer=self.referrer).count(), 1)

    def test_no_reward_without_referrer(self):
        solo = User.objects.create_user(phone_number='+998900000003')
        grant_subscription(solo, ent.PRO, duration_days=30, source='promo')
        self.assertEqual(ReferralReward.objects.count(), 0)

    def test_referral_reward_does_not_chain(self):
        boss = User.objects.create_user(phone_number='+998900000004')
        self.referrer.referred_by = boss
        self.referrer.save(update_fields=['referred_by'])
        grant_subscription(self.friend, ent.PRO, duration_days=30, source='promo')
        # friend -> referrer rewarded; referrer's reward (source=referral) must NOT reward boss
        self.assertEqual(ReferralReward.objects.filter(referrer=self.referrer).count(), 1)
        self.assertEqual(ReferralReward.objects.filter(referrer=boss).count(), 0)

    def test_yearly_cap_blocks_grant(self):
        for i in range(REFERRAL_YEARLY_CAP):
            f = User.objects.create_user(phone_number=f'+9989001{i:05d}', referred_by=self.referrer)
            sub = Subscription.objects.create(user=self.referrer, tier=ent.PRO,
                                              expires_at=timezone.now() + timedelta(days=30), source='referral')
            ReferralReward.objects.create(referrer=self.referrer, referred=f, subscription=sub)
        grant_subscription(self.friend, ent.PRO, duration_days=30, source='promo')
        self.assertIsNone(ReferralReward.objects.get(referred=self.friend).subscription)

    def test_extension_stacks_on_existing_pro(self):
        Subscription.objects.create(user=self.referrer, tier=ent.PRO,
                                    expires_at=timezone.now() + timedelta(days=20), source='promo')
        grant_pro_extension(self.referrer, days=30, source='referral')
        # new expiry should be ~20 + 30 days out, not just 30 from now
        self.assertGreater(effective_plan(self.referrer)[1], timezone.now() + timedelta(days=45))

    def test_extension_skipped_for_lifetime(self):
        Subscription.objects.create(user=self.referrer, tier=ent.PRO, expires_at=None, source='gift')
        self.assertIsNone(grant_pro_extension(self.referrer, days=30))


class DynamicPlanTests(TestCase):
    """Item 6 — admin-defined tiers + editable feature matrix."""

    def setUp(self):
        from billing.models import Plan
        self.Plan = Plan
        self.user = User.objects.create_user(phone_number='+998905550001')

    def test_seeded_plans_exist(self):
        slugs = set(self.Plan.objects.values_list('slug', flat=True))
        self.assertTrue({ent.FREE, ent.ODDIY, ent.PRO} <= slugs)
        self.assertEqual(self.Plan.objects.get(is_default=True).slug, ent.FREE)

    def test_editing_feature_takes_effect(self):
        # Turn on team for the Oddiy plan from "admin" → entitlements reflect it.
        self.assertFalse(ent.features_for(ent.ODDIY)['team'])
        p = self.Plan.objects.get(slug=ent.ODDIY)
        p.team = True
        p.save()
        self.assertTrue(ent.features_for(ent.ODDIY)['team'])

    def test_new_tier_wins_by_rank(self):
        # A brand-new 'biznes' tier between Oddiy and Pro.
        self.Plan.objects.create(slug='biznes', name='Biznes', rank=15, profile_limit=9, team=True)
        Subscription.objects.create(user=self.user, tier='biznes', expires_at=None)
        self.assertEqual(effective_tier(self.user), 'biznes')
        feats = get_entitlements(self.user)['features']
        self.assertEqual(feats['profile_limit'], 9)
        self.assertTrue(feats['team'])

    def test_highest_rank_among_active_subs_wins(self):
        self.Plan.objects.create(slug='biznes', name='Biznes', rank=15, profile_limit=9)
        Subscription.objects.create(user=self.user, tier='biznes', expires_at=None)
        Subscription.objects.create(user=self.user, tier=ent.PRO, expires_at=None)  # rank 20
        self.assertEqual(effective_tier(self.user), ent.PRO)

    def test_single_default_enforced(self):
        # Marking Pro default unsets Free's default flag.
        pro = self.Plan.objects.get(slug=ent.PRO)
        pro.is_default = True
        pro.save()
        self.assertEqual(self.Plan.objects.filter(is_default=True).count(), 1)
        self.assertEqual(ent.default_tier(), ent.PRO)

    def test_inactive_plan_subscription_ignored(self):
        self.Plan.objects.create(slug='legacy', name='Legacy', rank=99, is_active=False)
        Subscription.objects.create(user=self.user, tier='legacy', expires_at=None)
        # Inactive plan → ignored, user stays on default (free).
        self.assertEqual(effective_tier(self.user), ent.FREE)

    def test_public_plans_endpoint(self):
        from rest_framework.test import APIClient
        res = APIClient().get('/api/plans/')
        self.assertEqual(res.status_code, 200)
        slugs = {p['slug'] for p in res.data}
        self.assertEqual(slugs, {ent.FREE, ent.ODDIY, ent.PRO})
        pro = next(p for p in res.data if p['slug'] == ent.PRO)
        self.assertTrue(pro['features']['team'])
