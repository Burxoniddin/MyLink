from rest_framework import serializers
from .models import Business, Link, ContentBlock, ContactMessage, StaticPage, BlogPost

class LinkSerializer(serializers.ModelSerializer):
    # Use CharField instead of URLField to allow tel: and mailto: links
    url = serializers.CharField(max_length=500)

    class Meta:
        model = Link
        fields = ['id', 'title', 'url', 'icon_type', 'order']


class ContentBlockSerializer(serializers.ModelSerializer):
    MAX_VIDEO_BYTES = 50 * 1024 * 1024  # 50 MB

    class Meta:
        model = ContentBlock
        fields = ['id', 'block_type', 'order', 'title', 'text', 'image', 'video', 'embed_url']
        read_only_fields = ['order']

    def validate(self, attrs):
        video = attrs.get('video')
        if video and video.size > self.MAX_VIDEO_BYTES:
            raise serializers.ValidationError({'reason': 'video_too_large'})
        return attrs

class BusinessSerializer(serializers.ModelSerializer):
    links = LinkSerializer(many=True, required=False)
    logo = serializers.SerializerMethodField()
    logo_upload = serializers.ImageField(write_only=True, required=False, source='logo')
    logo_remove = serializers.BooleanField(write_only=True, required=False, default=False)
    branding_removed = serializers.SerializerMethodField()
    verified = serializers.SerializerMethodField()
    content_blocks = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = ['id', 'path', 'name', 'description', 'logo', 'logo_upload', 'logo_remove',
                  'template', 'is_locked', 'is_pinned', 'branding_removed', 'verified',
                  'created_at', 'links', 'content_blocks']
        read_only_fields = ['is_locked', 'is_pinned']

    def get_content_blocks(self, obj):
        return ContentBlockSerializer(obj.content_blocks.all(), many=True, context=self.context).data

    def _owner_features(self, obj):
        """Owner tier features, cached per-request so a dashboard list doesn't
        recompute the tier for every business of the same owner."""
        cache = self.context.setdefault('_owner_features', {}) if isinstance(self.context, dict) else None
        if cache is not None and obj.owner_id in cache:
            return cache[obj.owner_id]
        from billing.services import effective_tier
        from billing import entitlements as ent
        feats = ent.features_for(effective_tier(obj.owner))
        if cache is not None:
            cache[obj.owner_id] = feats
        return feats

    def get_branding_removed(self, obj):
        return bool(self._owner_features(obj)['branding_removed'])

    def get_verified(self, obj):
        return bool(self._owner_features(obj)['verified_badge'])

    def get_logo(self, obj):
        """Return absolute URL for logo"""
        if obj.logo:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.url)
            return obj.logo.url
        return None
        
    def create(self, validated_data):
        validated_data.pop('logo_remove', None)  # logo_remove create-da kerak emas
        links_data = validated_data.pop('links', [])
        user = self.context['request'].user
        business = Business.objects.create(owner=user, **validated_data)
        for link_data in links_data:
            Link.objects.create(business=business, **link_data)
        return business

    def update(self, instance, validated_data):
        links_data = validated_data.pop('links', None)
        logo_remove = validated_data.pop('logo_remove', False)
        
        instance.path = validated_data.get('path', instance.path)
        instance.name = validated_data.get('name', instance.name)
        instance.description = validated_data.get('description', instance.description)
        instance.template = validated_data.get('template', instance.template)

        # Logo o'chirish yoki yangilash
        if logo_remove:
            # Eski logo faylini o'chirish
            if instance.logo:
                instance.logo.delete(save=False)
            instance.logo = None
        elif 'logo' in validated_data:
            instance.logo = validated_data.get('logo')
        
        instance.save()
        
        if links_data is not None:
            # Simple strategy: delete old links and create new ones, or update existing.
            # For simplicity in "Save" action, wiping and recreating is easiest but loses IDs.
            # Better: Update if ID present, create if not.
            # But "links" in validated_data won't have IDs if validation stripped them or if they are just data.
            # Let's delete all and recreate for "save" functionality unless we want to keep stats etc.
            instance.links.all().delete()
            for link_data in links_data:
                Link.objects.create(business=instance, **link_data)

        return instance


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['name', 'contact', 'message']


class StaticPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = StaticPage
        fields = ['slug', 'language', 'title', 'body', 'updated_at']


class BlogPostListSerializer(serializers.ModelSerializer):
    cover = serializers.SerializerMethodField()

    class Meta:
        model = BlogPost
        fields = ['slug', 'language', 'title', 'excerpt', 'cover', 'published_at']

    def get_cover(self, obj):
        if obj.cover:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.cover.url) if request else obj.cover.url
        return None


class BlogPostDetailSerializer(BlogPostListSerializer):
    class Meta(BlogPostListSerializer.Meta):
        fields = BlogPostListSerializer.Meta.fields + ['body']
