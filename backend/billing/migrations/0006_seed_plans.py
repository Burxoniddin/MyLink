"""Seed the three built-in plans (free/oddiy/pro) from the hardcoded feature
matrix so the now-dynamic Plan table mirrors the previous behaviour. Admins can
edit these or add new tiers afterwards."""
from django.db import migrations

from billing import entitlements as ent

META = {
    ent.FREE:  {'name': 'Free',  'rank': 0,  'order': 0, 'is_default': True,  'is_public': True},
    ent.ODDIY: {'name': 'Oddiy', 'rank': 10, 'order': 1, 'is_default': False, 'is_public': True},
    ent.PRO:   {'name': 'Pro',   'rank': 20, 'order': 2, 'is_default': False, 'is_public': True},
}


def seed(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')
    for slug, feats in ent.FEATURES.items():
        meta = META.get(slug, {'name': slug.title(), 'rank': 0, 'order': 0,
                               'is_default': False, 'is_public': True})
        Plan.objects.update_or_create(
            slug=slug,
            defaults={**meta, 'is_active': True, **feats},
        )


def unseed(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')
    Plan.objects.filter(slug__in=list(ent.FEATURES)).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0005_plan_alter_planprice_tier_alter_promocode_grant_tier_and_more'),
    ]
    operations = [migrations.RunPython(seed, unseed)]
