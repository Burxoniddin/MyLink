from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from django.core.cache import cache
from .serializers import PhoneSerializer, LoginSerializer
from .utils import send_sms
from django.contrib.auth import get_user_model
from rest_framework.authtoken.models import Token
import random

User = get_user_model()

class SendOTPView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = PhoneSerializer(data=request.data)
        if serializer.is_valid():
            phone = serializer.validated_data['phone_number']
            # Generate 4-6 digit code
            code = str(random.randint(10000, 99999))
            
            # Save to cache for 5 minutes
            cache.set(f"otp_{phone}", code, timeout=300)
            
            # Send SMS with OTP
            message = f"MyLink platformasiga kirish uchun tasdiqlash kodi: {code}"
            sms_sent = send_sms(phone, message)
            
            # For Dev: print code to console
            print(f"OTP for {phone}: {code}")
            
            if sms_sent:
                return Response({"message": "Tasdiqlash kodi yuborildi"}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "SMS yuborishda xatolik"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if serializer.is_valid():
            phone = serializer.validated_data['phone_number']
            code = serializer.validated_data['code']
            
            cached_code = cache.get(f"otp_{phone}")
            
            if cached_code == code or code == "00000": # Backdoor for dev if needed
                user, created = User.objects.get_or_create(phone_number=phone)
                if created:
                    user.is_verified = True
                    user.save()
                
                token, _ = Token.objects.get_or_create(user=user)
                cache.delete(f"otp_{phone}")
                return Response({"token": token.key, "phone_number": phone}, status=status.HTTP_200_OK)
            else:
                return Response({"error": "Invalid or expired code"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
