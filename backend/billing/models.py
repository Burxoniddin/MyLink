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
