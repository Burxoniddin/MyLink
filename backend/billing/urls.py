from django.urls import path

from .views import PlansView, RedeemPromoView

urlpatterns = [
    path('promo/redeem/', RedeemPromoView.as_view()),
    path('plans/', PlansView.as_view()),
]
