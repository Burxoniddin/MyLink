from django.urls import path
from .views import (
    SendOTPView,
    LoginView,
    SendEmailOTPView,
    RegisterView,
    GoogleAuthView,
    PasswordLoginView,
    MeView,
    SetPasswordView,
    ChangePasswordView,
    AddEmailView,
    ForgotPasswordView,
    ResetPasswordView,
    ResetPasswordCodeView,
    ReferralView,
)

urlpatterns = [
    # Phone + OTP
    path('auth/otp/', SendOTPView.as_view()),
    path('auth/login/', LoginView.as_view()),
    # Email verification code
    path('auth/email/otp/', SendEmailOTPView.as_view()),
    # Register (verify code + set password) / password login / Google
    path('auth/register/', RegisterView.as_view()),
    path('auth/login-password/', PasswordLoginView.as_view()),
    path('auth/google/', GoogleAuthView.as_view()),
    # Password management
    path('auth/set-password/', SetPasswordView.as_view()),
    path('auth/change-password/', ChangePasswordView.as_view()),
    path('auth/add-email/', AddEmailView.as_view()),
    path('auth/forgot-password/', ForgotPasswordView.as_view()),
    path('auth/reset-password/', ResetPasswordView.as_view()),
    path('auth/reset-password-code/', ResetPasswordCodeView.as_view()),
    # Current user
    path('me/', MeView.as_view()),
    # Referral program
    path('referral/', ReferralView.as_view()),
]
