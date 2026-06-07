from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed


class ExpiringTokenAuthentication(TokenAuthentication):
    """DRF token auth with a sliding expiry window.

    The token's ``created`` timestamp is treated as "last used". A token older
    than ``TOKEN_EXPIRE_DAYS`` (default 7) is rejected and deleted, so a user
    stays logged in for ~1 week of inactivity. To avoid a DB write on every
    request, the timestamp is only refreshed once per ~12h of activity.
    """

    def authenticate_credentials(self, key):
        user, token = super().authenticate_credentials(key)

        ttl = timedelta(days=getattr(settings, 'TOKEN_EXPIRE_DAYS', 7))
        now = timezone.now()

        if token.created < now - ttl:
            token.delete()
            raise AuthenticationFailed('Token muddati tugagan. Iltimos, qaytadan kiring.')

        if token.created < now - timedelta(hours=12):
            token.created = now
            token.save(update_fields=['created'])

        return (user, token)
