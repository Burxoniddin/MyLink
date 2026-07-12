"""Outbound team-invite emails.

Sending is best-effort: the membership (and, for a fresh invitee, the account)
is already committed by the time we get here, so an SMTP failure must not fail
the request — we log it and the view reports ``email_sent: false``.
"""
import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger(__name__)


def _frontend(path=''):
    return f"{settings.FRONTEND_URL.rstrip('/')}{path}"


def send_new_member_credentials(email, temp_password, business, role_display):
    """Credentials mail for an invitee whose account we just created."""
    subject = "MyLink — sizni jamoaga taklif qilishdi"
    body = (
        f"Assalomu alaykum!\n\n"
        f"Sizni \"{business.name}\" sahifasi jamoasiga \"{role_display}\" sifatida taklif qilishdi.\n"
        f"Siz uchun MyLink'da akkaunt yaratildi:\n\n"
        f"  Login: {email}\n"
        f"  Vaqtinchalik parol: {temp_password}\n\n"
        f"Kirish: {_frontend('/login')}\n\n"
        f"Xavfsizlik uchun birinchi kirishdan so'ng Profil bo'limida parolingizni "
        f"albatta almashtiring.\n\n"
        f"— MyLink.asia jamoasi"
    )
    return _send(subject, body, email)


def send_existing_member_notice(email, business, role_display):
    """Notification mail for an invitee who already has an account."""
    subject = "MyLink — sizni jamoaga qo'shishdi"
    body = (
        f"Assalomu alaykum!\n\n"
        f"Sizni \"{business.name}\" sahifasi jamoasiga \"{role_display}\" sifatida qo'shishdi.\n"
        f"Sahifa boshqaruvi kabinetingizda ochildi: {_frontend('/dashboard')}\n\n"
        f"— MyLink.asia jamoasi"
    )
    return _send(subject, body, email)


def _send(subject, body, email):
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
        return True
    except Exception:
        logger.warning("Invite email to %s failed", email, exc_info=True)
        return False
