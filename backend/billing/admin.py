from django.contrib import admin

from .models import PlanPrice, PromoCode, PromoRedemption, ReferralReward, Subscription


@admin.register(PlanPrice)
class PlanPriceAdmin(admin.ModelAdmin):
    list_display = ('tier', 'period', 'price', 'is_active')
    list_editable = ('price', 'is_active')
    list_filter = ('tier', 'is_active')


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
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
class PromoCodeAdmin(admin.ModelAdmin):
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
