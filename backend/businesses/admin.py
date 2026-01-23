from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html
from .models import Business, Link, MenuItem, SiteSettings


class LinkInline(admin.TabularInline):
    model = Link
    extra = 1
    fields = ['icon_type', 'title', 'url', 'order']


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ['name', 'path', 'owner', 'created_at']
    list_filter = ['created_at']
    search_fields = ['name', 'path', 'owner__phone_number']
    ordering = ['-created_at']
    prepopulated_fields = {'path': ('name',)}
    inlines = [LinkInline]
    
    fieldsets = (
        (None, {
            'fields': ('owner', 'path', 'name', 'description', 'logo')
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    readonly_fields = ['created_at', 'updated_at']
    
    def links_count(self, obj):
        count = obj.links.count()
        return format_html('<span style="color: {};">{}</span>', 
                          '#10b981' if count > 0 else '#94a3b8', count)
    links_count.short_description = 'Linklar'
    
    def has_logo(self, obj):
        if obj.logo:
            return format_html('<span style="color: #10b981;">✓</span>')
        return format_html('<span style="color: #94a3b8;">✗</span>')
    has_logo.short_description = 'Logo'


@admin.register(Link)
class LinkAdmin(admin.ModelAdmin):
    list_display = ['title', 'business', 'icon_type', 'url_preview', 'order']
    list_filter = ['icon_type', 'business']
    search_fields = ['title', 'url', 'business__name']
    list_editable = ['order']
    
    def url_preview(self, obj):
        short_url = obj.url[:50] + '...' if len(obj.url) > 50 else obj.url
        return format_html('<a href="{}" target="_blank">{}</a>', obj.url, short_url)
    url_preview.short_description = 'URL'


@admin.register(MenuItem)
class MenuItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'location', 'path', 'order', 'is_active', 'is_external']
    list_filter = ['location', 'is_active']
    list_editable = ['order', 'is_active']
    search_fields = ['title', 'path']
    ordering = ['location', 'order']
    
    fieldsets = (
        (None, {
            'fields': ('title', 'path', 'icon')
        }),
        ('Sozlamalar', {
            'fields': ('location', 'order', 'is_active', 'is_external')
        }),
    )


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ['site_name', 'maintenance_mode']
    
    fieldsets = (
        ('Asosiy', {
            'fields': ('site_name', 'site_description')
        }),
        ('Aloqa', {
            'fields': ('contact_email', 'contact_telegram')
        }),
        ('Tizim', {
            'fields': ('maintenance_mode', 'analytics_code'),
            'classes': ('collapse',)
        }),
    )
    
    def has_add_permission(self, request):
        # Faqat bitta instance bo'lishi kerak
        return not SiteSettings.objects.exists()
    
    def has_delete_permission(self, request, obj=None):
        return False
