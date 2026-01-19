from django.urls import path
from .views import SendOTPView, LoginView

urlpatterns = [
    path('auth/otp/', SendOTPView.as_view()),
    path('auth/login/', LoginView.as_view()),
]
