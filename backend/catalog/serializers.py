from rest_framework import serializers

from businesses.models import Business
from .images import InvalidImage, MAX_IMAGE_BYTES, make_thumb, process_banner, process_image
from .models import Catalog, CatalogCategory, CatalogItem, CatalogItemImage


class AbsoluteFileMixin:
    def _abs(self, field_file):
        if not field_file:
            return None
        request = self.context.get('request')
        return request.build_absolute_uri(field_file.url) if request else field_file.url


class CatalogItemImageSerializer(AbsoluteFileMixin, serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    thumb = serializers.SerializerMethodField()
    image_upload = serializers.ImageField(write_only=True, required=True, source='image')

    class Meta:
        model = CatalogItemImage
        fields = ['id', 'image', 'thumb', 'image_upload', 'order']
        read_only_fields = ['order']

    def get_image(self, obj):
        return self._abs(obj.image)

    def get_thumb(self, obj):
        return self._abs(obj.thumb)

    def validate_image_upload(self, f):
        if f.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError({'reason': 'image_too_large'})
        return f

    def create(self, validated_data):
        raw = validated_data.pop('image')
        try:
            validated_data['image'] = process_image(raw)
            validated_data['thumb'] = make_thumb(raw)
        except InvalidImage:
            raise serializers.ValidationError({'reason': 'invalid_image'})
        return super().create(validated_data)


class CatalogItemSerializer(serializers.ModelSerializer):
    images = CatalogItemImageSerializer(many=True, read_only=True)
    # Ownership of the category (it must belong to the same catalog) is
    # validated in the views, which also enforce the per-category cap.
    category = serializers.PrimaryKeyRelatedField(queryset=CatalogCategory.objects.all())

    class Meta:
        model = CatalogItem
        fields = ['id', 'category', 'name', 'description', 'price', 'old_price',
                  'is_available', 'order', 'images']
        read_only_fields = ['order']


class CatalogCategorySerializer(serializers.ModelSerializer):
    items = CatalogItemSerializer(many=True, read_only=True)

    class Meta:
        model = CatalogCategory
        fields = ['id', 'name', 'order', 'items']
        read_only_fields = ['order']


class CatalogSerializer(AbsoluteFileMixin, serializers.ModelSerializer):
    banner = serializers.SerializerMethodField()
    banner_upload = serializers.ImageField(write_only=True, required=False, source='banner')
    banner_remove = serializers.BooleanField(write_only=True, required=False, default=False)
    # Attach/detach target; must be one of the requesting user's own businesses —
    # validated in the views (not_your_business / business_has_catalog).
    business = serializers.PrimaryKeyRelatedField(
        queryset=Business.objects.all(), required=False, allow_null=True,
    )
    business_path = serializers.SlugField(source='business.path', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    categories = CatalogCategorySerializer(many=True, read_only=True)

    class Meta:
        model = Catalog
        fields = ['id', 'name', 'business', 'business_path', 'business_name',
                  'button_label', 'banner', 'banner_upload', 'banner_remove',
                  'currency', 'theme', 'theme_mode', 'card_style',
                  'cart_enabled', 'order_enabled', 'order_link', 'order_label',
                  'is_active', 'categories', 'created_at']

    def get_banner(self, obj):
        return self._abs(obj.banner)

    def validate_banner_upload(self, f):
        if f.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError({'reason': 'image_too_large'})
        return f

    def _processed_banner(self, raw):
        try:
            return process_banner(raw)
        except InvalidImage:
            raise serializers.ValidationError({'reason': 'invalid_image'})

    def create(self, validated_data):
        validated_data.pop('banner_remove', False)
        raw = validated_data.pop('banner', None)
        if raw is not None:
            validated_data['banner'] = self._processed_banner(raw)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        banner_remove = validated_data.pop('banner_remove', False)
        raw = validated_data.pop('banner', None)
        if banner_remove and instance.banner:
            instance.banner.delete(save=False)
            instance.banner = None
        if raw is not None:
            processed = self._processed_banner(raw)
            if instance.banner:
                instance.banner.delete(save=False)
            instance.banner = processed
        return super().update(instance, validated_data)


class CatalogListSerializer(AbsoluteFileMixin, serializers.ModelSerializer):
    """Light card payload for the "Kataloglarim" list page."""
    banner = serializers.SerializerMethodField()
    business_path = serializers.SlugField(source='business.path', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True)
    categories_count = serializers.IntegerField(read_only=True)
    items_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Catalog
        fields = ['id', 'name', 'business', 'business_path', 'business_name',
                  'button_label', 'banner', 'currency', 'theme', 'theme_mode',
                  'card_style', 'is_active',
                  'categories_count', 'items_count', 'created_at']
        read_only_fields = fields

    def get_banner(self, obj):
        return self._abs(obj.banner)
