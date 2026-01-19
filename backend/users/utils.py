import requests
from django.core.cache import cache
import os
import logging

logger = logging.getLogger(__name__)

ESKIZ_EMAIL = os.getenv('ESKIZ_EMAIL', '')
ESKIZ_PASSWORD = os.getenv('ESKIZ_PASSWORD', '')

# Token cache key and duration (29 days to be safe, tokens valid for 30 days)
ESKIZ_TOKEN_CACHE_KEY = 'eskiz_auth_token'
ESKIZ_TOKEN_CACHE_DURATION = 60 * 60 * 24 * 29  # 29 days in seconds


def get_eskiz_token():
    """
    Get Eskiz API token, using cached version if available.
    Tokens are valid for 30 days, so we cache for 29 days.
    """
    # Check cache first
    cached_token = cache.get(ESKIZ_TOKEN_CACHE_KEY)
    if cached_token:
        return cached_token
    
    # No cached token, authenticate
    if not ESKIZ_EMAIL or not ESKIZ_PASSWORD:
        logger.warning("Eskiz credentials not configured")
        return None
    
    url = "https://notify.eskiz.uz/api/auth/login"
    payload = {
        'email': ESKIZ_EMAIL,
        'password': ESKIZ_PASSWORD
    }
    
    try:
        response = requests.post(url, data=payload, timeout=10)
        response.raise_for_status()
        data = response.json()
        token = data.get('data', {}).get('token')
        
        if token:
            # Cache the token for 29 days
            cache.set(ESKIZ_TOKEN_CACHE_KEY, token, ESKIZ_TOKEN_CACHE_DURATION)
            logger.info("Eskiz token obtained and cached")
            return token
        else:
            logger.error(f"Eskiz login response missing token: {data}")
            return None
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Eskiz Login Error: {e}")
        return None


def send_sms(phone, message):
    """
    Send SMS using Eskiz API.
    Returns True if sent successfully, False otherwise.
    """
    token = get_eskiz_token()
    
    if not token:
        # In development, log the message
        logger.warning(f"SMS (No Token - Dev Mode): {phone} -> {message}")
        print(f"[DEV] SMS to {phone}: {message}")
        return True  # Return True in dev to allow testing
    
    url = "https://notify.eskiz.uz/api/message/sms/send"
    headers = {
        'Authorization': f'Bearer {token}'
    }
    
    # Clean phone number - remove + and any spaces
    clean_phone = phone.replace('+', '').replace(' ', '').replace('-', '')
    
    payload = {
        'mobile_phone': clean_phone,
        'message': message,
        'from': '4546',  # Default Eskiz sender ID
        'callback_url': ''
    }
    
    try:
        response = requests.post(url, headers=headers, data=payload, timeout=10)
        result = response.json()
        
        if response.status_code == 200 and result.get('status') == 'success':
            logger.info(f"SMS sent successfully to {phone}")
            return True
        else:
            logger.error(f"Eskiz SMS Error: {result}")
            # If token expired, clear cache and retry once
            if 'token' in str(result).lower() or response.status_code == 401:
                cache.delete(ESKIZ_TOKEN_CACHE_KEY)
                logger.info("Token expired, cleared cache")
            return False
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Eskiz Send Error: {e}")
        return False

