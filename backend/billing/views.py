from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import entitlements as ent
from .models import PlanPrice
from .services import PromoError, get_entitlements, redeem_promo


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
