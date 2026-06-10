"""Role-based access helpers for team membership (4e).

Resolves a user's effective role on a business (owner + the three membership
roles) and gates view access by a minimum required role. Feature gates for a
shared business should follow the *owner's* tier, not the acting member's — use
``business.owner`` with ``billing.services.get_entitlements`` for that.
"""
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from .models import Business, BusinessMembership

ROLE_OWNER = 'owner'
ROLE_ADMIN = BusinessMembership.ROLE_ADMIN
ROLE_EDITOR = BusinessMembership.ROLE_EDITOR
ROLE_VIEWER = BusinessMembership.ROLE_VIEWER

# Strength ordering — a role grants everything its rank and below requires.
ROLE_RANK = {ROLE_VIEWER: 1, ROLE_EDITOR: 2, ROLE_ADMIN: 3, ROLE_OWNER: 4}


def role_for(user, business):
    """Return the user's effective role on ``business`` ('owner' | role | None)."""
    if not user or not getattr(user, 'is_authenticated', False):
        return None
    if business.owner_id == user.id:
        return ROLE_OWNER
    m = BusinessMembership.objects.filter(business=business, user=user).first()
    return m.role if m else None


def require_role(user, business, min_role=ROLE_VIEWER):
    """Ensure ``user`` meets ``min_role`` on ``business``; return their role.

    Raises ``Http404`` if the user has no access at all (don't leak existence) and
    ``PermissionDenied`` (reason ``role``) if they have access but rank too low."""
    role = role_for(user, business)
    if role is None:
        raise Http404
    if ROLE_RANK[role] < ROLE_RANK[min_role]:
        raise PermissionDenied({'reason': 'role', 'required': min_role})
    return role


def get_business_or_404(user, path, min_role=ROLE_VIEWER):
    """Fetch a business by path and enforce ``min_role``. Returns (business, role)."""
    business = get_object_or_404(Business, path=path)
    role = require_role(user, business, min_role)
    return business, role


def accessible_businesses(user):
    """Businesses the user owns or is an (accepted) member of."""
    return (
        Business.objects
        .filter(Q(owner=user) | Q(memberships__user=user))
        .distinct()
    )


def claim_pending_invites(user):
    """Attach any pending invites addressed to this user's email/phone.

    Called right after account creation (register / Google / phone-OTP signup) so
    a person invited before signing up lands on the team automatically. Returns the
    number of invites claimed."""
    if not user:
        return 0
    cond = Q()
    if getattr(user, 'email', None):
        cond |= Q(invite_email__iexact=user.email)
    if getattr(user, 'phone_number', None):
        cond |= Q(invite_phone=user.phone_number)
    if not cond.children:
        return 0

    pending = BusinessMembership.objects.filter(user__isnull=True).filter(cond).select_related('business')
    claimed = 0
    for m in pending:
        # Drop the invite if it's now redundant (already owner / already a member).
        if m.business.owner_id == user.id or \
                BusinessMembership.objects.filter(business=m.business, user=user).exists():
            m.delete()
            continue
        m.user = user
        m.accepted_at = timezone.now()
        m.save(update_fields=['user', 'accepted_at'])
        claimed += 1
    return claimed
