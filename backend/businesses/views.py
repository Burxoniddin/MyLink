from datetime import timedelta

from rest_framework import generics, permissions, status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Max
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.crypto import get_random_string
from billing.services import can_create_business, get_entitlements, sync_locks
from . import emails, qr
from .access import (
    ROLE_ADMIN, ROLE_EDITOR, ROLE_VIEWER,
    accessible_businesses, claim_pending_invites, get_business_or_404, require_role,
)
from .models import (
    MAX_BLOCKS_PER_SECTION,
    Business, Link, ContentBlock, MediaSection, BusinessMembership, Event,
    SiteSettings, ContactMessage, NfcOrder, StaticPage, BlogPost,
)
from .serializers import (
    BusinessSerializer,
    ContentBlockSerializer,
    MediaSectionSerializer,
    MembershipSerializer,
    MembershipInviteSerializer,
    MembershipRoleSerializer,
    ContactMessageSerializer,
    NfcOrderSerializer,
    StaticPageSerializer,
    BlogPostListSerializer,
    BlogPostDetailSerializer,
    user_display,
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
        # Owned + shared-with-me pages; pinned ("starred") first, then newest.
        return accessible_businesses(self.request.user).order_by('-is_pinned', '-created_at')

    def perform_create(self, serializer):
        # Creation is never blocked: any tier may own unlimited pages. The tier
        # limit caps *active* pages instead — an over-limit page is created
        # inactive (locked) and can be activated once a slot frees up / upgrade.
        serializer.save(is_locked=not can_create_business(self.request.user))

class BusinessDetailView(generics.RetrieveUpdateDestroyAPIView):
    # Looked up by path. Access is role-gated: read = viewer+, edit = editor+,
    # delete = owner only (see businesses.access).
    serializer_class = BusinessSerializer
    permission_classes = [permissions.IsAuthenticated]
    lookup_field = 'path'

    def get_object(self):
        if self.request.method in ('PUT', 'PATCH'):
            min_role = ROLE_EDITOR
        elif self.request.method == 'DELETE':
            min_role = 'owner'
        else:
            min_role = ROLE_VIEWER
        business, _ = get_business_or_404(self.request.user, self.kwargs['path'], min_role)
        return business

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


def _resolve_invitee(identifier):
    """Split an invite identifier into (existing_user, email, phone).

    An '@' means email, otherwise a phone number. ``existing_user`` is the matching
    account if one already exists (invite attaches immediately); otherwise the
    membership is created pending and claimed on signup."""
    identifier = (identifier or '').strip()
    if '@' in identifier:
        email = identifier.lower()
        user = User.objects.filter(email__iexact=email).first()
        return user, email, ''
    phone = identifier
    user = User.objects.filter(phone_number=phone).first()
    return user, '', phone


class MembershipListCreateView(APIView):
    """List a page's team / invite a member. Visible to owner + admins; inviting
    additionally requires the *owner* to hold the ``team`` entitlement (Pro)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, path):
        business, role = get_business_or_404(request.user, path, ROLE_ADMIN)
        members = BusinessMembership.objects.filter(business=business).select_related('user')
        return Response({
            'owner': {'display': user_display(business.owner)},
            'members': MembershipSerializer(members, many=True).data,
            'my_role': role,
            'team_enabled': bool(get_entitlements(business.owner)['features']['team']),
        })

    def post(self, request, path):
        business, _ = get_business_or_404(request.user, path, ROLE_ADMIN)
        if not get_entitlements(business.owner)['features']['team']:
            raise PermissionDenied({'reason': 'team'})

        serializer = MembershipInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data['role']
        user, email, phone = _resolve_invitee(serializer.validated_data['identifier'])
        if not email and not phone:
            raise ValidationError({'reason': 'invalid_identifier'})

        role_display = dict(BusinessMembership.ROLES).get(role, role)
        email_sent = None
        if user is not None:
            if user.id == business.owner_id:
                raise ValidationError({'reason': 'owner'})
            if BusinessMembership.objects.filter(business=business, user=user).exists():
                raise ValidationError({'reason': 'already_member'})
            m = BusinessMembership.objects.create(
                business=business, user=user, role=role,
                invited_by=request.user, accepted_at=timezone.now(),
            )
            if email:
                email_sent = emails.send_existing_member_notice(email, business, role_display)
        elif email:
            # No account with this email yet: create one with a temporary
            # password and attach the membership immediately — the credentials
            # go out by email so the invitee can log in right away.
            temp_password = get_random_string(10, 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789')
            with transaction.atomic():
                user = User.objects.create_user(
                    phone_number=None, email=email, password=temp_password,
                )
                user.is_verified = True
                user.save(update_fields=['is_verified'])
                m = BusinessMembership.objects.create(
                    business=business, user=user, role=role, invite_email=email,
                    invited_by=request.user, accepted_at=timezone.now(),
                )
                # Pending invites from *other* businesses addressed to this
                # email attach to the fresh account too.
                claim_pending_invites(user)
            email_sent = emails.send_new_member_credentials(email, temp_password, business, role_display)
        else:
            dup = BusinessMembership.objects.filter(business=business, user__isnull=True)
            dup = dup.filter(invite_phone=phone)
            if dup.exists():
                raise ValidationError({'reason': 'already_invited'})
            m = BusinessMembership.objects.create(
                business=business, role=role, invite_phone=phone, invited_by=request.user,
            )
        return Response(
            {**MembershipSerializer(m).data, 'email_sent': email_sent},
            status=status.HTTP_201_CREATED,
        )


class MembershipDetailView(APIView):
    """Change a member's role / remove them (owner + admins)."""
    permission_classes = [permissions.IsAuthenticated]

    def _get(self, request, pk):
        membership = get_object_or_404(BusinessMembership, pk=pk)
        require_role(request.user, membership.business, ROLE_ADMIN)
        return membership

    def patch(self, request, pk):
        membership = self._get(request, pk)
        serializer = MembershipRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        membership.role = serializer.validated_data['role']
        membership.save(update_fields=['role'])
        return Response(MembershipSerializer(membership).data)

    def delete(self, request, pk):
        membership = self._get(request, pk)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BusinessAssetView(APIView):
    """Download a QR / PDF asset for the owner's business.

    Tier-gated (``qr`` feature): PNG needs Oddiy+ ('png'|'full'); the PDF and the
    business-card PDF need Pro ('full'). ``fmt`` is supplied by the URL conf."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, path, fmt):
        business, _ = get_business_or_404(request.user, path, ROLE_VIEWER)
        qr_level = get_entitlements(business.owner)['features']['qr']  # none|png|full
        url = f"{settings.FRONTEND_URL.rstrip('/')}/{business.path}"

        # Instagram-story image: open to ALL tiers (watermarked, drives traffic
        # back to MyLink) — not behind the qr gate.
        if fmt == 'story_png':
            return self._file(qr.story_png_bytes(business, url), 'image/png', f'{business.path}-story.png')

        if fmt == 'qr_png':
            if qr_level not in ('png', 'full'):
                raise PermissionDenied({'reason': 'qr'})
            return self._file(qr.qr_png_bytes(url), 'image/png', f'{business.path}-qr.png')

        # PDF + business card are Pro-only.
        if qr_level != 'full':
            raise PermissionDenied({'reason': 'qr'})
        if fmt == 'qr_pdf':
            return self._file(qr.qr_pdf_bytes(business, url), 'application/pdf', f'{business.path}-stend.pdf')
        # Vizitka: rangi biznes sahifasi temasidan olinadi.
        return self._file(
            qr.card_pdf_bytes(business, url),
            'application/pdf', f'{business.path}-card.pdf',
        )

    @staticmethod
    def _file(data, content_type, filename):
        resp = HttpResponse(data, content_type=content_type)
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp


class MediaSectionListCreateView(generics.ListCreateAPIView):
    """List/create media sections for a business. Section count is gated by the
    ``banners`` entitlement (the page owner's tier)."""
    serializer_class = MediaSectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        business, _ = get_business_or_404(self.request.user, self.kwargs['path'], ROLE_VIEWER)
        return MediaSection.objects.filter(business=business).prefetch_related('blocks')

    def perform_create(self, serializer):
        business, _ = get_business_or_404(self.request.user, self.kwargs['path'], ROLE_EDITOR)
        # Tier limits follow the page owner's plan, not the editing member's.
        feats = get_entitlements(business.owner)['features']
        if MediaSection.objects.filter(business=business).count() >= feats['banners']:
            raise PermissionDenied({'reason': 'section_limit', 'limit': feats['banners']})
        last = MediaSection.objects.filter(business=business).aggregate(m=Max('order'))['m'] or 0
        serializer.save(business=business, order=last + 1)


class MediaSectionDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Rename / re-cover / delete a section (editor+). Deleting cascades to its
    blocks."""
    serializer_class = MediaSectionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        section = get_object_or_404(MediaSection, pk=self.kwargs['pk'])
        require_role(self.request.user, section.business, ROLE_EDITOR)
        return section


class MediaSectionReorderView(APIView):
    """Persist a new section order: body ``{"order": [id, id, ...]}``."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, path):
        business, _ = get_business_or_404(request.user, path, ROLE_EDITOR)
        for index, section_id in enumerate(request.data.get('order', [])):
            MediaSection.objects.filter(id=section_id, business=business).update(order=index)
        return Response({'ok': True})


class ContentBlockListCreateView(generics.ListCreateAPIView):
    """List/create content blocks. A block must target one of the business's own
    sections; each section holds at most ``MAX_BLOCKS_PER_SECTION`` blocks and
    video blocks additionally need ``banner_video``."""
    serializer_class = ContentBlockSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        business, _ = get_business_or_404(self.request.user, self.kwargs['path'], ROLE_VIEWER)
        return ContentBlock.objects.filter(business=business)

    def perform_create(self, serializer):
        business, _ = get_business_or_404(self.request.user, self.kwargs['path'], ROLE_EDITOR)
        # Tier limits follow the page owner's plan, not the editing member's.
        feats = get_entitlements(business.owner)['features']
        section = serializer.validated_data.get('section')
        if section is None or section.business_id != business.id:
            raise ValidationError({'reason': 'invalid_section'})
        if section.blocks.count() >= MAX_BLOCKS_PER_SECTION:
            raise PermissionDenied({'reason': 'section_block_limit', 'limit': MAX_BLOCKS_PER_SECTION})
        if serializer.validated_data.get('block_type') == 'video' and not feats['banner_video']:
            raise PermissionDenied({'reason': 'banner_video'})
        last = ContentBlock.objects.filter(business=business).aggregate(m=Max('order'))['m'] or 0
        serializer.save(business=business, order=last + 1)


class ContentBlockDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Update/delete a single block (owner or an editor+ member)."""
    serializer_class = ContentBlockSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        block = get_object_or_404(ContentBlock, pk=self.kwargs['pk'])
        require_role(self.request.user, block.business, ROLE_EDITOR)
        return block

    def perform_update(self, serializer):
        feats = get_entitlements(serializer.instance.business.owner)['features']
        block_type = serializer.validated_data.get('block_type', serializer.instance.block_type)
        if block_type == 'video' and not feats['banner_video']:
            raise PermissionDenied({'reason': 'banner_video'})
        serializer.save()


class ContentBlockReorderView(APIView):
    """Persist a new block order: body ``{"order": [id, id, ...]}``."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, path):
        business, _ = get_business_or_404(request.user, path, ROLE_EDITOR)
        for index, block_id in enumerate(request.data.get('order', [])):
            ContentBlock.objects.filter(id=block_id, business=business).update(order=index)
        return Response({'ok': True})


class TrackThrottle(AnonRateThrottle):
    scope = 'track'
    rate = '1000/hour'


class TrackView(APIView):
    """Public: record an interaction on a page. Body: ``{path, event_type, label?}``.
    Silently ignores unknown paths/locked pages so a tracking beacon never errors
    the visitor's page."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [TrackThrottle]

    VALID = {'view', 'click', 'share', 'banner'}

    def post(self, request):
        event_type = request.data.get('event_type')
        if event_type not in self.VALID:
            return Response({'detail': 'bad event_type'}, status=status.HTTP_400_BAD_REQUEST)
        business = Business.objects.filter(path=request.data.get('path'), is_locked=False).first()
        if business is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        Event.objects.create(
            business=business,
            event_type=event_type,
            label=(request.data.get('label') or '')[:200],
        )
        return Response(status=status.HTTP_201_CREATED)


class BusinessAnalyticsView(APIView):
    """Owner analytics for one business, tier-gated (``analytics``: none→403,
    partial→7-day window, full→30-day window + top links)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, path):
        business, _ = get_business_or_404(request.user, path, ROLE_VIEWER)
        level = get_entitlements(business.owner)['features']['analytics']  # none|partial|full
        if level == 'none':
            raise PermissionDenied({'reason': 'analytics'})

        days = 30 if level == 'full' else 7
        since = timezone.now() - timedelta(days=days)
        qs = Event.objects.filter(business=business, created_at__gte=since)

        totals = {'view': 0, 'click': 0, 'share': 0, 'banner': 0}
        for row in qs.values('event_type').annotate(n=Count('id')):
            totals[row['event_type']] = row['n']

        daily_map = {}
        for row in qs.annotate(d=TruncDate('created_at')).values('d', 'event_type').annotate(n=Count('id')):
            key = row['d'].isoformat()
            entry = daily_map.setdefault(key, {'date': key, 'view': 0, 'click': 0})
            if row['event_type'] in ('view', 'click'):
                entry[row['event_type']] = row['n']

        today = timezone.now().date()
        daily = [
            daily_map.get(
                (today - timedelta(days=i)).isoformat(),
                {'date': (today - timedelta(days=i)).isoformat(), 'view': 0, 'click': 0},
            )
            for i in range(days, -1, -1)
        ]

        result = {'level': level, 'days': days, 'totals': totals, 'daily': daily}
        if level == 'full':
            top = (qs.filter(event_type='click').exclude(label='')
                   .values('label').annotate(clicks=Count('id')).order_by('-clicks')[:10])
            result['top_links'] = [{'label': r['label'], 'clicks': r['clicks']} for r in top]
        return Response(result)


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


class PublicFeaturedView(APIView):
    """Admin-curated businesses for the landing 'Bizning mijozlar' carousel.
    Only featured + active (unlocked) pages; minimal public fields."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        qs = Business.objects.filter(is_featured=True, is_locked=False).order_by('name')[:24]
        return Response([
            {
                'path': b.path,
                'name': b.name,
                'logo': request.build_absolute_uri(b.logo.url) if b.logo else None,
            }
            for b in qs
        ])


# --------------------------------------------------------------------------- #
# Ommaviy oferta + NFC to'lovi
# --------------------------------------------------------------------------- #

def offer_url(request):
    """Amaldagi ommaviy oferta havolasi (to'liq URL).

    Admin PDF yuklagan bo'lsa - o'sha fayl; aks holda matndan joyida
    yig'iladigan dinamik PDF (rekvizitlar adminkadan olinadi)."""
    s = SiteSettings.get_settings()
    if s.offer_pdf:
        return request.build_absolute_uri(s.offer_pdf.url)
    return request.build_absolute_uri('/api/public/offer.pdf')


class OfferPdfView(APIView):
    """Ommaviy oferta PDF - matn assets/oferta_uz.txt da, rekvizitlar
    SiteSettings da. Admin o'z faylini yuklasa, foydalanuvchi o'shanga
    yo'naltiriladi (offer_url) va bu endpoint ishlatilmaydi."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        from .offer import offer_pdf_bytes
        response = HttpResponse(offer_pdf_bytes(), content_type='application/pdf')
        response['Content-Disposition'] = 'inline; filename="mylink-oferta.pdf"'
        return response


def nfc_order_message(order, paid=False):
    """NFC buyurtmasi haqida Telegram guruhga ketadigan xabar."""
    summa = f"{order.amount:,}".replace(',', ' ') + " so'm" if order.amount else '-'
    head = ("✅ <b>NFC buyurtma to'landi</b>" if paid
            else "\U0001F4B3 <b>Yangi NFC buyurtma</b>")
    return (
        f"{head}\n"
        f"<b>Ism:</b> {order.full_name}\n"
        f"<b>Tel:</b> {order.phone}\n"
        f"<b>Soni:</b> {order.quantity}\n"
        f"<b>Summa:</b> {summa}\n"
        f"<b>Biznes:</b> {order.business.name if order.business else '-'}\n"
        f"<b>Izoh:</b> {order.note or '-'}"
    )


def nfc_pay_url(request, order):
    """NFC buyurtmasi uchun Click to'lov havolasi ('' - narx yo'q/Click o'chiq)."""
    if order.amount <= 0:
        return ''
    from billing import click
    from billing.models import PaymentOrder
    if not click.configured():
        return ''
    payment = PaymentOrder.objects.create(
        user=order.user, kind='nfc', nfc_order=order, amount=order.amount,
    )
    return click.pay_url(payment, request.data.get('return_url') or '')


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
            # NFC vizitka narxi (1 dona) - foydalanuvchi buyurtmadan oldin ko'radi.
            'nfc_price': s.nfc_price,
            'offer_url': offer_url(request),
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
            f"<b>Tel:</b> {msg.phone or '—'}\n"
            f"<b>Aloqa:</b> {msg.contact or '—'}\n"
            f"<b>Xabar:</b> {msg.message}"
        )
        send_telegram_message(text)
        return Response({"message": "ok"}, status=status.HTTP_201_CREATED)


class NfcOrderListCreateView(generics.ListCreateAPIView):
    """Foydalanuvchining NFC buyurtmalari / yangi buyurtma berish.

    Narx SiteSettings.nfc_price dan olinib buyurtmaga yozib qo'yiladi (keyin
    narx o'zgarsa ham bu buyurtma o'z summasida qoladi). Narx > 0 va Click
    sozlangan bo'lsa javobda ``pay_url`` qaytadi: foydalanuvchi o'sha yerda
    to'laydi, tasdiq billing'dagi Click callback orqali keladi.

    Muhim: to'lovli buyurtma darhol QABUL QILINMAYDI — u 'pending' holatida
    turadi va jamoaga xabar yuborilmaydi. To'lov tasdiqlangandan keyingina
    status 'new' ga o'tadi va Telegram guruhga xabar ketadi (billing.views).
    Narx 0 bo'lsa (yoki Click sozlanmagan bo'lsa) eski tartib: ariza darhol
    qabul qilinadi."""
    serializer_class = NfcOrderSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return NfcOrder.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        order = self.perform_create(serializer)
        data = dict(serializer.data)
        data['id'] = order.pk
        data['amount'] = order.amount
        data['unit_price'] = order.unit_price
        data['pay_url'] = nfc_pay_url(request, order)
        return Response(data, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        from billing import click
        unit = SiteSettings.get_settings().nfc_price or 0
        qty = serializer.validated_data.get('quantity') or 1
        # To'lov talab qilinsa — ariza to'lovgacha 'pending' bo'lib turadi.
        needs_payment = unit > 0 and click.configured()
        order = serializer.save(
            user=self.request.user, unit_price=unit, amount=unit * qty,
            status='pending' if needs_payment else 'new',
        )
        if not needs_payment:
            send_telegram_message(nfc_order_message(order))
        return order


class NfcOrderPayView(APIView):
    """To'lanmagan buyurtma uchun yangi Click havolasi.

    Foydalanuvchi to'lovni yarim yo'lda tashlab ketgan bo'lsa, formani qaytadan
    to'ldirmasdan shu buyurtmani to'lay oladi."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        order = get_object_or_404(NfcOrder, pk=pk, user=request.user)
        if order.is_paid:
            return Response({'reason': 'already_paid'}, status=status.HTTP_400_BAD_REQUEST)
        pay_url = nfc_pay_url(request, order)
        if not pay_url:
            return Response({'reason': 'payment_unavailable'},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({'pay_url': pay_url})


class StaticPageView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        lang = request.query_params.get('lang', 'uz')
        # Only pages with actual content count; empty body → 404 (frontend shows
        # the "coming soon" placeholder).
        qs = StaticPage.objects.exclude(body='')
        page = qs.filter(slug=slug, language=lang).first() or qs.filter(slug=slug).first()
        if page is None:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(StaticPageSerializer(page).data)


class BlogListView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        lang = request.query_params.get('lang', 'uz')
        # Published + has content (empty body = unfinished draft, hidden).
        published = BlogPost.objects.filter(is_published=True).exclude(body='')
        qs = published.filter(language=lang)
        if not qs.exists():
            qs = published
        return Response(BlogPostListSerializer(qs, many=True, context={'request': request}).data)


class BlogDetailView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        lang = request.query_params.get('lang', 'uz')
        published = BlogPost.objects.filter(is_published=True).exclude(body='')
        post = published.filter(slug=slug, language=lang).first() or published.filter(slug=slug).first()
        if post is None:
            return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(BlogPostDetailSerializer(post, context={'request': request}).data)
