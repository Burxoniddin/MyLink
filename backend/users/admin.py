from django.contrib import admin
from .models import CustomUser

@admin.register(CustomUser)
class CustomUserAdmin(admin.ModelAdmin):
    list_display = ['phone_number', 'is_verified', 'is_staff', 'date_joined']
    list_filter = ['is_verified', 'is_staff', 'is_active']
    search_fields = ['phone_number']
    ordering = ['-date_joined']
