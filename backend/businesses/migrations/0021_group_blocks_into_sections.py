"""Group pre-existing content blocks into a default "Media" section per
business, so the sections UI shows legacy media instead of hiding it."""
from django.db import migrations


def forwards(apps, schema_editor):
    Business = apps.get_model('businesses', 'Business')
    MediaSection = apps.get_model('businesses', 'MediaSection')
    ContentBlock = apps.get_model('businesses', 'ContentBlock')

    business_ids = (
        ContentBlock.objects.filter(section__isnull=True)
        .values_list('business_id', flat=True)
        .distinct()
    )
    for business_id in business_ids:
        section = MediaSection.objects.create(
            business_id=business_id, name='Media', order=0,
        )
        ContentBlock.objects.filter(
            business_id=business_id, section__isnull=True,
        ).update(section=section)


def backwards(apps, schema_editor):
    MediaSection = apps.get_model('businesses', 'MediaSection')
    ContentBlock = apps.get_model('businesses', 'ContentBlock')
    ContentBlock.objects.update(section=None)
    MediaSection.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('businesses', '0020_mediasection_contentblock_section'),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
