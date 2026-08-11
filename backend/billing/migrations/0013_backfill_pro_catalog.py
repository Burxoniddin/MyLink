"""Existing deployments already have Plan rows, so the entitlements.FEATURES
fallback never applies there — flip the new ``catalog`` flag on for the seeded
Pro plan. Admin-created custom tiers stay off until toggled in the admin."""
from django.db import migrations

from billing import entitlements as ent


def enable(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')
    Plan.objects.filter(slug=ent.PRO).update(catalog=True)


def disable(apps, schema_editor):
    Plan = apps.get_model('billing', 'Plan')
    Plan.objects.filter(slug=ent.PRO).update(catalog=False)


class Migration(migrations.Migration):
    dependencies = [
        ('billing', '0012_plan_catalog'),
    ]
    operations = [migrations.RunPython(enable, disable)]
