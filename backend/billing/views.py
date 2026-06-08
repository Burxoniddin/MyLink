from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import PromoError, get_entitlements, redeem_promo


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
