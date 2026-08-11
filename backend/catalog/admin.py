from django.contrib import admin

from .models import Catalog, CatalogCategory, CatalogItem, CatalogItemImage
from .models import MAX_IMAGES_PER_ITEM


class CatalogCategoryInline(admin.TabularInline):
    model = CatalogCategory
    fields = ('name', 'order')
    extra = 0


@admin.register(Catalog)
class CatalogAdmin(admin.ModelAdmin):
    list_display = ('name', 'owner', 'business', 'button_label', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('name', 'owner__phone_number', 'owner__email',
                     'business__name', 'business__path')
    autocomplete_fields = ('owner', 'business')
    inlines = [CatalogCategoryInline]


class CatalogItemImageInline(admin.TabularInline):
    model = CatalogItemImage
    fields = ('image', 'thumb', 'order')
    max_num = MAX_IMAGES_PER_ITEM
    extra = 0


@admin.register(CatalogItem)
class CatalogItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'price', 'old_price', 'is_available', 'order')
    list_editable = ('price', 'is_available', 'order')
    list_filter = ('is_available',)
    search_fields = ('name', 'category__name', 'category__catalog__name',
                     'category__catalog__business__path')
    inlines = [CatalogItemImageInline]


# CatalogCategory is managed inline inside the Catalog page (no separate admin
# entry — PlanPrice precedent).
