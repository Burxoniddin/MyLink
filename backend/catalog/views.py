from django.conf import settings
from django.db.models import Count, Max
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from billing import entitlements as ent
from billing.services import effective_tier, get_entitlements
from businesses import qr
from businesses.models import Business
from .models import (
    MAX_CATEGORIES_PER_CATALOG, MAX_IMAGES_PER_ITEM, MAX_ITEMS_PER_CATEGORY,
    Catalog, CatalogCategory, CatalogItem, CatalogItemImage,
)
from .serializers import (
    CatalogCategorySerializer, CatalogItemImageSerializer, CatalogItemSerializer,
    CatalogListSerializer, CatalogSerializer,
)


def require_catalog_feature(user):
    """Writes are gated by the ``catalog`` flag on the user's own tier (the
    catalog owner is also the payer). Reads stay open so a downgraded owner can
    still see their retained data behind the frontend upsell."""
    if not get_entitlements(user)['features'].get('catalog'):
        raise PermissionDenied({'reason': 'catalog'})


def check_attach_business(user, business, current_pk=None):
    """A catalog may only be attached to a business the user OWNS (the tier is
    the owner's), and a business holds at most one catalog."""
    if business is None:
        return
    if business.owner_id != user.id:
        raise PermissionDenied({'reason': 'not_your_business'})
    if Catalog.objects.filter(business=business).exclude(pk=current_pk).exists():
        raise ValidationError({'reason': 'business_has_catalog'})


class CatalogListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return CatalogSerializer if self.request.method == 'POST' else CatalogListSerializer

    def get_queryset(self):
        return (Catalog.objects.filter(owner=self.request.user)
                .select_related('business')
                .annotate(categories_count=Count('categories', distinct=True),
                          items_count=Count('categories__items', distinct=True)))

    def perform_create(self, serializer):
        require_catalog_feature(self.request.user)
        check_attach_business(self.request.user, serializer.validated_data.get('business'))
        serializer.save(owner=self.request.user)


class CatalogDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CatalogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return get_object_or_404(
            Catalog.objects.select_related('business')
            .prefetch_related('categories__items__images'),
            pk=self.kwargs['pk'], owner=self.request.user,
        )

    def perform_update(self, serializer):
        require_catalog_feature(self.request.user)
        if 'business' in serializer.validated_data:
            check_attach_business(self.request.user, serializer.validated_data['business'],
                                  current_pk=serializer.instance.pk)
        serializer.save()

    # Deleting own data stays allowed even after a downgrade (cleanup).


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CatalogCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def _catalog(self):
        return get_object_or_404(Catalog, pk=self.kwargs['pk'], owner=self.request.user)

    def get_queryset(self):
        return (CatalogCategory.objects.filter(catalog=self._catalog())
                .prefetch_related('items__images'))

    def perform_create(self, serializer):
        catalog = self._catalog()
        require_catalog_feature(self.request.user)
        if catalog.categories.count() >= MAX_CATEGORIES_PER_CATALOG:
            raise PermissionDenied({'reason': 'category_limit', 'limit': MAX_CATEGORIES_PER_CATALOG})
        last = catalog.categories.aggregate(m=Max('order'))['m'] or 0
        serializer.save(catalog=catalog, order=last + 1)


class CategoryReorderView(APIView):
    """Persist a new category order: body ``{"order": [id, id, ...]}``."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        catalog = get_object_or_404(Catalog, pk=pk, owner=request.user)
        for index, cid in enumerate(request.data.get('order', [])):
            CatalogCategory.objects.filter(id=cid, catalog=catalog).update(order=index)
        return Response({'ok': True})


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CatalogCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return get_object_or_404(CatalogCategory, pk=self.kwargs['pk'],
                                 catalog__owner=self.request.user)

    def perform_update(self, serializer):
        require_catalog_feature(self.request.user)
        serializer.save()


class ItemCreateView(generics.CreateAPIView):
    serializer_class = CatalogItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        catalog = get_object_or_404(Catalog, pk=self.kwargs['pk'], owner=self.request.user)
        require_catalog_feature(self.request.user)
        category = serializer.validated_data.get('category')
        if category is None or category.catalog_id != catalog.id:
            raise ValidationError({'reason': 'invalid_category'})
        if category.items.count() >= MAX_ITEMS_PER_CATEGORY:
            raise PermissionDenied({'reason': 'item_limit', 'limit': MAX_ITEMS_PER_CATEGORY})
        last = category.items.aggregate(m=Max('order'))['m'] or 0
        serializer.save(order=last + 1)


class ItemReorderView(APIView):
    """Persist a new item order within the catalog: body ``{"order": [id, ...]}``."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        catalog = get_object_or_404(Catalog, pk=pk, owner=request.user)
        for index, iid in enumerate(request.data.get('order', [])):
            CatalogItem.objects.filter(id=iid, category__catalog=catalog).update(order=index)
        return Response({'ok': True})


class ItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CatalogItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return get_object_or_404(CatalogItem, pk=self.kwargs['pk'],
                                 category__catalog__owner=self.request.user)

    def perform_update(self, serializer):
        require_catalog_feature(self.request.user)
        item = serializer.instance
        category = serializer.validated_data.get('category')
        if category is not None and category.pk != item.category_id:
            # Moving between categories: stay inside the same catalog, respect the cap.
            if category.catalog_id != item.category.catalog_id:
                raise ValidationError({'reason': 'invalid_category'})
            if category.items.count() >= MAX_ITEMS_PER_CATEGORY:
                raise PermissionDenied({'reason': 'item_limit', 'limit': MAX_ITEMS_PER_CATEGORY})
        serializer.save()


class ItemImageCreateView(generics.CreateAPIView):
    """Single-POST multipart upload (field ``image_upload``); the frontend loops
    files client-side. Processing/thumbnail happens in the serializer."""
    serializer_class = CatalogItemImageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        item = get_object_or_404(CatalogItem, pk=self.kwargs['pk'],
                                 category__catalog__owner=self.request.user)
        require_catalog_feature(self.request.user)
        if item.images.count() >= MAX_IMAGES_PER_ITEM:
            raise PermissionDenied({'reason': 'image_limit', 'limit': MAX_IMAGES_PER_ITEM})
        last = item.images.aggregate(m=Max('order'))['m'] or 0
        serializer.save(item=item, order=last + 1)


class ItemImageReorderView(APIView):
    """Persist a new image order for one item: body ``{"order": [id, ...]}``."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        item = get_object_or_404(CatalogItem, pk=pk,
                                 category__catalog__owner=request.user)
        for index, img_id in enumerate(request.data.get('order', [])):
            CatalogItemImage.objects.filter(id=img_id, item=item).update(order=index)
        return Response({'ok': True})


class ItemImageDeleteView(generics.DestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return get_object_or_404(CatalogItemImage, pk=self.kwargs['pk'],
                                 item__category__catalog__owner=self.request.user)


class CatalogQrView(APIView):
    """Download a QR PNG pointing at the public menu URL. Gated by the
    ``catalog`` feature (not the ``qr`` level — the menu QR is part of the
    catalog deliverable, and a table QR is the primary use case). Needs an
    attached business, since the menu URL comes from the business path."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        catalog = get_object_or_404(Catalog.objects.select_related('business'),
                                    pk=pk, owner=request.user)
        require_catalog_feature(request.user)
        if catalog.business is None:
            raise ValidationError({'reason': 'not_attached'})
        url = f"{settings.FRONTEND_URL.rstrip('/')}/{catalog.business.path}/menu"
        resp = HttpResponse(qr.qr_png_bytes(url), content_type='image/png')
        resp['Content-Disposition'] = (
            f'attachment; filename="{catalog.business.path}-menu-qr.png"')
        return resp


class PublicCatalogView(APIView):
    """The public web-menu payload for ``/<business-path>/menu``.

    Always 404 (never 403 — tier state isn't leaked) unless the business is
    publicly visible, has an attached active catalog, and the catalog owner's
    tier still includes the ``catalog`` feature. So an expired Pro instantly
    hides the menu; the data is retained and reappears on renewal."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, path):
        business = get_object_or_404(Business, path=path, is_locked=False)
        catalog = getattr(business, 'catalog', None)  # reverse OneToOne; AttributeError-safe
        if catalog is None or not catalog.is_active:
            raise Http404
        if not ent.features_for(effective_tier(catalog.owner)).get('catalog'):
            raise Http404

        from .serializers import CatalogCategorySerializer
        categories = (catalog.categories.prefetch_related('items__images'))
        cat_data = CatalogCategorySerializer(categories, many=True,
                                             context={'request': request}).data
        logo = request.build_absolute_uri(business.logo.url) if business.logo else None
        banner = request.build_absolute_uri(catalog.banner.url) if catalog.banner else None
        verified = bool(ent.features_for(effective_tier(business.owner)).get('verified_badge'))
        return Response({
            'name': catalog.name,
            'button_label': catalog.button_label,
            'banner': banner,
            'currency': catalog.currency,
            'theme': catalog.theme,
            'theme_mode': catalog.theme_mode,
            'card_style': catalog.card_style,
            'cart_enabled': catalog.cart_enabled,
            # None when the button is off or the link is unusable — the menu
            # then simply doesn't render an order CTA.
            'order': catalog.order_target(),
            'order_label': catalog.order_label,
            'business': {'name': business.name, 'path': business.path,
                         'description': business.description,
                         'logo': logo, 'verified': verified},
            'categories': [c for c in cat_data if c['items']],
        })
