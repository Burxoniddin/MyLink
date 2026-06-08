from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from . import entitlements as ent
from .models import PromoCode, PromoRedemption, Subscription


def effective_plan(user):
    """Resolve a user's current tier and its expiry from active subscriptions.

    PRO (if any active/non-expired) > ODDIY (permanent) > FREE. Returns
    ``(tier, expires_at)`` where ``expires_at`` is ``None`` for FREE or a
    permanent/lifetime grant, otherwise the latest expiry among the active subs
    of the effective tier. Expired-but-still-'active'-status rows are treated as
    inactive lazily.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return ent.FREE, None

    now = timezone.now()
    # tier -> expiry: None means a permanent grant exists for that tier.
    expiries = {ent.PRO: [], ent.ODDIY: []}
    permanent = {ent.PRO: False, ent.ODDIY: False}

    for s in Subscription.objects.filter(user=user, status='active'):
        if s.tier not in expiries:
            continue
        if s.expires_at is None:
            permanent[s.tier] = True
        elif s.expires_at > now:
            expiries[s.tier].append(s.expires_at)

    for tier in (ent.PRO, ent.ODDIY):
        if permanent[tier]:
            return tier, None
        if expiries[tier]:
            return tier, max(expiries[tier])
    return ent.FREE, None


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


def grant_subscription(user, tier, duration_days=None, source='manual', note=''):
    """Create an active subscription for ``user``. ``duration_days=None`` grants a
    permanent (lifetime) subscription."""
    expires_at = None if duration_days is None else timezone.now() + timedelta(days=duration_days)
    return Subscription.objects.create(
        user=user, tier=tier, expires_at=expires_at,
        status='active', source=source, note=note,
    )


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
