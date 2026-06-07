from django.db import migrations

PAGES = [
    ('about', 'uz', 'Biz haqimizda',
     '<p>MyLink.asia — kichik biznes uchun link-in-bio platforma. Ushbu matnni admin paneldan tahrirlang.</p>'),
    ('privacy', 'uz', 'Maxfiylik siyosati',
     '<p>Maxfiylik siyosati matni. Admin paneldan tahrirlang.</p>'),
    ('terms', 'uz', 'Foydalanish shartlari',
     '<p>Foydalanish shartlari matni. Admin paneldan tahrirlang.</p>'),
]


def seed(apps, schema_editor):
    StaticPage = apps.get_model('businesses', 'StaticPage')
    for slug, lang, title, body in PAGES:
        StaticPage.objects.get_or_create(slug=slug, language=lang, defaults={'title': title, 'body': body})


def unseed(apps, schema_editor):
    StaticPage = apps.get_model('businesses', 'StaticPage')
    StaticPage.objects.filter(slug__in=['about', 'privacy', 'terms'], language='uz').delete()


class Migration(migrations.Migration):
    dependencies = [('businesses', '0006_contactmessage_sitesettings_contact_phone_and_more')]
    operations = [migrations.RunPython(seed, unseed)]
