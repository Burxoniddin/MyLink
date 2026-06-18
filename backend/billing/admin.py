from django import forms
from django.contrib import admin

from .models import Plan, PlanPrice, PromoCode, PromoRedemption, ReferralReward, Subscription


class TierChoiceMixin:
    """Render the free-text ``tier`` / ``grant_tier`` fields as a dropdown of the
    current Plans, so admins pick an existing tier instead of typing a slug."""
    tier_fields = ('tier',)

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        field = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name in self.tier_fields:
            choices = [(p.slug, f'{p.name} ({p.slug})') for p in Plan.objects.all()]
            return forms.ChoiceField(
                choices=choices, required=not db_field.blank,
                label=field.label, help_text=field.help_text,
                initial=field.initial,
            )
        return field


class PlanPriceInline(admin.TabularInline):
    """Prices for a plan, edited right inside the Plan page."""
    model = PlanPrice
    extra = 1
    fields = ('period', 'price', 'is_active')


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'rank', 'is_default', 'is_active', 'is_public',
                    'profile_limit', 'analytics', 'qr', 'team')
    list_editable = ('rank', 'is_default', 'is_active', 'is_public', 'profile_limit',
                     'analytics', 'qr', 'team')
    prepopulated_fields = {'slug': ('name',)}
    inlines = [PlanPriceInline]
    fieldsets = (
        (None, {'fields': ('name', 'slug', 'rank', 'is_default', 'is_active', 'is_public', 'order')}),
        ('Funksiyalar', {'fields': (
            'profile_limit', 'templates', 'color_edit', 'banners', 'banner_video',
            'analytics', 'qr', 'branding_removed', 'verified_badge', 'team',
        )}),
    )


# PlanPrice is managed inline inside the Plan page (PlanPriceInline) — no
# separate admin entry to avoid a redundant editing path.


@admin.register(Subscription)
class SubscriptionAdmin(TierChoiceMixin, admin.ModelAdmin):
    tier_fields = ('tier',)
    list_display = ('user', 'tier', 'period', 'status', 'started_at', 'expires_at', 'source')
    list_filter = ('tier', 'status', 'source')
    search_fields = ('user__phone_number', 'user__email')
    autocomplete_fields = ('user',)
    date_hierarchy = 'created_at'


class PromoRedemptionInline(admin.TabularInline):
    model = PromoRedemption
    extra = 0
    can_delete = False
    readonly_fields = ('user', 'subscription', 'created_at')

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(PromoCode)
class PromoCodeAdmin(TierChoiceMixin, admin.ModelAdmin):
    tier_fields = ('grant_tier',)
    list_display = ('code', 'grant_tier', 'duration_days', 'redeemed_count', 'max_redemptions',
                    'is_active', 'valid_until')
    list_filter = ('grant_tier', 'is_active', 'once_per_user')
    search_fields = ('code', 'note')
    readonly_fields = ('redeemed_count', 'created_at')
    inlines = [PromoRedemptionInline]


@admin.register(PromoRedemption)
class PromoRedemptionAdmin(admin.ModelAdmin):
    list_display = ('code', 'user', 'subscription', 'created_at')
    search_fields = ('code__code', 'user__phone_number', 'user__email')
    autocomplete_fields = ('user',)
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False


@admin.register(ReferralReward)
class ReferralRewardAdmin(admin.ModelAdmin):
    list_display = ('referrer', 'referred', 'subscription', 'created_at')
    search_fields = ('referrer__phone_number', 'referrer__email',
                     'referred__phone_number', 'referred__email')
    autocomplete_fields = ('referrer', 'referred', 'subscription')
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False
