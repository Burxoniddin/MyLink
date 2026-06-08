from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from billing.services import can_create_business, get_entitlements, sync_locks
from .models import Business, Link, SiteSettings, ContactMessage, StaticPage, BlogPost
from .serializers import (
    BusinessSerializer,
    ContactMessageSerializer,
    StaticPageSerializer,
    BlogPostListSerializer,
    BlogPostDetailSerializer,
)
from .utils import send_telegram_message

User = get_user_model()

class IsOwner(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.owner == request.user

class BusinessListCreateView(generics.ListCreateAPIView):
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Re-enforce locks on dashboard load so a downgrade takes effect even if
        # the user never hit the toggle endpoint.
        sync_locks(self.request.user)
        # Pinned ("starred") pages first, then newest.
        return Business.objects.filter(owner=self.request.user).order_by('-is_pinned', '-created_at')

    def perform_create(self, serializer):
        if not can_create_business(self.request.user):
            limit = get_entitlements(self.request.user)['features']['profile_limit']
            raise PermissionDenied({'reason': 'profile_limit', 'limit': limit})
        serializer.save()

class BusinessDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Lookup by path or id? Usually ID for editing, PATH for public.
    # User can change path, so ID is safer for editing dashboard.
    queryset = Business.objects.all()
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwner]
    lookup_field = 'path' # Or 'pk' if frontend prefers. Let's use path for consistency with user request, but PK is better if path changes.
    # Let's support PK for editing to avoid issues if path updates. 
    # Actually, let's stick to 'path' but be careful. If path changes, URL changes.
    
    def get_queryset(self):
        return Business.objects.filter(owner=self.request.user)

class PublicBusinessView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, path):
        # Locked pages (owner over their tier limit) are hidden from the public.
        business = get_object_or_404(Business, path=path, is_locked=False)
        serializer = BusinessSerializer(business, context={'request': request})
        return Response(serializer.data)


class BusinessToggleLockView(APIView):
    """Owner activates/deactivates one of their businesses. Activating
    (``is_locked=false``) is rejected when it would exceed the tier limit — the
    owner must lock another first."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, path):
        business = get_object_or_404(Business, path=path, owner=request.user)
        is_locked = bool(request.data.get('is_locked'))
        if not is_locked and business.is_locked:
            # Trying to activate — check we're within limit.
            feats = get_entitlements(request.user)['features']
            active = Business.objects.filter(owner=request.user, is_locked=False).count()
            if active >= feats['profile_limit']:
                raise PermissionDenied({'reason': 'profile_limit', 'limit': feats['profile_limit']})
        business.is_locked = is_locked
        business.save(update_fields=['is_locked'])
        return Response({'path': business.path, 'is_locked': business.is_locked})


class BusinessTogglePinView(APIView):
    """Owner pins/unpins one of their businesses to float it to the top of the
    dashboard. No tier gate — pinning is purely a display preference."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, path):
        business = get_object_or_404(Business, path=path, owner=request.user)
        business.is_pinned = bool(request.data.get('is_pinned'))
        business.save(update_fields=['is_pinned'])
        return Response({'path': business.path, 'is_pinned': business.is_pinned})


class PublicStatsView(APIView):
    """Public platform stats for the marketing landing page."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        return Response({
            'businesses': Business.objects.count(),
            'links': Link.objects.count(),
            'users': User.objects.count(),
        })


class PublicSettingsView(APIView):
    """Public, admin-editable contact/support info for the landing + Help button."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        s = SiteSettings.get_settings()
        return Response({
            'site_name': s.site_name,
            'contact_email': s.contact_email,
            'contact_phone': s.contact_phone,
            'contact_telegram': s.contact_telegram,
            'support_telegram_url': s.support_telegram_url,
        })


class ContactRateThrottle(AnonRateThrottle):
    scope = 'contact'
    rate = '15/hour'


class ContactCreateView(APIView):
    """Landing contact form -> save + forward to Telegram group."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ContactRateThrottle]

    def post(self, request):
        serializer = ContactMessageSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        msg = serializer.save()
        text = (
            "\U0001F4E9 <b>Yangi aloqa xabari</b>\n"
            f"<b>Ism:</b> {msg.name}\n"
            f"<b>Aloqa:</b> {msg.contact}\n"
            f"<b>Xabar:</b> {msg.message}"
        )
        send_telegram_message(text)
        return Response({"message": "ok"}, status=status.HTTP_201_CREATED)


class StaticPageView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        lang = request.query_params.get('lang', 'uz')
        page = StaticPage.objects.filter(slug=slug, language=lang).first()
        if page is None:
            page = StaticPage.objects.filter(slug=slug).first()  # fallback to any language
        if page is None:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(StaticPageSerializer(page).data)


class BlogListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        lang = request.query_params.get('lang', 'uz')
        qs = BlogPost.objects.filter(is_published=True, language=lang)
        if not qs.exists():
            qs = BlogPost.objects.filter(is_published=True)
        return Response(BlogPostListSerializer(qs, many=True, context={'request': request}).data)


class BlogDetailView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        lang = request.query_params.get('lang', 'uz')
        post = BlogPost.objects.filter(slug=slug, language=lang, is_published=True).first()
        if post is None:
            post = BlogPost.objects.filter(slug=slug, is_published=True).first()
        if post is None:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(BlogPostDetailSerializer(post, context={'request': request}).data)
