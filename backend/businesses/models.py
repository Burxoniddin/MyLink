from django.db import models
from django.conf import settings
from django.utils import timezone

class Business(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='businesses')
    path = models.SlugField(unique=True, max_length=50, help_text="Unique path for the business page, e.g. 'mybrand'")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    # Locked when the owner is over their tier's profile_limit (e.g. after a
    # downgrade). Locked pages are hidden publicly; the owner picks which to keep
    # active. See billing.services.sync_locks / businesses toggle endpoint.
    is_locked = models.BooleanField(default=False)
    # Owner-pinned ("starred") pages float to the top of the dashboard list.
    # Toggled via the businesses pin endpoint; affects dashboard ordering only.
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.path})"

class Link(models.Model):
    ICON_CHOICES = [
        ('telegram', 'Telegram'),
        ('instagram', 'Instagram'),
        ('facebook', 'Facebook'),
        ('tiktok', 'TikTok'),
        ('x', 'X (Twitter)'),
        ('whatsapp', 'WhatsApp'),
        ('telegram_number', 'Telegram Number'),
        ('phone', 'Phone Number'),
        ('linkedin', 'LinkedIn'),
        ('youtube', 'YouTube'),
        ('gmail', 'Gmail'),
        ('yandex_map', 'Yandex Map'),
        ('google_map', 'Google Map'),
        ('website', 'Website'),
        ('other', 'Other'),
    ]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='links')
    title = models.CharField(max_length=100)
    url = models.CharField(max_length=500)  # Changed from URLField to allow tel: and mailto: links
    icon_type = models.CharField(max_length=20, choices=ICON_CHOICES, default='website')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.title} - {self.business.name}"


class MenuItem(models.Model):
    """Dynamic menu items for navbar, sidebar, footer"""
    LOCATION_CHOICES = [
        ('navbar', 'Navbar'),
        ('sidebar', 'Sidebar'),
        ('footer', 'Footer'),
    ]
    
    location = models.CharField(max_length=20, choices=LOCATION_CHOICES, default='navbar')
    title = models.CharField(max_length=100, verbose_name="Menu nomi")
    path = models.CharField(max_length=200, verbose_name="URL path")
    icon = models.CharField(max_length=50, blank=True, help_text="Font Awesome icon class, masalan: fa-home")
    order = models.PositiveIntegerField(default=0, verbose_name="Tartib")
    is_active = models.BooleanField(default=True, verbose_name="Faol")
    is_external = models.BooleanField(default=False, verbose_name="Tashqi havola")
    
    class Meta:
        ordering = ['location', 'order']
        verbose_name = "Menu element"
        verbose_name_plural = "Menu elementlari"
    
    def __str__(self):
        return f"{self.title} ({self.get_location_display()})"


class SiteSettings(models.Model):
    """Sayt umumiy sozlamalari"""
    site_name = models.CharField(max_length=100, default="MyLink.asia")
    site_description = models.TextField(blank=True)
    contact_email = models.EmailField(blank=True)
    contact_telegram = models.CharField(max_length=100, blank=True, help_text="@username yoki link")
    contact_phone = models.CharField(max_length=30, blank=True)
    support_telegram_url = models.CharField(max_length=200, blank=True, help_text="Yordam tugmasi/aloqa uchun Telegram havola, masalan https://t.me/username")
    telegram_bot_token = models.CharField(max_length=200, blank=True, help_text="Aloqa xabarlarini guruhga yuborish uchun bot tokeni")
    telegram_chat_id = models.CharField(max_length=50, blank=True, help_text="Xabarlar yuboriladigan guruh/chat ID")
    analytics_code = models.TextField(blank=True, help_text="Google Analytics yoki boshqa analytics kod")
    maintenance_mode = models.BooleanField(default=False)
    
    class Meta:
        verbose_name = "Sayt sozlamalari"
        verbose_name_plural = "Sayt sozlamalari"
    
    def __str__(self):
        return self.site_name
    
    def save(self, *args, **kwargs):
        # Faqat bitta instance bo'lishi kerak
        self.pk = 1
        super().save(*args, **kwargs)
    
    @classmethod
    def get_settings(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        return obj


LANG_CHOICES = [('uz', "O'zbek"), ('ru', 'Русский'), ('en', 'English')]


class ContactMessage(models.Model):
    """Landing aloqa formasi xabarlari."""
    name = models.CharField(max_length=120)
    contact = models.CharField(max_length=200, help_text="Email yoki Telegram")
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Aloqa xabari"
        verbose_name_plural = "Aloqa xabarlari"

    def __str__(self):
        return f"{self.name} ({self.created_at:%Y-%m-%d})"


class StaticPage(models.Model):
    """Admin'dan boshqariladigan statik sahifalar (Biz haqimizda, Maxfiylik, Shartlar)."""
    SLUG_CHOICES = [('about', 'Biz haqimizda'), ('privacy', 'Maxfiylik'), ('terms', 'Shartlar')]
    slug = models.CharField(max_length=20, choices=SLUG_CHOICES)
    language = models.CharField(max_length=2, choices=LANG_CHOICES, default='uz')
    title = models.CharField(max_length=200)
    body = models.TextField(help_text="HTML yoki oddiy matn")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('slug', 'language')
        ordering = ['slug', 'language']
        verbose_name = "Statik sahifa"
        verbose_name_plural = "Statik sahifalar"

    def __str__(self):
        return f"{self.get_slug_display()} [{self.language}]"


class BlogPost(models.Model):
    """Admin'dan boshqariladigan blog postlar."""
    language = models.CharField(max_length=2, choices=LANG_CHOICES, default='uz')
    slug = models.SlugField(max_length=120)
    title = models.CharField(max_length=200)
    excerpt = models.TextField(blank=True)
    cover = models.ImageField(upload_to='blog/', blank=True, null=True)
    body = models.TextField(help_text="HTML yoki oddiy matn")
    is_published = models.BooleanField(default=True)
    published_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('slug', 'language')
        ordering = ['-published_at']
        verbose_name = "Blog post"
        verbose_name_plural = "Blog postlar"

    def __str__(self):
        return f"{self.title} [{self.language}]"

