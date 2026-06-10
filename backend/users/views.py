import random
from datetime import timedelta

import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.mail import send_mail
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from .serializers import (
    AddEmailSerializer,
    ChangePasswordSerializer,
    EmailOTPSerializer,
    ForgotPasswordSerializer,
    GoogleAuthSerializer,
    LoginSerializer,
    MeSerializer,
    PasswordLoginSerializer,
    PhoneSerializer,
    RegisterSerializer,
    ResetPasswordCodeSerializer,
    ResetPasswordSerializer,
    SetPasswordSerializer,
)
from .utils import send_sms

User = get_user_model()


class SMSRateThrottle(AnonRateThrottle):
    """IP bo'yicha SMS OTP rate limiting (alohida scope)."""
    scope = 'otp_sms'
    rate = '10/hour'


class LoginRateThrottle(AnonRateThrottle):
    """Login / register / reset uchun rate limiting (alohida scope)."""
    scope = 'auth_login'
    rate = '30/hour'


class SendOTPView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [SMSRateThrottle]

    def post(self, request):
        serializer = PhoneSerializer(data=request.data)
        if serializer.is_valid():
            phone = serializer.validated_data['phone_number']

            # Telefon raqam uchun alohida rate limit - 1 soatda 3 ta SMS
            phone_key = f"otp_rate_{phone}"
            otp_count = cache.get(phone_key, 0)

            if otp_count >= 3:
                return Response(
                    {"error": "Juda ko'p so'rov. 1 soatdan keyin qayta urinib ko'ring."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

            # Oxirgi SMS yuborilganidan keyin 60 sekund kutish
            last_sent_key = f"otp_cooldown_{phone}"
            if cache.get(last_sent_key):
                return Response(
                    {"error": "Iltimos, 60 sekund kuting."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

            # Generate 5 digit code
            code = str(random.randint(10000, 99999))

            # Save to cache for 5 minutes
            cache.set(f"otp_{phone}", code, timeout=300)

            # Increment rate limit counter (1 soat = 3600 sekund)
            cache.set(phone_key, otp_count + 1, timeout=3600)

            # Set cooldown (60 sekund)
            cache.set(last_sent_key, True, timeout=60)

            # Send SMS with OTP
            message = f"MyLink platformasiga kirish uchun tasdiqlash kodi: {code}"
            sms_sent = send_sms(phone, message)

            if sms_sent:
                return Response({"message": "Tasdiqlash kodi yuborildi"}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "SMS yuborishda xatolik"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            phone = serializer.validated_data['phone_number']
            code = serializer.validated_data['code']

            # Noto'g'ri urinishlar sonini tekshirish
            failed_key = f"login_failed_{phone}"
            failed_count = cache.get(failed_key, 0)

            if failed_count >= 5:
                return Response(
                    {"error": "Juda ko'p noto'g'ri urinish. 30 daqiqadan keyin qayta urinib ko'ring."},
                    status=status.HTTP_429_TOO_MANY_REQUESTS
                )

            cached_code = cache.get(f"otp_{phone}")

            if cached_code == code:
                user, created = User.objects.get_or_create(phone_number=phone)
                if created:
                    user.is_verified = True
                    user.save()
                    from businesses.access import claim_pending_invites
                    claim_pending_invites(user)

                token, _ = Token.objects.get_or_create(user=user)
                cache.delete(f"otp_{phone}")
                cache.delete(failed_key)  # Muvaffaqiyatli kirishda reset
                return Response({"token": token.key, "phone_number": phone}, status=status.HTTP_200_OK)
            else:
                # Noto'g'ri urinishni qayd qilish
                cache.set(failed_key, failed_count + 1, timeout=1800)  # 30 daqiqa
                return Response({"error": "Noto'g'ri yoki muddati o'tgan kod"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EmailOTPRateThrottle(AnonRateThrottle):
    scope = 'otp_email'
    rate = '10/hour'


class SendEmailOTPView(APIView):
    """Send a 6-digit verification code to an email via SMTP."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [EmailOTPRateThrottle]

    def post(self, request):
        serializer = EmailOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        email = serializer.validated_data['email'].lower()

        if cache.get(f"otp_email_cd_{email}"):
            return Response({"error": "Iltimos, 60 sekund kuting."}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        code = str(random.randint(100000, 999999))
        cache.set(f"otp_email_{email}", code, timeout=300)
        cache.set(f"otp_email_cd_{email}", True, timeout=60)

        try:
            send_mail(
                "MyLink — tasdiqlash kodi",
                f"Sizning tasdiqlash kodingiz: {code}\n\nKod 5 daqiqa amal qiladi.",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=False,
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning("Email OTP send failed: %s", e)
            return Response(
                {"error": "Email yuborishda xatolik. SMTP sozlamalarini tekshiring."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"message": "Tasdiqlash kodi emailga yuborildi"}, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """Verify a code (email SMTP / phone OTP), then create the account with a password."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        d = serializer.validated_data
        method = d['method']
        identifier = d['identifier'].strip()
        code = d['code']
        password = d['password']

        if method == 'email':
            identifier = identifier.lower()
            cache_key = f"otp_email_{identifier}"
            exists = User.objects.filter(email__iexact=identifier).exists()
        else:
            cache_key = f"otp_{identifier}"
            exists = User.objects.filter(phone_number=identifier).exists()

        if exists:
            return Response(
                {"error": "Bu foydalanuvchi allaqachon mavjud. Kirish sahifasidan foydalaning."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cache.get(cache_key) != code:
            return Response({"error": "Kod noto'g'ri yoki muddati o'tgan"}, status=status.HTTP_400_BAD_REQUEST)

        if method == 'email':
            user = User.objects.create_user(email=identifier, password=password)
            user.email_verified = True
        else:
            user = User.objects.create_user(phone_number=identifier, password=password)
            user.is_verified = True

        # Referral: attribute the new user to the inviter (if ?ref=<code> is valid).
        ref = (request.data.get('ref') or '').strip()
        if ref:
            from .models import ReferralCode
            rc = ReferralCode.objects.filter(code__iexact=ref).select_related('user').first()
            if rc and rc.user_id != user.id:
                user.referred_by = rc.user

        user.save()
        cache.delete(cache_key)

        # Attach any pending team invites addressed to this email/phone (4e).
        from businesses.access import claim_pending_invites
        claim_pending_invites(user)

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "email": user.email, "phone_number": user.phone_number},
            status=status.HTTP_201_CREATED,
        )


class GoogleAuthView(APIView):
    """Sign in / sign up with a Google ID token (credential)."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = GoogleAuthSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        credential = serializer.validated_data['credential']

        try:
            resp = requests.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": credential},
                timeout=8,
            )
        except requests.RequestException:
            return Response({"error": "Google bilan bog'lanib bo'lmadi"}, status=status.HTTP_400_BAD_REQUEST)

        if not resp.ok:
            return Response({"error": "Google token yaroqsiz"}, status=status.HTTP_400_BAD_REQUEST)

        info = resp.json()
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
        if client_id and info.get('aud') != client_id:
            return Response({"error": "Google client mos kelmadi"}, status=status.HTTP_400_BAD_REQUEST)

        email = (info.get('email') or '').lower()
        verified = str(info.get('email_verified')).lower() == 'true'
        if not email or not verified:
            return Response({"error": "Google emaili tasdiqlanmagan"}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email).first()
        if user is None:
            user = User.objects.create_user(email=email)  # passwordless (Google)
            user.email_verified = True
            user.save()
            from businesses.access import claim_pending_invites
            claim_pending_invites(user)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({"token": token.key, "email": user.email}, status=status.HTTP_200_OK)


class PasswordLoginView(APIView):
    """Telefon yoki email + parol orqali kirish."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = PasswordLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        identifier = serializer.validated_data['identifier'].strip()
        password = serializer.validated_data['password']

        if '@' in identifier:
            user = User.objects.filter(email__iexact=identifier.lower()).first()
        else:
            user = User.objects.filter(phone_number=identifier).first()

        if user is None or not user.check_password(password):
            return Response(
                {"error": "Login yoki parol noto'g'ri"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "phone_number": user.phone_number, "email": user.email},
            status=status.HTTP_200_OK,
        )


class MeView(APIView):
    """Joriy foydalanuvchi ma'lumotlari + entitlement (tarif) holati."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from billing.services import get_entitlements
        data = MeSerializer(request.user).data
        data['entitlements'] = get_entitlements(request.user)
        return Response(data)


class SetPasswordView(APIView):
    """Parolsiz (OTP) foydalanuvchi birinchi marta parol o'rnatadi."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = SetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        request.user.set_password(serializer.validated_data['password'])
        request.user.save(update_fields=['password'])
        return Response({"message": "Parol o'rnatildi"}, status=status.HTTP_200_OK)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        old = serializer.validated_data.get('old_password', '')
        # Agar foydalanuvchida ishlaydigan parol bo'lsa, eskisini tekshiramiz.
        if user.has_usable_password():
            if not old or not user.check_password(old):
                return Response({"error": "Eski parol noto'g'ri"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password'])
        return Response({"message": "Parol yangilandi"}, status=status.HTTP_200_OK)


class AddEmailView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = AddEmailSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        request.user.email = serializer.validated_data['email']
        request.user.email_verified = False
        request.user.save(update_fields=['email', 'email_verified'])
        return Response({"message": "Email qo'shildi", "email": request.user.email})


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        email = serializer.validated_data['email'].lower()
        user = User.objects.filter(email__iexact=email).first()
        # Mavjudligini oshkor qilmaymiz - har doim 200 qaytaramiz.
        if user:
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?uid={uid}&token={token}"
            send_mail(
                'MyLink - Parolni tiklash',
                f"Parolingizni tiklash uchun havola:\n{reset_url}\n\nAgar bu siz bo'lmasangiz, e'tiborsiz qoldiring.",
                settings.DEFAULT_FROM_EMAIL,
                [email],
                fail_silently=True,
            )
        return Response({"message": "Agar email mavjud bo'lsa, tiklash havolasi yuborildi"})


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        try:
            uid = force_str(urlsafe_base64_decode(data['uid']))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            user = None

        if user is None or not default_token_generator.check_token(user, data['token']):
            return Response({"error": "Havola yaroqsiz yoki muddati o'tgan"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(data['new_password'])
        user.save(update_fields=['password'])
        return Response({"message": "Parol tiklandi"})


class ResetPasswordCodeView(APIView):
    """Reset password via an email/phone verification code, then auto-login."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        serializer = ResetPasswordCodeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        d = serializer.validated_data
        method = d['method']
        identifier = d['identifier'].strip()

        if method == 'email':
            identifier = identifier.lower()
            cache_key = f"otp_email_{identifier}"
            user = User.objects.filter(email__iexact=identifier).first()
        else:
            cache_key = f"otp_{identifier}"
            user = User.objects.filter(phone_number=identifier).first()

        if cache.get(cache_key) != d['code']:
            return Response({"error": "Kod noto'g'ri yoki muddati o'tgan"}, status=status.HTTP_400_BAD_REQUEST)
        if user is None:
            return Response({"error": "Bunday foydalanuvchi topilmadi"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(d['new_password'])
        user.save(update_fields=['password'])
        cache.delete(cache_key)

        token, _ = Token.objects.get_or_create(user=user)
        return Response(
            {"token": token.key, "phone_number": user.phone_number, "email": user.email},
            status=status.HTTP_200_OK,
        )


class ReferralView(APIView):
    """The current user's invite code, share link and referral stats."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from .models import ReferralCode
        from billing.models import ReferralReward
        from billing.services import REFERRAL_YEARLY_CAP

        rc = ReferralCode.get_or_create_for(request.user)
        rewards = ReferralReward.objects.filter(referrer=request.user)
        year_ago = timezone.now() - timedelta(days=365)
        months = rewards.filter(subscription__isnull=False, created_at__gte=year_ago).count()
        base = settings.FRONTEND_URL.rstrip('/')
        return Response({
            'code': rc.code,
            'link': f"{base}/register?ref={rc.code}",
            'total_referred': User.objects.filter(referred_by=request.user).count(),
            'converted': rewards.count(),
            'months_earned': months,
            'cap': REFERRAL_YEARLY_CAP,
        })
