from django.db import models
from django.conf import settings

class Business(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='businesses')
    path = models.SlugField(unique=True, max_length=50, help_text="Unique path for the business page, e.g. 'mybrand'")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.path})"

class Link(models.Model):
    ICON_CHOICES = [
        ('telegram', 'Telegram'),
        ('instagram', 'Instagram'),
        ('facebook', 'Facebook'),
        ('x', 'X (Twitter)'),
        ('whatsapp', 'WhatsApp'),
        ('telegram_number', 'Telegram Number'),
        ('phone', 'Phone Number'),
        ('linkedin', 'LinkedIn'),
        ('website', 'Website'),
        ('other', 'Other'),
    ]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='links')
    title = models.CharField(max_length=100)
    url = models.URLField(max_length=500)
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

