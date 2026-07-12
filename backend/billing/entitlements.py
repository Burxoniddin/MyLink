"""Single source of truth for tiers and their feature flags.

The effective tier is resolved in ``services.effective_tier``; this module only
describes what each tier is allowed to do. "partial/limited" values from the
pricing table are made concrete here (see roadmap plan §2).
"""

# Tiers
FREE = 'free'
ODDIY = 'oddiy'
PRO = 'pro'

TIER_CHOICES = [
    (FREE, 'Free'),
    (ODDIY, 'Oddiy'),
    (PRO, 'Pro'),
]

# Billing periods
ONETIME = 'onetime'
P1M = '1m'
P6M = '6m'
P1Y = '1y'

PERIOD_CHOICES = [
    (ONETIME, 'Bir martalik'),
    (P1M, '1 oy'),
    (P6M, '6 oy'),
    (P1Y, '1 yil'),
]

# How many days a paid period grants (one-time has no expiry → not listed).
PERIOD_DAYS = {
    P1M: 30,
    P6M: 180,
    P1Y: 365,
}

# Feature matrix. analytics/qr use string levels: 'none' | 'partial' | 'full'
# (qr: 'none' | 'png' | 'full'). banners = max number of media SECTIONS per
# business (each section holds up to businesses.models.MAX_BLOCKS_PER_SECTION
# blocks).
FEATURES = {
    FREE: {
        'profile_limit': 1,
        'templates': 1,
        'color_edit': False,
        'banners': 0,
        'banner_video': False,
        'analytics': 'none',
        'qr': 'none',
        'branding_removed': False,
        'verified_badge': False,
        'team': False,
    },
    ODDIY: {
        'profile_limit': 5,
        'templates': 3,
        'color_edit': True,
        'banners': 3,
        'banner_video': False,
        'analytics': 'partial',
        'qr': 'png',
        'branding_removed': True,
        'verified_badge': False,
        'team': False,
    },
    PRO: {
        'profile_limit': 20,
        'templates': 6,
        'color_edit': True,
        'banners': 10,
        'banner_video': True,
        'analytics': 'full',
        'qr': 'full',
        'branding_removed': True,
        'verified_badge': True,
        'team': True,
    },
}


# Fallback ranks (used only before the Plan rows exist, e.g. a fresh DB).
_RANK_FALLBACK = {FREE: 0, ODDIY: 10, PRO: 20}


def _plans_by_slug():
    """{slug: Plan} for active plans, or {} if the table is empty/unavailable."""
    try:
        from .models import Plan
        return {p.slug: p for p in Plan.objects.filter(is_active=True)}
    except Exception:
        # Table not migrated yet (e.g. during initial migrate). Use fallback.
        return {}


def features_for(tier):
    """Feature dict for a tier slug. Reads the admin-editable Plan row if present,
    otherwise falls back to the hardcoded matrix above."""
    plan = _plans_by_slug().get(tier)
    if plan is not None:
        return plan.features_dict()
    return dict(FEATURES.get(tier, FEATURES[FREE]))


def plan_rank(tier):
    plan = _plans_by_slug().get(tier)
    if plan is not None:
        return plan.rank
    return _RANK_FALLBACK.get(tier, 0)


def default_tier():
    """The tier for users with no active subscription (admin-flagged is_default)."""
    try:
        from .models import Plan
        p = Plan.objects.filter(is_default=True, is_active=True).first()
        if p:
            return p.slug
    except Exception:
        pass
    return FREE


def public_plans():
    """Active, public plans ordered for the pricing page (empty list if none)."""
    try:
        from .models import Plan
        return list(Plan.objects.filter(is_active=True, is_public=True))
    except Exception:
        return []
