"""Seed default prices for the built-in plans so the (now dynamic) pricing page
shows real amounts out of the box. Admins can edit these in PlanPrice."""
from django.db import migrations

from billing import entitlements as ent

PRICES = [
    (ent.ODDIY, ent.ONETIME, 19000),
    (ent.PRO,   ent.P1M,     39000),
    (ent.PRO,   ent.P6M,     179000),
    (ent.PRO,   ent.P1Y,     299000),
]


def seed(apps, schema_editor):
    PlanPrice = apps.get_model('billing', 'PlanPrice')
    for tier, period, price in PRICES:
        PlanPrice.objects.update_or_create(
            tier=tier, period=period, defaults={'price': price, 'is_active': True},
        )


def unseed(apps, schema_editor):
    PlanPrice = apps.get_model('billing', 'PlanPrice')
    for tier, period, _ in PRICES:
        PlanPrice.objects.filter(tier=tier, period=period).delete()


class Migration(migrations.Migration):
    dependencies = [('billing', '0006_seed_plans')]
    operations = [migrations.RunPython(seed, unseed)]
