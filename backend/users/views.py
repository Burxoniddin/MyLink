from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.throttling import AnonRateThrottle
from django.core.cache import cache
from .serializers import PhoneSerializer, LoginSerializer
from .utils import send_sms
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
import random

User = get_user_model()


class SMSRateThrottle(AnonRateThrottle):
    """IP bo'yicha rate limiting - 1 soatda 10 ta so'rov"""
    rate = '10/hour'


class SendOTPView(APIView):
    permission_classes = [AllowAny]
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


class LoginRateThrottle(AnonRateThrottle):
    """Login uchun rate limiting - 1 soatda 20 ta urinish"""
    rate = '20/hour'


class LoginView(APIView):
    permission_classes = [AllowAny]
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

                token, _ = Token.objects.get_or_create(user=user)
                cache.delete(f"otp_{phone}")
                cache.delete(failed_key)  # Muvaffaqiyatli kirishda reset
                return Response({"token": token.key, "phone_number": phone}, status=status.HTTP_200_OK)
            else:
                # Noto'g'ri urinishni qayd qilish
                cache.set(failed_key, failed_count + 1, timeout=1800)  # 30 daqiqa
                return Response({"error": "Noto'g'ri yoki muddati o'tgan kod"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
