from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()


# --- OTP (phone) flow ---
class PhoneSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)


class LoginSerializer(serializers.Serializer):
    phone_number = serializers.CharField(max_length=15)
    code = serializers.CharField(max_length=6)


# --- Email / password flow ---
class EmailOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()


class RegisterSerializer(serializers.Serializer):
    """Unified register: verify a code (email SMTP / phone OTP) then set a password."""
    method = serializers.ChoiceField(choices=['phone', 'email'])
    identifier = serializers.CharField()
    code = serializers.CharField(max_length=6)
    password = serializers.CharField(min_length=6, write_only=True)
    ref = serializers.CharField(required=False, allow_blank=True)


class GoogleAuthSerializer(serializers.Serializer):
    credential = serializers.CharField()


class PasswordLoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()  # phone number or email
    password = serializers.CharField(write_only=True)


class SetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(min_length=6, write_only=True)


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True, required=False, allow_blank=True)
    new_password = serializers.CharField(min_length=6, write_only=True)


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=6, write_only=True)


class ResetPasswordCodeSerializer(serializers.Serializer):
    """Reset password by verifying an email/phone code, then auto-login."""
    method = serializers.ChoiceField(choices=['phone', 'email'])
    identifier = serializers.CharField()
    code = serializers.CharField(max_length=6)
    new_password = serializers.CharField(min_length=6, write_only=True)


class AddEmailSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError('Bu email band')
        return value


class MeSerializer(serializers.ModelSerializer):
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'phone_number', 'email', 'is_verified', 'email_verified', 'has_password']

    def get_has_password(self, obj):
        return obj.has_usable_password()
