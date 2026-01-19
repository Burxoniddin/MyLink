from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class PhoneSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)

class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    code = serializers.CharField(max_length=6)
