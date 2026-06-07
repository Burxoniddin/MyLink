from django.utils import timezone

from . import entitlements as ent
from .models import Subscription


def effective_tier(user):
    """Resolve a user's current tier from their active subscriptions.

    PRO (if any active/non-expired) > ODDIY (permanent) > FREE.
    Expired-but-still-'active'-status rows are treated as inactive lazily.
    """
    if not user or not getattr(user, 'is_authenticated', False):
        return ent.FREE

    now = timezone.now()
    has_oddiy = False
    has_pro = False

    for s in Subscription.objects.filter(user=user, status='active'):
        if s.expires_at is not None and s.expires_at <= now:
            continue
        if s.tier == ent.PRO:
            has_pro = True
        elif s.tier == ent.ODDIY:
            has_oddiy = True

    if has_pro:
        return ent.PRO
    if has_oddiy:
        return ent.ODDIY
    return ent.FREE


def get_entitlements(user):
    """Full entitlement payload for /api/me/ and gating helpers."""
    tier = effective_tier(user)
    features = ent.features_for(tier)

    owned = 0
    if user and getattr(user, 'is_authenticated', False):
        from businesses.models import Business
        owned = Business.objects.filter(owner=user).count()

    return {
        'tier': tier,
        'features': features,
        'usage': {
            'businesses': owned,
            'profile_limit': features['profile_limit'],
        },
    }


def can_create_business(user):
    e = get_entitlements(user)
    return e['usage']['businesses'] < e['features']['profile_limit']
