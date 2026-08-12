"""Grid becomes the default card style — restaurant menus lead with photos.

Existing rows are flipped too: the feature has not shipped to customers yet
(dev/staging only), so every 'list' row is test data created under the old
default rather than a deliberate choice.
"""
from django.db import migrations, models


def to_grid(apps, schema_editor):
    apps.get_model('catalog', 'Catalog').objects.filter(card_style='list').update(card_style='grid')


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalog', '0002_catalog_card_style_catalog_theme_catalog_theme_mode'),
    ]

    operations = [
        migrations.AlterField(
            model_name='catalog',
            name='card_style',
            field=models.CharField(choices=[('list', 'Ro‘yxat'), ('grid', 'Grid')],
                                   default='grid', max_length=5, verbose_name='Karta stili'),
        ),
        migrations.RunPython(to_grid, noop),
    ]
