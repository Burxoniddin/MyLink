from django.urls import path

from .views import RedeemPromoView

urlpatterns = [
    path('promo/redeem/', RedeemPromoView.as_view()),
]
