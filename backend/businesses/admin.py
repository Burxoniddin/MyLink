from django.contrib import admin
from django.db.models import Count
from django.utils.html import format_html
from .models import Business, Link, ContentBlock, BusinessMembership, Event, MenuItem, SiteSettings, ContactMessage, NfcOrder, StaticPage, BlogPost


@admin.register(BusinessMembership)
class BusinessMembershipAdmin(admin.ModelAdmin):
    list_display = ['business', 'user', 'invite_email', 'invite_phone', 'role', 'accepted_at', 'created_at']
    list_filter = ['role', 'created_at']
    list_editable = ['role']
    search_fields = ['business__name', 'business__path', 'user__email', 'user__phone_number', 'invite_email', 'invite_phone']
    autocomplete_fields = ['business', 'user', 'invited_by']
    readonly_fields = ['created_at', 'accepted_at']


class LinkInline(admin.TabularInline):
    model = Link
    extra = 1
    fields = ['icon_type', 'title', 'url', 'order']


class ContentBlockInline(admin.TabularInline):
    model = ContentBlock
    extra = 0
    fields = ['block_type', 'title', 'text', 'image', 'video', 'embed_url', 'order']


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ['name', 'public_link', 'owner', 'template', 'is_locked', 'is_pinned', 'is_featured', 'created_at']
    list_filter = ['template', 'is_locked', 'is_pinned', 'is_featured', 'created_at']
    list_editable = ['is_locked', 'is_pinned', 'is_featured']
    search_fields = ['name', 'path', 'owner__phone_number']
    ordering = ['-created_at']
    prepopulated_fields = {'path': ('name',)}
    inlines = [LinkInline, ContentBlockInline]
    
    def public_link(self, obj):
        url = f'https://mylink.asia/{obj.path}'
        return format_html('<a href="{}" target="_blank">{}</a>', url, url)
    public_link.short_description = 'Link'
    
    fieldsets = (
        (None, {
            'fields': ('owner', 'path', 'name', 'description', 'logo', 'template', 'theme', 'is_locked', 'is_pinned', 'is_featured')
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


@admin.register(NfcOrder)
class NfcOrderAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'phone', 'quantity', 'user', 'status', 'created_at')
    list_editable = ('status',)
    list_filter = ('status', 'created_at')
    search_fields = ('full_name', 'phone', 'user__phone_number', 'user__email')
    date_hierarchy = 'created_at'


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ['event_type', 'business', 'label', 'created_at']
    list_filter = ['event_type', 'created_at']
    search_fields = ['business__name', 'business__path', 'label']
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False


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
            'fields': ('contact_email', 'contact_phone', 'contact_telegram', 'support_telegram_url')
        }),
        ('Telegram bot (aloqa xabarlari guruhga yuboriladi)', {
            'fields': ('telegram_bot_token', 'telegram_chat_id'),
            'classes': ('collapse',)
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


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'contact', 'short_message', 'is_read', 'created_at']
    list_filter = ['is_read', 'created_at']
    list_editable = ['is_read']
    search_fields = ['name', 'phone', 'contact', 'message']
    readonly_fields = ['name', 'phone', 'contact', 'message', 'created_at']
    date_hierarchy = 'created_at'

    def short_message(self, obj):
        return (obj.message[:60] + '...') if len(obj.message) > 60 else obj.message
    short_message.short_description = 'Xabar'

    def has_add_permission(self, request):
        return False


@admin.register(StaticPage)
class StaticPageAdmin(admin.ModelAdmin):
    list_display = ['slug', 'language', 'title', 'updated_at']
    list_filter = ['slug', 'language']
    search_fields = ['title', 'body']


@admin.register(BlogPost)
class BlogPostAdmin(admin.ModelAdmin):
    list_display = ['title', 'language', 'order', 'is_published', 'published_at']
    list_filter = ['language', 'is_published']
    list_editable = ['order', 'is_published']
    search_fields = ['title', 'excerpt', 'body']
    prepopulated_fields = {'slug': ('title',)}
    date_hierarchy = 'published_at'
