import logging

import requests

from .models import SiteSettings

logger = logging.getLogger(__name__)


def send_telegram_message(text):
    """Forward a message to the configured Telegram group via bot.

    Bot token + chat id come from SiteSettings (admin-editable). If not
    configured, this is a no-op so contact saving never fails because of it.
    """
    s = SiteSettings.get_settings()
    token = (s.telegram_bot_token or '').strip()
    chat_id = (s.telegram_chat_id or '').strip()
    if not token or not chat_id:
        return False
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={
                "chat_id": chat_id,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=8,
        )
        if not resp.ok:
            # Surface Telegram's reason (e.g. "chat not found", "bot is not a member").
            logger.warning("Telegram sendMessage failed (%s): %s", resp.status_code, resp.text)
        return resp.ok
    except requests.RequestException as e:
        logger.warning("Telegram send failed: %s", e)
        return False
