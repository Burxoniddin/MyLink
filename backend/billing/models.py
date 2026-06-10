from django.conf import settings
from django.db import models
from django.utils import timezone

from . import entitlements as ent


class PlanPrice(models.Model):
    """Editable price for a (tier, period) combination. Used by the pricing
    page and payment checkout."""
    tier = models.CharField(max_length=10, choices=ent.TIER_CHOICES)
    period = models.CharField(max_length=10, choices=ent.PERIOD_CHOICES)
    price = models.PositiveIntegerField(help_text="Narx (UZS so'm)")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('tier', 'period')
        ordering = ['tier', 'period']
        verbose_name = 'Tarif narxi'
        verbose_name_plural = 'Tarif narxlari'

    def __str__(self):
        return f"{self.get_tier_display()} / {self.get_period_display()}: {self.price}"


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
    tier = models.CharField(max_length=10, choices=ent.TIER_CHOICES)
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
        return f"{self.user} - {self.get_tier_display()} ({self.status})"


class PromoCode(models.Model):
    """A redeemable code that grants a paid tier directly (no payment).

    Used for lifetime gifts, beta-tester perks, marketing campaigns, etc. The
    paid-checkout discount path lands with 1a (payment); this model only covers
    the grant path."""
    code = models.CharField(max_length=40, unique=True, help_text="Foydalanuvchi kiritadigan kod (avto katta harf)")
    grant_tier = models.CharField(max_length=10, choices=ent.TIER_CHOICES, default=ent.PRO,
                                  verbose_name="Beriladigan tarif")
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
        return f"{self.code} → {self.get_grant_tier_display()}"


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
