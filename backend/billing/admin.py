from django.contrib import admin

from .models import PlanPrice, Subscription


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
