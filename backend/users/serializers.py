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
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    ref = serializers.CharField(required=False, allow_blank=True)


class GoogleAuthSerializer(serializers.Serializer):
    # Either an ID token (One Tap / GoogleLogin) or an OAuth access token
    # (useGoogleLogin custom-button flow) — at least one required.
    credential = serializers.CharField(required=False, allow_blank=True)
    access_token = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs.get('credential') and not attrs.get('access_token'):
            raise serializers.ValidationError('credential yoki access_token kerak')
        return attrs


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
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'phone_number', 'email', 'full_name', 'is_verified', 'email_verified', 'has_password']

    def get_has_password(self, obj):
        return obj.has_usable_password()

    def get_full_name(self, obj):
        # Whole "Ism Familiya" lives in first_name (single input on register).
        return (f"{obj.first_name} {obj.last_name}".strip() or '').strip()


class UpdateMeSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
