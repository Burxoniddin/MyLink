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
# (qr: 'none' | 'png' | 'full'). banners = max number of content blocks.
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


def features_for(tier):
    return FEATURES.get(tier, FEATURES[FREE])
