from django.conf import settings
from django.db import models
from django.utils import timezone

from . import entitlements as ent


class Plan(models.Model):
    """An admin-defined subscription tier and its feature set (item 6).

    Fully dynamic: admins can add new tiers (e.g. 'Biznes'), set their ``rank``
    (the highest-rank active subscription wins) and toggle every feature. The
    feature matrix in ``entitlements.FEATURES`` is only a fallback used before
    these rows exist (fresh DB). One plan is ``is_default`` — the tier users have
    with no active subscription."""
    ANALYTICS_LEVELS = [('none', "Yo'q"), ('partial', 'Qisman'), ('full', "To'liq")]
    QR_LEVELS = [('none', "Yo'q"), ('png', 'PNG'), ('full', 'PNG + PDF + vizitka')]

    # Feature columns mirrored to the entitlements payload via features_dict().
    FEATURE_FIELDS = [
        'profile_limit', 'templates', 'color_edit', 'banners', 'banner_video',
        'analytics', 'qr', 'branding_removed', 'verified_badge', 'team',
        'catalog',
    ]

    slug = models.SlugField(max_length=20, unique=True, help_text="Texnik nom: free, oddiy, pro, biznes ...")
    name = models.CharField(max_length=50, help_text="Ko'rinadigan nom")
    rank = models.PositiveIntegerField(default=0, help_text="Kattaroq = kuchliroq. Eng yuqori rankli faol obuna g'olib bo'ladi.")
    is_default = models.BooleanField(default=False, help_text="Obunasiz foydalanuvchilar shu tarifda bo'ladi (faqat bittasi).")
    is_active = models.BooleanField(default=True)
    is_public = models.BooleanField(
        default=True, verbose_name="Mijozlarga ko'rinadi",
        help_text="O'chirilsa tarif landing/narxlar sahifasida chiqmaydi — "
                  "faqat adminlar obuna berishda ishlata oladi.")
    order = models.PositiveIntegerField(default=0, help_text="Narxlar sahifasidagi tartib.")

    # --- feature matrix ---
    profile_limit = models.PositiveIntegerField(default=1, verbose_name="Sahifalar soni")
    templates = models.PositiveIntegerField(default=1, verbose_name="Shablonlar soni")
    color_edit = models.BooleanField(default=False, verbose_name="Rang tahrirlash")
    banners = models.PositiveIntegerField(default=0, verbose_name="Media bloklar soni")
    banner_video = models.BooleanField(default=False, verbose_name="Video blok")
    analytics = models.CharField(max_length=10, choices=ANALYTICS_LEVELS, default='none')
    qr = models.CharField(max_length=10, choices=QR_LEVELS, default='none', verbose_name="QR / vizitka")
    branding_removed = models.BooleanField(default=False, verbose_name="Brending olib tashlanadi")
    verified_badge = models.BooleanField(default=False, verbose_name="Tasdiq belgisi")
    team = models.BooleanField(default=False, verbose_name="Jamoa / rollar")
    catalog = models.BooleanField(default=False, verbose_name="Katalog / web-menyu")

    class Meta:
        ordering = ['order', 'rank']
        verbose_name = 'Tarif (Plan)'
        verbose_name_plural = 'Tariflar (Plans)'

    def features_dict(self):
        return {f: getattr(self, f) for f in self.FEATURE_FIELDS}

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        # Exactly one default tier.
        if self.is_default:
            Plan.objects.exclude(pk=self.pk).filter(is_default=True).update(is_default=False)

    def __str__(self):
        return f"{self.name} ({self.slug}) · rank {self.rank}"


class PlanPrice(models.Model):
    """Editable price for a (plan, period) combination, managed inline inside the
    Plan admin. ``tier`` mirrors ``plan.slug`` (kept for the pricing API/checkout)
    and is filled automatically from the linked plan."""
    plan = models.ForeignKey('Plan', on_delete=models.CASCADE, related_name='prices',
                             null=True, blank=True)
    tier = models.CharField(max_length=20, blank=True)  # auto = plan.slug
    period = models.CharField(max_length=10, choices=ent.PERIOD_CHOICES)
    price = models.PositiveIntegerField(help_text="Narx (UZS so'm)")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('plan', 'period')
        ordering = ['tier', 'period']
        verbose_name = 'Tarif narxi'
        verbose_name_plural = 'Tarif narxlari'

    def save(self, *args, **kwargs):
        if self.plan_id:
            self.tier = self.plan.slug
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tier} / {self.get_period_display()}: {self.price}"


class Subscription(models.Model):
    """A grant of a paid tier to a user. The effective tier is computed from a
    user's active subscriptions (see services.effective_tier)."""
    STATUS = [('active', 'Active'), ('expired', 'Expired'), ('canceled', 'Canceled')]
    SOURCE = [
        ('payment', 'Payment'),
        ('promo', 'Promo'),
        ('referral', 'Referral'),
        ('manual', 'Manual'),
        ('gift', 'Gift'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='subscriptions')
    tier = models.CharField(max_length=20)  # Plan slug
    period = models.CharField(max_length=10, choices=ent.PERIOD_CHOICES, blank=True)
    started_at = models.DateTimeField(default=timezone.now)
    # null expires_at = permanent (Oddiy one-time, or lifetime Pro).
    expires_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS, default='active')
    source = models.CharField(max_length=10, choices=SOURCE, default='manual')
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Obuna'
        verbose_name_plural = 'Obunalar'

    def is_currently_active(self):
        if self.status != 'active':
            return False
        if self.expires_at is None:
            return True
        return self.expires_at > timezone.now()

    def __str__(self):
        return f"{self.user} - {self.tier} ({self.status})"


class PaymentOrder(models.Model):
    """One Click checkout attempt for a (plan, period).

    ``merchant_trans_id`` sent to Click is this row's pk. Click's Prepare call
    marks it prepared (stores ``click_trans_id``); Complete marks it paid and
    grants the subscription (see billing.views Click callback)."""
    STATUS = [('pending', 'Pending'), ('paid', 'Paid'), ('canceled', 'Canceled')]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_orders')
    tier = models.CharField(max_length=20)   # Plan slug
    period = models.CharField(max_length=10, choices=ent.PERIOD_CHOICES)
    amount = models.PositiveIntegerField(help_text="Narx (UZS so'm)")
    status = models.CharField(max_length=10, choices=STATUS, default='pending')
    click_trans_id = models.CharField(max_length=40, blank=True)
    subscription = models.ForeignKey(Subscription, null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name='payment_orders')
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "To'lov (Click)"
        verbose_name_plural = "To'lovlar (Click)"

    def __str__(self):
        return f"#{self.pk} {self.user} {self.tier}/{self.period} {self.amount} ({self.status})"


class PromoCode(models.Model):
    """A redeemable code that grants a paid tier directly (no payment).

    Used for lifetime gifts, beta-tester perks, marketing campaigns, etc. The
    paid-checkout discount path lands with 1a (payment); this model only covers
    the grant path."""
    code = models.CharField(max_length=40, unique=True, help_text="Foydalanuvchi kiritadigan kod (avto katta harf)")
    grant_tier = models.CharField(max_length=20, default=ent.PRO,
                                  verbose_name="Beriladigan tarif")  # Plan slug
    duration_days = models.PositiveIntegerField(null=True, blank=True,
                                                help_text="Necha kunga beriladi. Bo'sh = umrbod (lifetime).")
    max_redemptions = models.PositiveIntegerField(null=True, blank=True,
                                                  help_text="Jami necha marta ishlatilishi mumkin. Bo'sh = cheksiz.")
    redeemed_count = models.PositiveIntegerField(default=0, editable=False)
    once_per_user = models.BooleanField(default=True, help_text="Bitta foydalanuvchi faqat bir marta ishlata oladi")
    valid_until = models.DateTimeField(null=True, blank=True,
                                       help_text="Shu sanadan keyin kod ishlamaydi. Bo'sh = muddatsiz.")
    is_active = models.BooleanField(default=True)
    note = models.CharField(max_length=200, blank=True, help_text="Ichki izoh (kampaniya nomi va h.k.)")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Promokod'
        verbose_name_plural = 'Promokodlar'

    def save(self, *args, **kwargs):
        self.code = (self.code or '').strip().upper()
        super().save(*args, **kwargs)

    def is_redeemable(self):
        """Returns (ok, reason_key). reason_key is a short machine code used to
        pick a translated message on the client."""
        if not self.is_active:
            return False, 'inactive'
        if self.valid_until is not None and self.valid_until <= timezone.now():
            return False, 'expired'
        if self.max_redemptions is not None and self.redeemed_count >= self.max_redemptions:
            return False, 'exhausted'
        return True, ''

    def __str__(self):
        return f"{self.code} → {self.grant_tier}"


class ReferralReward(models.Model):
    """One reward event: a referred friend's first Pro conversion. ``subscription``
    is the +1 month Pro granted to the referrer (``None`` if the referrer was over
    the yearly cap). One row per referred friend (OneToOne) so a friend can only
    reward once."""
    referrer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                 related_name='referral_rewards_given')
    referred = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                    related_name='referral_reward_received')
    subscription = models.ForeignKey(Subscription, null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name='referral_rewards')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Referral mukofoti'
        verbose_name_plural = 'Referral mukofotlari'

    def __str__(self):
        return f"{self.referrer} ← {self.referred}"


class PromoRedemption(models.Model):
    """Audit row: one user redeeming one code, linked to the granted sub."""
    code = models.ForeignKey(PromoCode, on_delete=models.CASCADE, related_name='redemptions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='promo_redemptions')
    subscription = models.ForeignKey(Subscription, null=True, blank=True, on_delete=models.SET_NULL,
                                     related_name='promo_redemptions')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Promokod ishlatilishi'
        verbose_name_plural = 'Promokod ishlatilishlari'

    def __str__(self):
        return f"{self.user} ← {self.code.code}"
