from django.urls import path

from .views import ClickCallbackView, ClickCreateView, PlansView, RedeemPromoView

urlpatterns = [
    path('promo/redeem/', RedeemPromoView.as_view()),
    path('plans/', PlansView.as_view()),
    path('payments/click/create/', ClickCreateView.as_view()),
    # Register this URL as BOTH the Prepare and Complete endpoint in the Click
    # merchant cabinet (the action field distinguishes them).
    path('payments/click/callback/', ClickCallbackView.as_view()),
]
