"""Backfill PlanPrice.plan from the existing ``tier`` slug so prices show up
inside the Plan admin inline."""
from django.db import migrations


def link(apps, schema_editor):
    PlanPrice = apps.get_model('billing', 'PlanPrice')
    Plan = apps.get_model('billing', 'Plan')
    by_slug = {p.slug: p for p in Plan.objects.all()}
    for pp in PlanPrice.objects.filter(plan__isnull=True):
        plan = by_slug.get(pp.tier)
        if plan:
            pp.plan = plan
            pp.save(update_fields=['plan'])


def unlink(apps, schema_editor):
    PlanPrice = apps.get_model('billing', 'PlanPrice')
    PlanPrice.objects.update(plan=None)


class Migration(migrations.Migration):
    dependencies = [('billing', '0008_planprice_plan_alter_planprice_tier')]
    operations = [migrations.RunPython(link, unlink)]
