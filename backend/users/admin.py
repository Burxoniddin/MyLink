from django.contrib import admin
from .models import CustomUser, ReferralCode

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ['phone_number', 'email', 'is_verified', 'referred_by', 'is_staff', 'date_joined']
    list_filter = ['is_verified', 'is_staff', 'is_active']
    search_fields = ['phone_number', 'email']
    autocomplete_fields = ['referred_by']
    ordering = ['-date_joined']


@admin.register(ReferralCode)
class ReferralCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'user', 'created_at']
    search_fields = ['code', 'user__phone_number', 'user__email']
    autocomplete_fields = ['user']
