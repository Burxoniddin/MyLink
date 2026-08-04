"""Click (click.uz) SHOP API helpers.

Flow: the frontend asks ``/api/payments/click/create/`` for a checkout URL and
redirects the user to my.click.uz. Click's server then calls our callback with
``action=0`` (Prepare) and ``action=1`` (Complete); both requests are signed
with md5 over the shared secret (``CLICK_SECRET_KEY``).

Credentials live in env: CLICK_SERVICE_ID, CLICK_MERCHANT_ID, CLICK_SECRET_KEY.
"""
import hashlib
from urllib.parse import urlencode

from django.conf import settings

PAY_BASE = 'https://my.click.uz/services/pay'

# Click SHOP API error codes (returned in our callback responses).
ERR_OK = 0
ERR_SIGN = -1            # signature check failed
ERR_AMOUNT = -2          # incorrect amount
ERR_ACTION = -3          # unknown action
ERR_ALREADY_PAID = -4    # already paid
ERR_NOT_FOUND = -5       # order (merchant_trans_id) does not exist
ERR_TRANSACTION = -6     # transaction/prepare id mismatch
ERR_BAD_REQUEST = -8     # malformed request / not configured
ERR_CANCELED = -9        # transaction cancelled


def configured():
    return bool(getattr(settings, 'CLICK_SERVICE_ID', '') and
                getattr(settings, 'CLICK_MERCHANT_ID', '') and
                getattr(settings, 'CLICK_SECRET_KEY', ''))


def make_sign(click_trans_id, service_id, merchant_trans_id, amount, action, sign_time,
              merchant_prepare_id=''):
    """md5 signature per the SHOP API spec. ``merchant_prepare_id`` is included
    only for action=1 (Complete)."""
    base = (
        f"{click_trans_id}{service_id}{settings.CLICK_SECRET_KEY}{merchant_trans_id}"
        f"{merchant_prepare_id}{amount}{action}{sign_time}"
    )
    return hashlib.md5(base.encode()).hexdigest()


def verify_sign(data):
    """Check the ``sign_string`` of an incoming Prepare/Complete request."""
    action = str(data.get('action', ''))
    prepare_id = data.get('merchant_prepare_id', '') if action == '1' else ''
    expected = make_sign(
        data.get('click_trans_id', ''), data.get('service_id', ''),
        data.get('merchant_trans_id', ''), data.get('amount', ''),
        action, data.get('sign_time', ''), prepare_id,
    )
    return expected == (data.get('sign_string') or '')


def pay_url(order, return_url):
    """Checkout redirect URL for a PaymentOrder."""
    q = urlencode({
        'service_id': settings.CLICK_SERVICE_ID,
        'merchant_id': settings.CLICK_MERCHANT_ID,
        'amount': str(order.amount),
        'transaction_param': str(order.pk),
        'return_url': return_url,
    })
    return f'{PAY_BASE}?{q}'
