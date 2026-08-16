import re

from rest_framework import serializers
from .models import (
    MAX_BIO_WORDS,
    Business, Link, ContentBlock, MediaSection, BusinessMembership,
    ContactMessage, NfcOrder, StaticPage, BlogPost,
)


def user_display(user):
    """Short human label for a team member (no PII beyond their own identifier)."""
    if not user:
        return ''
    return user.email or user.phone_number or f'user#{user.pk}'

class LinkSerializer(serializers.ModelSerializer):
    # Use CharField instead of URLField to allow tel: and mailto: links
    url = serializers.CharField(max_length=500)

    class Meta:
        model = Link
        fields = ['id', 'title', 'url', 'icon_type', 'order']


class ContentBlockSerializer(serializers.ModelSerializer):
    MAX_VIDEO_BYTES = 50 * 1024 * 1024  # 50 MB

    # Ownership of the section (it must belong to the same business) is
    # validated in the create view, which also enforces the per-section cap.
    section = serializers.PrimaryKeyRelatedField(
        queryset=MediaSection.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = ContentBlock
        fields = ['id', 'block_type', 'section', 'order', 'title', 'text', 'image', 'video', 'embed_url']
        read_only_fields = ['order']

    def validate(self, attrs):
        video = attrs.get('video')
        if video and video.size > self.MAX_VIDEO_BYTES:
            raise serializers.ValidationError({'reason': 'video_too_large'})
        return attrs


class MediaSectionSerializer(serializers.ModelSerializer):
    cover = serializers.SerializerMethodField()
    cover_upload = serializers.ImageField(write_only=True, required=False, source='cover')
    blocks = ContentBlockSerializer(many=True, read_only=True)

    class Meta:
        model = MediaSection
        fields = ['id', 'name', 'cover', 'cover_upload', 'order', 'blocks']
        read_only_fields = ['order']

    def get_cover(self, obj):
        if obj.cover:
            request = self.context.get('request')
            return request.build_absolute_uri(obj.cover.url) if request else obj.cover.url
        return None

class BusinessSerializer(serializers.ModelSerializer):
    links = LinkSerializer(many=True, required=False)
    logo = serializers.SerializerMethodField()
    logo_upload = serializers.ImageField(write_only=True, required=False, source='logo')
    logo_remove = serializers.BooleanField(write_only=True, required=False, default=False)
    branding_removed = serializers.SerializerMethodField()
    verified = serializers.SerializerMethodField()
    media_sections = serializers.SerializerMethodField()
    # MyCatalog: whether an attached, active, tier-enabled web-menu exists, and
    # the owner-chosen button label for it (public page renders the button).
    has_catalog = serializers.SerializerMethodField()
    catalog_label = serializers.SerializerMethodField()
    # Requesting user's role on this page ('owner' | admin | editor | viewer).
    role = serializers.SerializerMethodField()
    # Owner label, shown on the dashboard for pages shared *with* you.
    owner_name = serializers.SerializerMethodField()

    class Meta:
        model = Business
        fields = ['id', 'path', 'name', 'description', 'logo', 'logo_upload', 'logo_remove',
                  'template', 'theme', 'theme_mode', 'is_locked', 'is_pinned', 'branding_removed', 'verified',
                  'has_catalog', 'catalog_label',
                  'role', 'owner_name', 'created_at', 'links', 'media_sections']
        read_only_fields = ['is_locked', 'is_pinned']

    def validate(self, attrs):
        # Bio cap, counted in words — same number the editor's counter shows.
        description = attrs.get('description') or ''
        if len(description.split()) > MAX_BIO_WORDS:
            raise serializers.ValidationError({'reason': 'bio_too_long', 'limit': MAX_BIO_WORDS})
        return attrs

    def get_role(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user:
            return None
        from .access import role_for
        return role_for(user, obj)

    def get_owner_name(self, obj):
        # Only exposed to authenticated users who have access (owner / team member);
        # never on the public page endpoint (would leak the owner's email/phone).
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not getattr(user, 'is_authenticated', False):
            return None
        from .access import role_for
        return user_display(obj.owner) if role_for(user, obj) else None

    def get_media_sections(self, obj):
        # Sections with at least one block — empty sections only matter in the
        # editor, which uses the dedicated /sections/ endpoint.
        qs = obj.media_sections.prefetch_related('blocks')
        data = MediaSectionSerializer(qs, many=True, context=self.context).data
        return [s for s in data if s['blocks']]

    def get_has_catalog(self, obj):
        # Attach flow guarantees catalog.owner == business.owner, so the
        # memoized owner features double as the catalog gate here.
        catalog = getattr(obj, 'catalog', None)  # reverse OneToOne, AttributeError-safe
        if catalog is None or not catalog.is_active:
            return False
        return bool(self._owner_features(obj).get('catalog'))

    def get_catalog_label(self, obj):
        if not self.get_has_catalog(obj):
            return None
        return obj.catalog.button_label or None

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
        # Yangi sahifada ham shablon gate qilinadi — ruxsatdan tashqarisi default
        # 'classic' ga tushadi (update'dagi kabi jimgina).
        template = validated_data.get('template')
        if template and template != 'classic':
            from billing.services import get_entitlements
            allowed = int(get_entitlements(user)['features'].get('templates') or 1)
            if template not in [key for key, _ in Business.TEMPLATE_CHOICES][:allowed]:
                validated_data.pop('template')
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
        # Shablon tanlash tarifga bog'liq: features['templates'] = TEMPLATE_CHOICES
        # tartibida boshidan nechta shablon ochiqligi (Free 1 → faqat classic).
        # color_edit kabi jimgina e'tiborsiz qoladi; gate sahifa EGASI tarifiga qaraydi.
        new_template = validated_data.get('template')
        if new_template is not None and new_template != instance.template:
            from billing.services import get_entitlements
            allowed = int(get_entitlements(instance.owner)['features'].get('templates') or 1)
            if new_template in [key for key, _ in Business.TEMPLATE_CHOICES][:allowed]:
                instance.template = new_template
        # Dark/light mode is part of the template choice — ungated like template.
        instance.theme_mode = validated_data.get('theme_mode', instance.theme_mode)

        # Colour palette change is gated by the color_edit feature (Oddiy/Pro).
        new_theme = validated_data.get('theme')
        if new_theme is not None and new_theme != instance.theme:
            # Colour editing follows the page owner's tier, not the editing member's.
            from billing.services import get_entitlements
            if get_entitlements(instance.owner)['features']['color_edit']:
                instance.theme = new_theme

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


class MembershipSerializer(serializers.ModelSerializer):
    """A team member (or pending invite) as shown in the Team panel."""
    display = serializers.SerializerMethodField()
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    status = serializers.SerializerMethodField()

    class Meta:
        model = BusinessMembership
        fields = ['id', 'display', 'role', 'role_display', 'status', 'created_at']

    def get_display(self, obj):
        return user_display(obj.user) if obj.user_id else (obj.invite_email or obj.invite_phone)

    def get_status(self, obj):
        return 'pending' if obj.is_pending else 'active'


class MembershipInviteSerializer(serializers.Serializer):
    """Invite payload: an email/phone identifier + a role to grant."""
    identifier = serializers.CharField()
    role = serializers.ChoiceField(choices=[r[0] for r in BusinessMembership.ROLES])


class MembershipRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=[r[0] for r in BusinessMembership.ROLES])


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = ['name', 'phone', 'contact', 'message']

    def validate(self, attrs):
        # Email/telegram yoki telefon — kamida bittasi to'ldirilishi shart.
        if not (attrs.get('phone') or '').strip() and not (attrs.get('contact') or '').strip():
            raise serializers.ValidationError({'reason': 'contact_required'})
        return attrs


class NfcOrderSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    business_name = serializers.CharField(source='business.name', read_only=True, default=None)

    class Meta:
        model = NfcOrder
        fields = ['id', 'full_name', 'phone', 'quantity', 'note',
                  'business', 'business_name', 'status', 'status_display', 'created_at']
        read_only_fields = ['status', 'status_display', 'created_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # The optional business can only be one the requester owns.
        request = self.context.get('request')
        if request and getattr(request.user, 'is_authenticated', False):
            self.fields['business'].queryset = Business.objects.filter(owner=request.user)
        self.fields['business'].required = False
        self.fields['business'].allow_null = True

    def validate_phone(self, value):
        # Normalise to +998XXXXXXXXX; accept a 9-digit local number or a 12-digit
        # 998-prefixed one (spaces/dashes/parens allowed in input).
        digits = re.sub(r'\D', '', value or '')
        if len(digits) == 12 and digits.startswith('998'):
            return '+' + digits
        if len(digits) == 9:
            return '+998' + digits
        raise serializers.ValidationError(
            "Telefon raqamini to'g'ri kiriting, masalan: +998 90 123 45 67"
        )

    def validate_quantity(self, value):
        if value < 1 or value > 1000:
            raise serializers.ValidationError('1–1000 oralig\'ida bo\'lishi kerak')
        return value


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
