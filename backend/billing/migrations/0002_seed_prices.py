from django.db import migrations

PRICES = [
    ('oddiy', 'onetime', 19000),
    ('pro', '1m', 39000),
    ('pro', '6m', 179000),
    ('pro', '1y', 299000),
]


def seed(apps, schema_editor):
    PlanPrice = apps.get_model('billing', 'PlanPrice')
    for tier, period, price in PRICES:
        PlanPrice.objects.get_or_create(tier=tier, period=period, defaults={'price': price})


def unseed(apps, schema_editor):
    PlanPrice = apps.get_model('billing', 'PlanPrice')
    PlanPrice.objects.filter(tier__in=['oddiy', 'pro']).delete()


class Migration(migrations.Migration):
    dependencies = [('billing', '0001_initial')]
    operations = [migrations.RunPython(seed, unseed)]
