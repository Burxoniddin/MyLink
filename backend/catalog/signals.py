"""Delete uploaded files from storage when their rows go away. Django never
removes files on row delete; cascade deletes (catalog → categories → items →
images) still emit per-row post_delete, so these two receivers cover every
path, including admin deletes."""
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Catalog, CatalogItemImage


@receiver(post_delete, sender=CatalogItemImage)
def delete_item_image_files(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)
    if instance.thumb:
        instance.thumb.delete(save=False)


@receiver(post_delete, sender=Catalog)
def delete_catalog_banner(sender, instance, **kwargs):
    if instance.banner:
        instance.banner.delete(save=False)
