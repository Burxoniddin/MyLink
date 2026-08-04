from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import click
from . import entitlements as ent
from .models import PaymentOrder, PlanPrice
from .services import PromoError, get_entitlements, grant_subscription, redeem_promo


class PlansView(APIView):
    """Public: the admin-defined plans + their prices, for the pricing page.

    Fully dynamic — adding a Plan in admin makes it appear here automatically."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request):
        prices = {}
        for p in PlanPrice.objects.filter(is_active=True):
            prices.setdefault(p.tier, {})[p.period] = p.price
        data = []
        for plan in ent.public_plans():
            data.append({
                'slug': plan.slug,
                'name': plan.name,
                'rank': plan.rank,
                'is_default': plan.is_default,
                'features': plan.features_dict(),
                'prices': prices.get(plan.slug, {}),
            })
        return Response(data)


class ClickCreateView(APIView):
    """POST { tier, period, return_url? } → creates a pending PaymentOrder and
    returns the my.click.uz checkout URL to redirect the user to."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not click.configured():
            return Response({'reason': 'click_not_configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        tier = (request.data.get('tier') or '').strip()
        period = (request.data.get('period') or '').strip()
        price = PlanPrice.objects.filter(tier=tier, period=period, is_active=True).first()
        if price is None:
            return Response({'reason': 'price_not_found'}, status=status.HTTP_400_BAD_REQUEST)

        order = PaymentOrder.objects.create(
            user=request.user, tier=tier, period=period, amount=price.price,
        )
        return_url = request.data.get('return_url') or ''
        return Response({'order_id': order.pk, 'pay_url': click.pay_url(order, return_url)})


class ClickCallbackView(APIView):
    """Click SHOP API server-to-server callback (Prepare action=0 / Complete
    action=1). Public, signed with md5 over CLICK_SECRET_KEY. Register this URL
    as both the Prepare and Complete endpoint in the Click merchant cabinet."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        d = request.data

        def reply(error, error_note='', **extra):
            return Response({
                'click_trans_id': d.get('click_trans_id'),
                'merchant_trans_id': d.get('merchant_trans_id'),
                'error': error,
                'error_note': error_note or ('Success' if error == 0 else 'Error'),
                **extra,
            })

        if not click.configured():
            return reply(click.ERR_BAD_REQUEST, 'Click is not configured')
        if not click.verify_sign(d):
            return reply(click.ERR_SIGN, 'SIGN CHECK FAILED')

        action = str(d.get('action', ''))
        if action not in ('0', '1'):
            return reply(click.ERR_ACTION, 'Action not found')

        try:
            order_id = int(d.get('merchant_trans_id', ''))
        except (TypeError, ValueError):
            return reply(click.ERR_NOT_FOUND, 'Order not found')
        order = PaymentOrder.objects.filter(pk=order_id).first()
        if order is None:
            return reply(click.ERR_NOT_FOUND, 'Order not found')

        try:
            amount = float(d.get('amount', ''))
        except (TypeError, ValueError):
            return reply(click.ERR_AMOUNT, 'Incorrect amount')
        if abs(amount - float(order.amount)) > 0.01:
            return reply(click.ERR_AMOUNT, 'Incorrect amount')

        # ---- Prepare ----
        if action == '0':
            if order.status == 'paid':
                return reply(click.ERR_ALREADY_PAID, 'Already paid')
            if order.status == 'canceled':
                return reply(click.ERR_CANCELED, 'Transaction cancelled')
            order.click_trans_id = str(d.get('click_trans_id', ''))
            order.save(update_fields=['click_trans_id'])
            return reply(click.ERR_OK, merchant_prepare_id=order.pk)

        # ---- Complete ----
        if str(d.get('merchant_prepare_id', '')) != str(order.pk):
            return reply(click.ERR_TRANSACTION, 'Transaction does not exist')

        # Click reports its own failure/cancellation via a negative error field.
        try:
            click_error = int(d.get('error', 0))
        except (TypeError, ValueError):
            click_error = 0
        if click_error < 0:
            if order.status != 'paid':
                order.status = 'canceled'
                order.save(update_fields=['status'])
            return reply(click.ERR_CANCELED, 'Transaction cancelled')

        if order.status == 'paid':
            return reply(click.ERR_ALREADY_PAID, 'Already paid', merchant_confirm_id=order.pk)
        if order.status == 'canceled':
            return reply(click.ERR_CANCELED, 'Transaction cancelled')

        with transaction.atomic():
            # Re-check under lock so a duplicate Complete can't double-grant.
            locked = PaymentOrder.objects.select_for_update().get(pk=order.pk)
            if locked.status == 'paid':
                return reply(click.ERR_ALREADY_PAID, 'Already paid', merchant_confirm_id=order.pk)
            duration = ent.PERIOD_DAYS.get(locked.period)  # onetime → None (lifetime)
            sub = grant_subscription(
                locked.user, locked.tier, duration_days=duration,
                source='payment', note=f'Click order #{locked.pk}',
            )
            locked.status = 'paid'
            locked.paid_at = timezone.now()
            locked.subscription = sub
            locked.save(update_fields=['status', 'paid_at', 'subscription'])

        return reply(click.ERR_OK, merchant_confirm_id=order.pk)


class RedeemPromoView(APIView):
    """POST { code } → grants the code's tier to the current user.

    On success returns the refreshed entitlements payload so the client can
    update its UI without a second request. On failure returns 400 with a
    machine-readable ``reason`` key for client-side translation."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        code = request.data.get('code', '')
        try:
            redeem_promo(request.user, code)
        except PromoError as e:
            return Response({'reason': e.reason}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'entitlements': get_entitlements(request.user)}, status=status.HTTP_200_OK)
