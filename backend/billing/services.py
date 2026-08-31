from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from . import entitlements as ent
from .models import PromoCode, PromoRedemption, Subscription


def effective_plan(user):
    """Resolve a user's current tier and its expiry from active subscriptions.

    Fully dynamic: the highest-``rank`` tier among the user's active (non-expired)
    subscriptions wins; ties keep the latest expiry. Falls back to the default
    tier (admin ``is_default``, else FREE) when there's no active subscription.
    Returns ``(tier_slug, expires_at)`` where ``expires_at`` is ``None`` for a
    permanent/lifetime grant or the default tier.
    """
    default = ent.default_tier()
    if not user or not getattr(user, 'is_authenticated', False):
        return default, None

    now = timezone.now()
    plans = ent._plans_by_slug()

    # Aggregate per tier: permanent flag + latest future expiry.
    agg = {}  # slug -> [permanent: bool, max_expiry]
    for s in Subscription.objects.filter(user=user, status='active'):
        # Only honour subs whose tier maps to a known active plan (skip if the
        # plan was deleted/deactivated). Fall back to rank table if plans empty.
        if plans and s.tier not in plans:
            continue
        perm, mx = agg.get(s.tier, (False, None))
        if s.expires_at is None:
            perm = True
        elif s.expires_at > now:
            mx = s.expires_at if (mx is None or s.expires_at > mx) else mx
        else:
            continue  # expired
        agg[s.tier] = (perm, mx)

    best_tier, best_rank, best_expiry = None, -1, None
    for slug, (perm, mx) in agg.items():
        if not perm and mx is None:
            continue
        rank = plans[slug].rank if slug in plans else ent.plan_rank(slug)
        if rank > best_rank:
            best_tier, best_rank, best_expiry = slug, rank, (None if perm else mx)

    if best_tier is not None:
        return best_tier, best_expiry
    return default, None


def effective_tier(user):
    """Convenience wrapper returning only the tier (see ``effective_plan``)."""
    return effective_plan(user)[0]


def get_entitlements(user):
    """Full entitlement payload for /api/me/ and gating helpers."""
    tier, expires_at = effective_plan(user)
    features = ent.features_for(tier)

    owned = 0
    active = 0
    if user and getattr(user, 'is_authenticated', False):
        from businesses.models import Business
        owned = Business.objects.filter(owner=user).count()
        active = Business.objects.filter(owner=user, is_locked=False).count()

    return {
        'tier': tier,
        'expires_at': expires_at.isoformat() if expires_at else None,
        'features': features,
        'usage': {
            'businesses': owned,    # total owned (incl. locked)
            'active': active,       # unlocked / publicly visible
            'profile_limit': features['profile_limit'],
        },
    }


def can_create_business(user):
    """A new business is created unlocked, so the limit caps *active* businesses."""
    e = get_entitlements(user)
    return e['usage']['active'] < e['features']['profile_limit']


def sync_locks(user):
    """Enforce ``profile_limit`` by locking excess businesses.

    Only ever *locks* (never auto-unlocks), so it doesn't override the owner's
    manual choice while they're within limit. When the count of unlocked
    businesses exceeds the limit (e.g. right after a downgrade), the oldest
    ``limit`` stay active and the rest are locked. Returns the number locked."""
    if not user or not getattr(user, 'is_authenticated', False):
        return 0
    from businesses.models import Business
    limit = ent.features_for(effective_tier(user))['profile_limit']
    unlocked = list(Business.objects.filter(owner=user, is_locked=False).order_by('created_at'))
    excess = unlocked[limit:]
    for b in excess:
        b.is_locked = True
        b.save(update_fields=['is_locked'])
    return len(excess)


REFERRAL_REWARD_DAYS = 30   # +1 month Pro per converted friend
REFERRAL_YEARLY_CAP = 12    # at most 12 reward-months per referrer per rolling year


def grant_pro_extension(user, days=REFERRAL_REWARD_DAYS, source='referral', note=''):
    """Extend a user's Pro by ``days``, stacking on top of their current expiry so
    the reward genuinely adds time. Returns the created Subscription, or ``None`` if
    the user already has lifetime (permanent) Pro."""
    tier, expires = effective_plan(user)
    if tier == ent.PRO and expires is None:
        return None  # already lifetime Pro — nothing to extend
    base = expires if (tier == ent.PRO and expires and expires > timezone.now()) else timezone.now()
    return Subscription.objects.create(
        user=user, tier=ent.PRO, expires_at=base + timedelta(days=days),
        status='active', source=source, note=note,
    )


def maybe_reward_referrer(referred_user):
    """When ``referred_user`` first converts to Pro, reward their referrer with +1
    month Pro (subject to the yearly cap). Idempotent per referred friend."""
    referrer = getattr(referred_user, 'referred_by', None)
    if not referrer:
        return None
    from .models import ReferralReward
    if ReferralReward.objects.filter(referred=referred_user).exists():
        return None  # this friend already triggered a reward
    year_ago = timezone.now() - timedelta(days=365)
    granted = ReferralReward.objects.filter(
        referrer=referrer, subscription__isnull=False, created_at__gte=year_ago,
    ).count()
    if granted >= REFERRAL_YEARLY_CAP:
        # Cap hit: record the conversion but grant nothing (friend won't retry).
        ReferralReward.objects.create(referrer=referrer, referred=referred_user, subscription=None)
        return None
    sub = grant_pro_extension(referrer, source='referral', note=f'Referral: {referred_user}')
    ReferralReward.objects.create(referrer=referrer, referred=referred_user, subscription=sub)
    return sub


def grant_subscription(user, tier, duration_days=None, source='manual', note='', extend=False):
    """Create an active subscription for ``user``. ``duration_days=None`` grants a
    permanent (lifetime) subscription. ``extend=True`` (to'lovlar uchun): xuddi shu
    tarifning tugamagan muddatli obunasi bo'lsa, yangi muddat uning tugash sanasi
    ustiga qo'shiladi — qolgan kunlar yonmaydi. A first-time Pro grant (not itself
    a referral reward) rewards the user's referrer."""
    if duration_days is None:
        expires_at = None
    else:
        base = timezone.now()
        if extend:
            cur = (Subscription.objects
                   .filter(user=user, tier=tier, status='active',
                           expires_at__isnull=False, expires_at__gt=base)
                   .order_by('-expires_at').first())
            if cur:
                base = cur.expires_at
        expires_at = base + timedelta(days=duration_days)
    sub = Subscription.objects.create(
        user=user, tier=tier, expires_at=expires_at,
        status='active', source=source, note=note,
    )
    if tier == ent.PRO and source != 'referral':
        maybe_reward_referrer(user)
    return sub


class PromoError(Exception):
    """Redeem failure carrying a short machine-readable ``reason`` key
    (not_found | inactive | expired | exhausted | already_used)."""
    def __init__(self, reason):
        self.reason = reason
        super().__init__(reason)


def redeem_promo(user, raw_code):
    """Validate and redeem ``raw_code`` for ``user``. Returns the created
    Subscription on success; raises ``PromoError`` otherwise. Atomic + locked so
    concurrent redeems can't exceed ``max_redemptions``."""
    code_str = (raw_code or '').strip().upper()
    if not code_str:
        raise PromoError('not_found')

    with transaction.atomic():
        try:
            promo = PromoCode.objects.select_for_update().get(code=code_str)
        except PromoCode.DoesNotExist:
            raise PromoError('not_found')

        ok, reason = promo.is_redeemable()
        if not ok:
            raise PromoError(reason)

        if promo.once_per_user and PromoRedemption.objects.filter(code=promo, user=user).exists():
            raise PromoError('already_used')

        sub = grant_subscription(
            user, promo.grant_tier, duration_days=promo.duration_days,
            source='promo', note=f"Promo: {promo.code}",
        )
        PromoRedemption.objects.create(code=promo, user=user, subscription=sub)
        promo.redeemed_count = promo.redeemed_count + 1
        promo.save(update_fields=['redeemed_count'])

    return sub
