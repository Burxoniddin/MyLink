from django.conf import settings
from django.db import models

# Hard caps (not tier-dependent; the tier gate is the billing `catalog` flag).
MAX_CATEGORIES_PER_CATALOG = 20
MAX_ITEMS_PER_CATEGORY = 50
MAX_IMAGES_PER_ITEM = 5


class Catalog(models.Model):
    """A standalone web-menu/catalog (Pro feature), managed from the
    "Kataloglarim" section. Owned by the user who created it and optionally
    attached to ONE of their businesses — only while attached (and active, and
    the owner's tier has the ``catalog`` feature) does it get a public page at
    ``/<business-path>/menu``."""

    # Visual presets for the public menu. Each id maps to a palette + font pair
    # in frontend/src/lib/catalogThemes.js — keep the two lists in sync.
    THEME_CHOICES = [
        ('mylink', 'MyLink (indigo)'),
        ('tandir', 'Tandir (issiq)'),
        ('anor', 'Anor (qizil)'),
        ('rayhon', "Rayhon (yashil)"),
        ('oltin', 'Oltin tun'),
        ('chinni', 'Chinni (ko‘k)'),
        ('qaymoq', 'Qaymoq (neytral)'),
        ('tut', 'Tut (siyoh)'),
    ]
    MODE_CHOICES = [('dark', 'Tungi'), ('light', 'Kunduzgi')]
    CARD_CHOICES = [('list', "Ro‘yxat"), ('grid', 'Grid')]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                              related_name='catalogs')
    name = models.CharField(max_length=100, help_text="Ro'yxatda ko'rinadigan nom")
    business = models.OneToOneField('businesses.Business', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='catalog',
                                    help_text="Qaysi biznes sahifasida ko'rsatiladi")
    button_label = models.CharField(max_length=30, blank=True, default='',
                                    help_text="Sahifadagi tugma matni, masalan 'Menyu'")
    banner = models.ImageField(upload_to='catalog/banners/', blank=True, null=True)
    currency = models.CharField(max_length=12, default="so'm")
    theme = models.CharField(max_length=12, choices=THEME_CHOICES, default='mylink',
                             verbose_name='Tema')
    theme_mode = models.CharField(max_length=5, choices=MODE_CHOICES, default='dark',
                                  verbose_name='Muhit')
    card_style = models.CharField(max_length=5, choices=CARD_CHOICES, default='grid',
                                  verbose_name='Karta stili')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Katalog'
        verbose_name_plural = 'Kataloglar'

    def __str__(self):
        return self.name


class CatalogCategory(models.Model):
    catalog = models.ForeignKey(Catalog, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=60)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']
        verbose_name = 'Kategoriya'
        verbose_name_plural = 'Kategoriyalar'

    def __str__(self):
        return f'{self.catalog} · {self.name}'


class CatalogItem(models.Model):
    category = models.ForeignKey(CatalogCategory, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    price = models.PositiveIntegerField(help_text="Narx (UZS so'm)")
    old_price = models.PositiveIntegerField(null=True, blank=True,
                                            help_text="Chegirmadan oldingi narx (ustidan chizib ko'rsatiladi)")
    is_available = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        verbose_name = 'Mahsulot'
        verbose_name_plural = 'Mahsulotlar'

    def __str__(self):
        return self.name


class CatalogItemImage(models.Model):
    item = models.ForeignKey(CatalogItem, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='catalog/items/')          # processed full-size (lightbox)
    thumb = models.ImageField(upload_to='catalog/items/thumbs/',   # card thumbnail
                              blank=True, null=True)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'{self.item} · rasm {self.pk}'
