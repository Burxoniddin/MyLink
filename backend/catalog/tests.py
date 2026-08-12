import os
import tempfile
from datetime import timedelta
from io import BytesIO
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone
from PIL import Image
from rest_framework.authtoken.models import Token
from rest_framework.test import APIClient

from billing import entitlements as ent
from billing.models import Subscription
from businesses.models import Business
from catalog.models import (
    MAX_CATEGORIES_PER_CATALOG, MAX_IMAGES_PER_ITEM, MAX_ITEMS_PER_CATEGORY,
    Catalog, CatalogCategory, CatalogItem, CatalogItemImage,
)

User = get_user_model()

LOCMEM = {'default': {'BACKEND': 'django.core.cache.backends.locmem.LocMemCache'}}
TMP_MEDIA = tempfile.mkdtemp(prefix='mylink-catalog-tests-')


def png_upload(name='t.png', size=(64, 64), color=(200, 30, 30)):
    buf = BytesIO()
    Image.new('RGB', size, color).save(buf, format='PNG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/png')


class CatalogTestCase(TestCase):
    """Shared auth/data helpers for the catalog test classes."""

    def setUp(self):
        self.user = User.objects.create_user(phone_number='+998901112233')
        self.client = APIClient()
        token = Token.objects.create(user=self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')

    def grant(self, tier=ent.PRO):
        return Subscription.objects.create(user=self.user, tier=tier, expires_at=None)

    def make_catalog(self, owner=None, name='Menyu'):
        return Catalog.objects.create(owner=owner or self.user, name=name)

    def make_other_user(self, phone='+998907776655'):
        other = User.objects.create_user(phone_number=phone)
        client = APIClient()
        token = Token.objects.create(user=other)
        client.credentials(HTTP_AUTHORIZATION=f'Token {token.key}')
        return other, client


@override_settings(CACHES=LOCMEM)
class CatalogGatingTests(CatalogTestCase):
    def test_free_cannot_create(self):
        res = self.client.post('/api/catalogs/', {'name': 'Menyu'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'catalog')

    def test_oddiy_cannot_create(self):
        self.grant(ent.ODDIY)
        res = self.client.post('/api/catalogs/', {'name': 'Menyu'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'catalog')

    def test_pro_creates(self):
        self.grant()
        res = self.client.post('/api/catalogs/', {'name': 'Osh markazi menyusi'}, format='json')
        self.assertEqual(res.status_code, 201)
        catalog = Catalog.objects.get(pk=res.data['id'])
        self.assertEqual(catalog.owner, self.user)
        self.assertEqual(catalog.name, 'Osh markazi menyusi')
        self.assertTrue(catalog.is_active)

    def test_list_stays_open_without_feature(self):
        # Retained data is visible after a downgrade; the frontend shows the upsell.
        self.make_catalog()
        res = self.client.get('/api/catalogs/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(len(res.data), 1)
        self.assertEqual(res.data[0]['name'], 'Menyu')

    def test_write_blocked_without_feature_but_delete_allowed(self):
        catalog = self.make_catalog()
        res = self.client.patch(f'/api/catalogs/{catalog.pk}/', {'name': 'X'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'catalog')
        res = self.client.delete(f'/api/catalogs/{catalog.pk}/')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(Catalog.objects.exists())

    def test_stranger_gets_404(self):
        other, other_client = self.make_other_user()
        catalog = self.make_catalog()
        res = other_client.get(f'/api/catalogs/{catalog.pk}/')
        self.assertEqual(res.status_code, 404)
        res = other_client.patch(f'/api/catalogs/{catalog.pk}/', {'name': 'X'}, format='json')
        self.assertEqual(res.status_code, 404)

    def test_attach_own_business(self):
        self.grant()
        business = Business.objects.create(owner=self.user, path='osh', name='Osh')
        catalog = self.make_catalog()
        res = self.client.patch(f'/api/catalogs/{catalog.pk}/',
                                {'business': business.pk}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['business_path'], 'osh')
        catalog.refresh_from_db()
        self.assertEqual(catalog.business, business)
        # Detach again.
        res = self.client.patch(f'/api/catalogs/{catalog.pk}/', {'business': None}, format='json')
        self.assertEqual(res.status_code, 200)
        catalog.refresh_from_db()
        self.assertIsNone(catalog.business)

    def test_attach_foreign_business_denied(self):
        self.grant()
        other, _ = self.make_other_user()
        foreign = Business.objects.create(owner=other, path='baz', name='Baz')
        catalog = self.make_catalog()
        res = self.client.patch(f'/api/catalogs/{catalog.pk}/',
                                {'business': foreign.pk}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'not_your_business')

    def test_attach_business_already_taken(self):
        self.grant()
        business = Business.objects.create(owner=self.user, path='osh', name='Osh')
        Catalog.objects.create(owner=self.user, name='Birinchi', business=business)
        second = self.make_catalog(name='Ikkinchi')
        res = self.client.patch(f'/api/catalogs/{second.pk}/',
                                {'business': business.pk}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'business_has_catalog')


@override_settings(CACHES=LOCMEM)
class CatalogCrudTests(CatalogTestCase):
    def setUp(self):
        super().setUp()
        self.grant()
        self.catalog = self.make_catalog()

    def make_category(self, name='Taomlar', order=1):
        return CatalogCategory.objects.create(catalog=self.catalog, name=name, order=order)

    def test_category_create_orders_sequentially(self):
        r1 = self.client.post(f'/api/catalogs/{self.catalog.pk}/categories/',
                              {'name': 'Ichimliklar'}, format='json')
        r2 = self.client.post(f'/api/catalogs/{self.catalog.pk}/categories/',
                              {'name': 'Taomlar'}, format='json')
        self.assertEqual(r1.status_code, 201)
        self.assertEqual(r2.status_code, 201)
        self.assertLess(r1.data['order'], r2.data['order'])

    def test_category_limit(self):
        CatalogCategory.objects.bulk_create([
            CatalogCategory(catalog=self.catalog, name=f'K{i}', order=i)
            for i in range(MAX_CATEGORIES_PER_CATALOG)
        ])
        res = self.client.post(f'/api/catalogs/{self.catalog.pk}/categories/',
                               {'name': 'Ortiqcha'}, format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'category_limit')

    def test_category_rename_and_reorder(self):
        a = self.make_category('A', 1)
        b = self.make_category('B', 2)
        res = self.client.patch(f'/api/catalog/categories/{a.pk}/', {'name': 'A2'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['name'], 'A2')
        res = self.client.post(f'/api/catalogs/{self.catalog.pk}/categories/reorder/',
                               {'order': [b.pk, a.pk]}, format='json')
        self.assertEqual(res.status_code, 200)
        listed = self.client.get(f'/api/catalogs/{self.catalog.pk}/categories/')
        self.assertEqual([c['id'] for c in listed.data], [b.pk, a.pk])

    def test_category_delete_cascades(self):
        cat = self.make_category()
        CatalogItem.objects.create(category=cat, name='Osh', price=25000, order=1)
        res = self.client.delete(f'/api/catalog/categories/{cat.pk}/')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(CatalogItem.objects.exists())

    def test_item_create(self):
        cat = self.make_category()
        res = self.client.post(f'/api/catalogs/{self.catalog.pk}/items/',
                               {'category': cat.pk, 'name': 'Osh', 'price': 25000,
                                'description': 'Choyxona osh'}, format='json')
        self.assertEqual(res.status_code, 201)
        item = CatalogItem.objects.get(pk=res.data['id'])
        self.assertEqual(item.category, cat)
        self.assertTrue(item.is_available)

    def test_item_foreign_category_invalid(self):
        foreign_catalog = self.make_catalog(name='Boshqa')
        foreign_cat = CatalogCategory.objects.create(catalog=foreign_catalog, name='X', order=1)
        res = self.client.post(f'/api/catalogs/{self.catalog.pk}/items/',
                               {'category': foreign_cat.pk, 'name': 'Osh', 'price': 1000},
                               format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'invalid_category')

    def test_item_limit(self):
        cat = self.make_category()
        CatalogItem.objects.bulk_create([
            CatalogItem(category=cat, name=f'T{i}', price=1000, order=i)
            for i in range(MAX_ITEMS_PER_CATEGORY)
        ])
        res = self.client.post(f'/api/catalogs/{self.catalog.pk}/items/',
                               {'category': cat.pk, 'name': 'Ortiqcha', 'price': 1000},
                               format='json')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'item_limit')

    def test_item_update_and_move(self):
        a = self.make_category('A', 1)
        b = self.make_category('B', 2)
        item = CatalogItem.objects.create(category=a, name='Osh', price=25000, order=1)
        res = self.client.patch(f'/api/catalog/items/{item.pk}/',
                                {'price': 30000, 'old_price': 35000, 'is_available': False},
                                format='json')
        self.assertEqual(res.status_code, 200)
        item.refresh_from_db()
        self.assertEqual(item.price, 30000)
        self.assertEqual(item.old_price, 35000)
        self.assertFalse(item.is_available)
        # Move to a sibling category — fine.
        res = self.client.patch(f'/api/catalog/items/{item.pk}/', {'category': b.pk}, format='json')
        self.assertEqual(res.status_code, 200)
        # Move into another catalog's category — rejected.
        foreign_catalog = self.make_catalog(name='Boshqa')
        foreign_cat = CatalogCategory.objects.create(catalog=foreign_catalog, name='X', order=1)
        res = self.client.patch(f'/api/catalog/items/{item.pk}/',
                                {'category': foreign_cat.pk}, format='json')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'invalid_category')

    def test_item_reorder(self):
        cat = self.make_category()
        i1 = CatalogItem.objects.create(category=cat, name='A', price=1, order=1)
        i2 = CatalogItem.objects.create(category=cat, name='B', price=2, order=2)
        res = self.client.post(f'/api/catalogs/{self.catalog.pk}/items/reorder/',
                               {'order': [i2.pk, i1.pk]}, format='json')
        self.assertEqual(res.status_code, 200)
        i1.refresh_from_db()
        i2.refresh_from_db()
        self.assertLess(i2.order, i1.order)

    def test_appearance_defaults_and_update(self):
        res = self.client.get(f'/api/catalogs/{self.catalog.pk}/')
        self.assertEqual(res.data['theme'], 'mylink')
        self.assertEqual(res.data['theme_mode'], 'dark')
        self.assertEqual(res.data['card_style'], 'grid')
        res = self.client.patch(f'/api/catalogs/{self.catalog.pk}/',
                                {'theme': 'tandir', 'theme_mode': 'light',
                                 'card_style': 'grid'}, format='json')
        self.assertEqual(res.status_code, 200)
        self.catalog.refresh_from_db()
        self.assertEqual(self.catalog.theme, 'tandir')
        self.assertEqual(self.catalog.theme_mode, 'light')
        self.assertEqual(self.catalog.card_style, 'grid')

    def test_unknown_theme_rejected(self):
        res = self.client.patch(f'/api/catalogs/{self.catalog.pk}/',
                                {'theme': 'kosmos'}, format='json')
        self.assertEqual(res.status_code, 400)

    def test_stranger_cannot_touch_children(self):
        other, other_client = self.make_other_user()
        cat = self.make_category()
        item = CatalogItem.objects.create(category=cat, name='Osh', price=25000, order=1)
        self.assertEqual(
            other_client.patch(f'/api/catalog/categories/{cat.pk}/', {'name': 'X'},
                               format='json').status_code, 404)
        self.assertEqual(
            other_client.patch(f'/api/catalog/items/{item.pk}/', {'price': 1},
                               format='json').status_code, 404)


@override_settings(CACHES=LOCMEM, MEDIA_ROOT=TMP_MEDIA)
class CatalogImageTests(CatalogTestCase):
    def setUp(self):
        super().setUp()
        self.grant()
        self.catalog = self.make_catalog()
        self.category = CatalogCategory.objects.create(catalog=self.catalog, name='Taomlar', order=1)
        self.item = CatalogItem.objects.create(category=self.category, name='Osh',
                                               price=25000, order=1)

    def upload(self, **kwargs):
        return self.client.post(f'/api/catalog/items/{self.item.pk}/images/',
                                {'image_upload': png_upload(**kwargs)}, format='multipart')

    def test_upload_is_processed_and_thumbed(self):
        res = self.upload(size=(2400, 1200))
        self.assertEqual(res.status_code, 201)
        img = CatalogItemImage.objects.get(pk=res.data['id'])
        self.assertTrue(img.image.name.endswith('.jpg'))
        with Image.open(img.image.path) as full:
            self.assertLessEqual(max(full.size), 1600)
            self.assertEqual(full.format, 'JPEG')
        with Image.open(img.thumb.path) as thumb:
            self.assertLessEqual(max(thumb.size), 480)
        self.assertTrue(res.data['image'].startswith('http'))
        self.assertTrue(res.data['thumb'].startswith('http'))

    def test_small_image_not_upscaled(self):
        res = self.upload(size=(300, 200))
        self.assertEqual(res.status_code, 201)
        img = CatalogItemImage.objects.get(pk=res.data['id'])
        with Image.open(img.image.path) as full:
            self.assertEqual(full.size, (300, 200))

    def test_image_limit(self):
        for _ in range(MAX_IMAGES_PER_ITEM):
            self.assertEqual(self.upload().status_code, 201)
        res = self.upload()
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'image_limit')

    def test_image_too_large(self):
        with patch('catalog.serializers.MAX_IMAGE_BYTES', 100):
            res = self.upload()
        self.assertEqual(res.status_code, 400)
        self.assertIn('image_too_large', str(res.data))

    def test_invalid_image_rejected(self):
        res = self.client.post(f'/api/catalog/items/{self.item.pk}/images/',
                               {'image_upload': SimpleUploadedFile('x.png', b'not-an-image',
                                                                   content_type='image/png')},
                               format='multipart')
        self.assertEqual(res.status_code, 400)

    def test_delete_removes_files_from_disk(self):
        res = self.upload()
        img = CatalogItemImage.objects.get(pk=res.data['id'])
        image_path, thumb_path = img.image.path, img.thumb.path
        self.assertTrue(os.path.exists(image_path))
        self.assertTrue(os.path.exists(thumb_path))
        res = self.client.delete(f'/api/catalog/images/{img.pk}/')
        self.assertEqual(res.status_code, 204)
        self.assertFalse(os.path.exists(image_path))
        self.assertFalse(os.path.exists(thumb_path))

    def test_cascade_delete_removes_files(self):
        res = self.upload()
        img = CatalogItemImage.objects.get(pk=res.data['id'])
        image_path = img.image.path
        self.client.delete(f'/api/catalog/categories/{self.category.pk}/')
        self.assertFalse(CatalogItemImage.objects.exists())
        self.assertFalse(os.path.exists(image_path))

    def test_image_reorder(self):
        a = CatalogItemImage.objects.get(pk=self.upload().data['id'])
        b = CatalogItemImage.objects.get(pk=self.upload().data['id'])
        res = self.client.post(f'/api/catalog/items/{self.item.pk}/images/reorder/',
                               {'order': [b.pk, a.pk]}, format='json')
        self.assertEqual(res.status_code, 200)
        a.refresh_from_db()
        b.refresh_from_db()
        self.assertLess(b.order, a.order)

    def test_banner_upload_and_remove(self):
        res = self.client.patch(f'/api/catalogs/{self.catalog.pk}/',
                                {'banner_upload': png_upload(size=(2500, 900))},
                                format='multipart')
        self.assertEqual(res.status_code, 200)
        self.catalog.refresh_from_db()
        banner_path = self.catalog.banner.path
        with Image.open(banner_path) as banner:
            self.assertLessEqual(max(banner.size), 1920)
        res = self.client.patch(f'/api/catalogs/{self.catalog.pk}/',
                                {'banner_remove': True}, format='json')
        self.assertEqual(res.status_code, 200)
        self.catalog.refresh_from_db()
        self.assertFalse(self.catalog.banner)
        self.assertFalse(os.path.exists(banner_path))


@override_settings(CACHES=LOCMEM, MEDIA_ROOT=TMP_MEDIA)
class PublicCatalogTests(CatalogTestCase):
    def setUp(self):
        super().setUp()
        self.grant()
        self.business = Business.objects.create(owner=self.user, path='osh', name='Osh Markazi')
        self.catalog = Catalog.objects.create(owner=self.user, name='Menyu',
                                              business=self.business, button_label='Menyu')
        self.category = CatalogCategory.objects.create(catalog=self.catalog, name='Taomlar', order=1)
        self.item = CatalogItem.objects.create(category=self.category, name='Osh',
                                               description='Choyxona osh', price=25000, order=1)
        self.anon = APIClient()

    def test_public_payload(self):
        CatalogCategory.objects.create(catalog=self.catalog, name="Bo'sh", order=2)
        res = self.anon.get('/api/public/osh/catalog/')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data['name'], 'Menyu')
        self.assertEqual(res.data['button_label'], 'Menyu')
        self.assertEqual(res.data['currency'], "so'm")
        # Appearance drives the public page's theme.
        self.assertEqual(res.data['theme'], 'mylink')
        self.assertEqual(res.data['theme_mode'], 'dark')
        self.assertEqual(res.data['card_style'], 'grid')
        self.assertEqual(res.data['business']['path'], 'osh')
        self.assertEqual(res.data['business']['name'], 'Osh Markazi')
        # Empty categories are filtered out.
        self.assertEqual(len(res.data['categories']), 1)
        item = res.data['categories'][0]['items'][0]
        self.assertEqual(item['name'], 'Osh')
        self.assertEqual(item['price'], 25000)
        self.assertTrue(item['is_available'])

    def test_inactive_catalog_404(self):
        Catalog.objects.filter(pk=self.catalog.pk).update(is_active=False)
        self.assertEqual(self.anon.get('/api/public/osh/catalog/').status_code, 404)

    def test_business_without_catalog_404(self):
        Business.objects.create(owner=self.user, path='ikkinchi', name='B')
        self.assertEqual(self.anon.get('/api/public/ikkinchi/catalog/').status_code, 404)

    def test_locked_business_404(self):
        Business.objects.filter(pk=self.business.pk).update(is_locked=True)
        self.assertEqual(self.anon.get('/api/public/osh/catalog/').status_code, 404)

    def test_free_owner_404(self):
        Subscription.objects.all().delete()
        self.assertEqual(self.anon.get('/api/public/osh/catalog/').status_code, 404)

    def test_expired_pro_404(self):
        Subscription.objects.all().update(expires_at=timezone.now() - timedelta(days=1))
        self.assertEqual(self.anon.get('/api/public/osh/catalog/').status_code, 404)

    def test_has_catalog_in_public_business_payload(self):
        res = self.anon.get('/api/public/osh/')
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data['has_catalog'])
        self.assertEqual(res.data['catalog_label'], 'Menyu')
        # Expired Pro hides the button too.
        Subscription.objects.all().update(expires_at=timezone.now() - timedelta(days=1))
        res = self.anon.get('/api/public/osh/')
        self.assertFalse(res.data['has_catalog'])
        self.assertIsNone(res.data['catalog_label'])

    def test_empty_button_label_returns_null(self):
        Catalog.objects.filter(pk=self.catalog.pk).update(button_label='')
        res = self.anon.get('/api/public/osh/')
        self.assertTrue(res.data['has_catalog'])
        self.assertIsNone(res.data['catalog_label'])


@override_settings(CACHES=LOCMEM)
class MenuQrTests(CatalogTestCase):
    def setUp(self):
        super().setUp()
        self.business = Business.objects.create(owner=self.user, path='osh', name='Osh')
        self.catalog = Catalog.objects.create(owner=self.user, name='Menyu',
                                              business=self.business)

    def test_free_denied(self):
        res = self.client.get(f'/api/catalogs/{self.catalog.pk}/qr.png')
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.data['reason'], 'catalog')

    def test_pro_gets_png(self):
        self.grant()
        res = self.client.get(f'/api/catalogs/{self.catalog.pk}/qr.png')
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res['Content-Type'], 'image/png')
        self.assertIn('osh-menu-qr.png', res['Content-Disposition'])
        self.assertEqual(res.content[:8], b'\x89PNG\r\n\x1a\n')

    def test_unattached_rejected(self):
        self.grant()
        Catalog.objects.filter(pk=self.catalog.pk).update(business=None)
        res = self.client.get(f'/api/catalogs/{self.catalog.pk}/qr.png')
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.data['reason'], 'not_attached')

    def test_stranger_404(self):
        self.grant()
        other, other_client = self.make_other_user()
        res = other_client.get(f'/api/catalogs/{self.catalog.pk}/qr.png')
        self.assertEqual(res.status_code, 404)
