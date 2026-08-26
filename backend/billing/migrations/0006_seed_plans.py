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
    # ent.FEATURES is live code and grows over time; the historical Plan model
    # here only has the columns that existed at this migration. Keep only those
    # so fresh installs don't crash on later-added feature keys (they get their
    # values from the later AddField defaults + backfill migrations).
    columns = {f.name for f in Plan._meta.get_fields()}
    for slug, feats in ent.FEATURES.items():
        meta = META.get(slug, {'name': slug.title(), 'rank': 0, 'order': 0,
                               'is_default': False, 'is_public': True})
        feats = {k: v for k, v in feats.items() if k in columns}
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
