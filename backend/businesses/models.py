from django.db import models
from django.db.models import Q
from django.conf import settings
from django.utils import timezone

class Business(models.Model):
    # Public landing-page design. 'classic' is the original card; the rest are
    # sector-themed link-in-bio templates (see frontend templates/). Open to all
    # tiers (template is not a paid feature).
    TEMPLATE_CHOICES = [
        ('classic', 'Classic'),
        ('restoran', 'Restoran (FLAME)'),
        ('moda', 'Moda (editorial)'),
        ('klinika', 'Klinika (teal)'),
        ('avto', 'Avto (carbon)'),
        ('fitnes', 'Fitnes (lime)'),
    ]

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='businesses')
    path = models.SlugField(unique=True, max_length=50, help_text="Unique path for the business page, e.g. 'mybrand'")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    logo = models.ImageField(upload_to='logos/', blank=True, null=True)
    template = models.CharField(max_length=20, choices=TEMPLATE_CHOICES, default='classic')
    # Colour palette for the classic template (page background + button accent).
    # Changing it is gated by the color_edit feature (Oddiy/Pro); sector templates
    # carry their own palette so this only affects 'classic'.
    THEME_CHOICES = [
        ('default', 'Default (indigo)'),
        ('ocean', 'Ocean'),
        ('forest', 'Forest'),
        ('noir', 'Noir'),
        ('rose', 'Rose'),
        ('sunset', 'Sunset'),
    ]
    theme = models.CharField(max_length=20, choices=THEME_CHOICES, default='default')
    # Owner-chosen dark/light mode for the public page. Blank = the template's
    # own default (classic → dark, sector templates → their defaultTheme).
    THEME_MODE_CHOICES = [('dark', 'Dark'), ('light', 'Light')]
    theme_mode = models.CharField(max_length=5, choices=THEME_MODE_CHOICES, blank=True, default='')
    # Locked when the owner is over their tier's profile_limit (e.g. after a
    # downgrade). Locked pages are hidden publicly; the owner picks which to keep
    # active. See billing.services.sync_locks / businesses toggle endpoint.
    is_locked = models.BooleanField(default=False)
    # Owner-pinned ("starred") pages float to the top of the dashboard list.
    # Toggled via the businesses pin endpoint; affects dashboard ordering only.
    is_pinned = models.BooleanField(default=False)
    # Admin-curated: shown in the landing-page "Bizning mijozlar" carousel.
    is_featured = models.BooleanField(default=False, verbose_name="Landing'da ko'rsatish")
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
        ('steam', 'Steam'),
        ('behance', 'Behance'),
        ('dribbble', 'Dribbble'),
        ('twitch', 'Twitch'),
        ('discord', 'Discord'),
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


class BusinessMembership(models.Model):
    """A team member's access to a business (4e).

    Roles, weakest→strongest: ``viewer`` (read + analytics) < ``editor`` (edit
    content/links/blocks) < ``admin`` (also manage members). The page ``owner`` is
    implicit and outranks all roles — see ``businesses.access``.

    Supports *pending* invites: when the invitee has no account yet, ``user`` is
    null and the invited email/phone is stored. ``access.claim_pending_invites``
    attaches the membership the moment that person registers. Inviting is gated by
    the *owner's* ``team`` entitlement (Pro)."""
    ROLE_ADMIN = 'admin'
    ROLE_EDITOR = 'editor'
    ROLE_VIEWER = 'viewer'
    ROLES = [(ROLE_ADMIN, 'Admin'), (ROLE_EDITOR, 'Muharrir'), (ROLE_VIEWER, 'Kuzatuvchi')]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        null=True, blank=True, related_name='business_memberships',
    )
    # Identifier the invite was sent to (used to claim a pending invite on signup).
    invite_email = models.EmailField(blank=True)
    invite_phone = models.CharField(max_length=15, blank=True)
    role = models.CharField(max_length=10, choices=ROLES, default=ROLE_VIEWER)
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='+',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    accepted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Jamoa a'zosi"
        verbose_name_plural = "Jamoa a'zolari"
        constraints = [
            # A given user can belong to a business at most once (pending rows have
            # user=NULL and are excluded so multiple pending invites are possible).
            models.UniqueConstraint(
                fields=['business', 'user'],
                condition=Q(user__isnull=False),
                name='uniq_membership_business_user',
            ),
        ]

    @property
    def is_pending(self):
        return self.user_id is None

    def __str__(self):
        who = self.user or self.invite_email or self.invite_phone or '—'
        return f"{who} · {self.get_role_display()} @ {self.business.path}"


# Hard per-section media cap (not tier-dependent; the tier caps section count
# via the ``banners`` entitlement).
MAX_BLOCKS_PER_SECTION = 10


class MediaSection(models.Model):
    """A named group of media blocks on the public page (e.g. "Filiallarimiz",
    "Mijozlar fikri"). The public page shows sections as a horizontal carousel
    of cover cards; tapping one opens its blocks in the story viewer.

    Section count per business is tier-gated (``banners`` entitlement: free 0 /
    oddiy 3 / pro 10); each section holds at most ``MAX_BLOCKS_PER_SECTION``
    blocks."""
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='media_sections')
    name = models.CharField(max_length=100)
    cover = models.ImageField(upload_to='sections/', blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        verbose_name = "Media bo'lim"
        verbose_name_plural = "Media bo'limlar"

    def __str__(self):
        return f"{self.name} — {self.business.name}"


class ContentBlock(models.Model):
    """A media / content block inside a ``MediaSection`` (image, uploaded or
    embedded video, or text). Video access is tier-gated (``banner_video``).
    Ordered like ``Link``; ``section`` is nullable only for legacy rows created
    before sections existed (the data migration groups those into a default
    section)."""
    BLOCK_TYPES = [('image', 'Rasm'), ('video', 'Video'), ('text', 'Matn')]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='content_blocks')
    section = models.ForeignKey(MediaSection, on_delete=models.CASCADE, null=True, blank=True, related_name='blocks')
    block_type = models.CharField(max_length=10, choices=BLOCK_TYPES)
    order = models.PositiveIntegerField(default=0)
    title = models.CharField(max_length=200, blank=True)
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to='blocks/', blank=True, null=True)
    video = models.FileField(upload_to='blocks/videos/', blank=True, null=True)
    embed_url = models.CharField(max_length=500, blank=True, help_text="YouTube/Instagram embed havolasi")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order']
        verbose_name = "Kontent blok"
        verbose_name_plural = "Kontent bloklar"

    def __str__(self):
        return f"{self.get_block_type_display()} — {self.business.name}"


class Event(models.Model):
    """A tracked interaction on a public page: page view, link click, share, or
    banner/block view. Written by the public ``/api/track/`` endpoint and
    aggregated by the owner analytics endpoint (tier-gated ``analytics``)."""
    EVENT_TYPES = [('view', 'View'), ('click', 'Click'), ('share', 'Share'), ('banner', 'Banner')]

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=10, choices=EVENT_TYPES)
    # Free-text target label (e.g. clicked link's title). Not an FK because Link
    # rows are recreated on every save, so PKs aren't stable.
    label = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['business', 'event_type', 'created_at'])]

    def __str__(self):
        return f"{self.event_type} — {self.business.path}"


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


class NfcOrder(models.Model):
    """A request for NFC business cards (lead). No online payment — the team
    contacts the user. Forwarded to the Telegram group on creation."""
    STATUS = [('new', 'Yangi'), ('processing', 'Jarayonda'), ('done', 'Bajarildi'), ('canceled', 'Bekor')]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='nfc_orders')
    # Optional: which of the user's own pages the card should point to.
    business = models.ForeignKey(
        Business, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='nfc_orders', verbose_name="Biznes (ixtiyoriy)",
    )
    full_name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30)
    quantity = models.PositiveIntegerField(default=1)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=12, choices=STATUS, default='new')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "NFC buyurtma"
        verbose_name_plural = "NFC buyurtmalar"

    def __str__(self):
        return f"{self.full_name} ×{self.quantity} ({self.get_status_display()})"


class ContactMessage(models.Model):
    """Landing aloqa formasi xabarlari. Email yoki telefon — kamida bittasi shart
    (serializer'da tekshiriladi)."""
    name = models.CharField(max_length=120)
    phone = models.CharField(max_length=30, blank=True, help_text="Telefon raqam")
    contact = models.CharField(max_length=200, blank=True, help_text="Email yoki Telegram")
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
    # Optional: a page with empty body is treated as "not published" → the public
    # endpoint 404s and the frontend shows the "coming soon" placeholder.
    title = models.CharField(max_length=200, blank=True)
    body = models.TextField(blank=True, help_text="Bo'sh qoldirsangiz sahifa 'tez orada' deb ko'rsatiladi")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('slug', 'language')
        ordering = ['slug', 'language']
        verbose_name = "Statik sahifa"
        verbose_name_plural = "Statik sahifalar"

    def __str__(self):
        return f"{self.get_slug_display()} [{self.language}]"


class BlogPost(models.Model):
    """Admin'dan boshqariladigan blog postlar. ``order`` — ro'yxatdagi o'rni
    (kichigi birinchi); teng bo'lsa yangisi oldinda."""
    language = models.CharField(max_length=2, choices=LANG_CHOICES, default='uz')
    slug = models.SlugField(max_length=120)
    title = models.CharField(max_length=200, blank=True)
    excerpt = models.TextField(blank=True)
    cover = models.ImageField(upload_to='blog/', blank=True, null=True)
    # Empty body → post is hidden from the public list/detail (shows "coming soon").
    body = models.TextField(blank=True, help_text="Bo'sh qoldirsangiz post chiqmaydi")
    order = models.PositiveIntegerField(default=0, verbose_name="Tartib", help_text="Ro'yxatdagi o'rni — kichigi birinchi chiqadi")
    is_published = models.BooleanField(default=True)
    published_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('slug', 'language')
        ordering = ['order', '-published_at']
        verbose_name = "Blog post"
        verbose_name_plural = "Blog postlar"

    def __str__(self):
        return f"{self.title} [{self.language}]"

