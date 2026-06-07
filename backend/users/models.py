from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.utils.translation import gettext_lazy as _


class CustomUserManager(BaseUserManager):
    def create_user(self, phone_number=None, password=None, **extra_fields):
        email = extra_fields.get('email')
        if not phone_number and not email:
            raise ValueError(_('Either a phone number or an email must be set'))
        if email:
            extra_fields['email'] = self.normalize_email(email)
        extra_fields.setdefault('is_active', True)
        user = self.model(phone_number=phone_number, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError(_('Superuser must have is_staff=True.'))
        if extra_fields.get('is_superuser') is not True:
            raise ValueError(_('Superuser must have is_superuser=True.'))

        return self.create_user(phone_number, password, **extra_fields)


class CustomUser(AbstractUser):
    username = None
    # phone_number is the primary login identifier (OTP). Nullable so users can
    # register with email-only; email is the secondary identifier.
    phone_number = models.CharField(_('phone number'), max_length=15, unique=True, null=True, blank=True)
    email = models.EmailField(_('email address'), unique=True, null=True, blank=True)
    is_verified = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    # Referral: who invited this user (wired up in referral phase).
    referred_by = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.SET_NULL, related_name='referrals'
    )

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    def __str__(self):
        return self.phone_number or self.email or f'user#{self.pk}'
