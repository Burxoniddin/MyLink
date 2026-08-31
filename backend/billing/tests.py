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

    def test_catalog_feature_pro_only(self):
        self.assertFalse(get_entitlements(self.user)['features']['catalog'])
        Subscription.objects.create(user=self.user, tier=ent.ODDIY, expires_at=None)
        self.assertFalse(get_entitlements(self.user)['features']['catalog'])
        Subscription.objects.create(user=self.user, tier=ent.PRO, expires_at=None)
        self.assertTrue(get_entitlements(self.user)['features']['catalog'])


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


CLICK_CFG = dict(CLICK_SERVICE_ID='12345', CLICK_MERCHANT_ID='777', CLICK_SECRET_KEY='testsecret')


from django.test import override_settings  # noqa: E402
from rest_framework.test import APIClient  # noqa: E402
from rest_framework.authtoken.models import Token  # noqa: E402


@override_settings(**CLICK_CFG)
class ClickPaymentTests(TestCase):
    """1a — Click SHOP API: checkout create + prepare/complete callback."""

    def setUp(self):
        from billing import click
        self.click = click
        self.user = User.objects.create_user(phone_number='+998907770001')
        self.client_api = APIClient()
        token = Token.objects.create(user=self.user)
        self.client_api.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def _order(self, tier=ent.PRO, period=ent.P1M):
        res = self.client_api.post('/api/payments/click/create/',
                                   {'tier': tier, 'period': period, 'return_url': 'https://x/r'},
                                   format='json')
        self.assertEqual(res.status_code, 200, res.data)
        return res.data

    def _cb(self, order_id, action, amount, click_trans_id='9001', prepare_id='', error='0'):
        data = {
            'click_trans_id': click_trans_id, 'service_id': '12345',
            'click_paydoc_id': '55', 'merchant_trans_id': str(order_id),
            'amount': amount, 'action': action, 'error': error,
            'error_note': '', 'sign_time': '2026-08-04 12:00:00',
        }
        if action == '1':
            data['merchant_prepare_id'] = prepare_id
        data['sign_string'] = self.click.make_sign(
            data['click_trans_id'], data['service_id'], data['merchant_trans_id'],
            data['amount'], action, data['sign_time'],
            data.get('merchant_prepare_id', ''),
        )
        return self.client_api.post('/api/payments/click/callback/', data)

    def test_create_returns_pay_url(self):
        d = self._order()
        self.assertIn('my.click.uz/services/pay', d['pay_url'])
        self.assertIn('service_id=12345', d['pay_url'])
        self.assertIn(f"transaction_param={d['order_id']}", d['pay_url'])

    def test_create_unknown_price_rejected(self):
        res = self.client_api.post('/api/payments/click/create/',
                                   {'tier': 'pro', 'period': 'nope'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_prepare_ok_then_complete_grants_subscription(self):
        d = self._order(ent.PRO, ent.P1M)  # 39000
        r = self._cb(d['order_id'], '0', '39000.00')
        self.assertEqual(r.data['error'], 0, r.data)
        self.assertEqual(r.data['merchant_prepare_id'], d['order_id'])

        r2 = self._cb(d['order_id'], '1', '39000.00', prepare_id=str(d['order_id']))
        self.assertEqual(r2.data['error'], 0, r2.data)
        self.assertEqual(effective_tier(self.user), ent.PRO)
        _, expires = effective_plan(self.user)
        self.assertIsNotNone(expires)  # 1m → expiring, not lifetime

    def test_second_purchase_extends_expiry(self):
        """Amaldagi obuna tugamay yana sotib olinsa, muddat USTIGA qo'shiladi —
        qolgan kunlar yonmaydi (ikki marta 1 oy ≈ 60 kun)."""
        from datetime import timedelta
        from django.utils import timezone
        for _ in range(2):
            d = self._order(ent.PRO, ent.P1M)
            self._cb(d['order_id'], '0', '39000')
            r = self._cb(d['order_id'], '1', '39000', prepare_id=str(d['order_id']))
            self.assertEqual(r.data['error'], 0, r.data)
        _, expires = effective_plan(self.user)
        days = (expires - timezone.now()).days
        self.assertGreaterEqual(days, 58)
        self.assertLessEqual(days, 60)

    def test_onetime_grants_lifetime(self):
        d = self._order(ent.ODDIY, ent.ONETIME)  # 19000
        self._cb(d['order_id'], '0', '19000')
        r = self._cb(d['order_id'], '1', '19000', prepare_id=str(d['order_id']))
        self.assertEqual(r.data['error'], 0)
        tier, expires = effective_plan(self.user)
        self.assertEqual(tier, ent.ODDIY)
        self.assertIsNone(expires)  # lifetime

    def test_bad_sign_rejected(self):
        d = self._order()
        data = {
            'click_trans_id': '1', 'service_id': '12345', 'merchant_trans_id': str(d['order_id']),
            'amount': '39000', 'action': '0', 'error': '0',
            'sign_time': 'now', 'sign_string': 'wrong',
        }
        r = self.client_api.post('/api/payments/click/callback/', data)
        self.assertEqual(r.data['error'], -1)

    def test_wrong_amount_rejected(self):
        d = self._order()
        r = self._cb(d['order_id'], '0', '100.00')
        self.assertEqual(r.data['error'], -2)

    def test_unknown_order(self):
        self._order()
        r = self._cb(999999, '0', '39000')
        self.assertEqual(r.data['error'], -5)

    def test_double_complete_single_subscription(self):
        d = self._order()
        self._cb(d['order_id'], '0', '39000')
        self._cb(d['order_id'], '1', '39000', prepare_id=str(d['order_id']))
        r = self._cb(d['order_id'], '1', '39000', prepare_id=str(d['order_id']))
        self.assertEqual(r.data['error'], -4)  # already paid
        self.assertEqual(Subscription.objects.filter(user=self.user, source='payment').count(), 1)

    def test_click_side_error_cancels(self):
        from billing.models import PaymentOrder
        d = self._order()
        self._cb(d['order_id'], '0', '39000')
        r = self._cb(d['order_id'], '1', '39000', prepare_id=str(d['order_id']), error='-5017')
        self.assertEqual(r.data['error'], -9)
        self.assertEqual(PaymentOrder.objects.get(pk=d['order_id']).status, 'canceled')
        self.assertEqual(effective_tier(self.user), ent.FREE)

    def test_not_configured_returns_503(self):
        with override_settings(CLICK_SERVICE_ID=''):
            res = self.client_api.post('/api/payments/click/create/',
                                       {'tier': 'pro', 'period': '1m'}, format='json')
            self.assertEqual(res.status_code, 503)
