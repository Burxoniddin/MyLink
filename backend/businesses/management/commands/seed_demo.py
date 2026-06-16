"""Dev/QA helper: create demo accounts, businesses and promo codes.

Idempotent — safe to re-run. Guarded to DEBUG only so it can't seed weak
test passwords into production. Usage:

    python manage.py seed_demo
"""
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from billing import entitlements as ent
from billing.models import PromoCode, Subscription
from businesses.models import Business, Link, SiteSettings

User = get_user_model()


def make_user(email, phone, password, **extra):
    u = User.objects.filter(email=email).first() or User.objects.filter(phone_number=phone).first()
    if not u:
        u = User(email=email, phone_number=phone, **extra)
    else:
        u.email, u.phone_number = email, phone
        for k, v in extra.items():
            setattr(u, k, v)
    u.set_password(password)
    u.save()
    return u


DEMO_LINKS = [
    ('Telegram', 'https://t.me/mylink', 'telegram'),
    ('Murojaat uchun', 'tel:+998901234567', 'phone'),
    ('Instagram', 'https://instagram.com/mylink', 'instagram'),
    ('Tik Tok', 'https://tiktok.com/@mylink', 'tiktok'),
    ('You Tube', 'https://youtube.com/@mylink', 'youtube'),
    ('Manzil', 'https://maps.google.com', 'google_map'),
]


def make_biz(owner, path, name, template='classic', featured=False):
    b, _ = Business.objects.get_or_create(path=path, defaults={'owner': owner, 'name': name})
    b.owner = owner
    b.name = name
    b.template = template
    b.is_featured = featured
    b.save()
    if not b.links.exists():
        for i, (title, url, icon) in enumerate(DEMO_LINKS):
            Link.objects.create(business=b, title=title, url=url, icon_type=icon, order=i)
    return b


class Command(BaseCommand):
    help = 'Seed demo accounts, businesses and promo codes (DEBUG only).'

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError('seed_demo faqat DEBUG=True da ishlaydi (prod uchun emas).')

        make_user('admin@mylink.asia', '+998900000000', 'admin1234',
                  is_staff=True, is_superuser=True, is_verified=True, email_verified=True)

        free = make_user('free@mylink.asia', '+998901111111', 'test1234', is_verified=True, email_verified=True)
        make_biz(free, 'freebiz', 'Free Biznes')

        pro = make_user('pro@mylink.asia', '+998902222222', 'test1234', is_verified=True, email_verified=True)
        Subscription.objects.get_or_create(user=pro, tier=ent.PRO, expires_at=None,
                                           defaults={'source': 'manual', 'note': 'seed'})
        # Template demos (one per design; templates are open to all tiers).
        # Marked featured so the landing "clients" carousel has content to show.
        make_biz(pro, 'probiz1', 'FLAME BURGER', template='restoran', featured=True)
        make_biz(pro, 'probiz2', 'MAISON NUR', template='moda', featured=True)
        make_biz(pro, 'probiz3', 'DENTA SMILE', template='klinika', featured=True)
        make_biz(pro, 'motorhub', 'MOTOR HUB', template='avto', featured=True)
        make_biz(pro, 'pulsegym', 'PULSE GYM', template='fitnes', featured=True)

        codes = [
            dict(code='TEST1', grant_tier=ent.PRO, duration_days=None, note='Pro lifetime'),
            dict(code='PRO30', grant_tier=ent.PRO, duration_days=30, note='Pro 30 kun'),
            dict(code='ODDIY1', grant_tier=ent.ODDIY, duration_days=None, note='Oddiy lifetime'),
            dict(code='ONCE1', grant_tier=ent.PRO, duration_days=30, max_redemptions=1, note='Bir martalik'),
            dict(code='OFF1', grant_tier=ent.PRO, duration_days=None, is_active=False, note='Faolsiz'),
        ]
        for c in codes:
            PromoCode.objects.update_or_create(code=c['code'], defaults=c)

        s = SiteSettings.get_settings()
        if not s.support_telegram_url:
            s.support_telegram_url = 'https://t.me/mylink_support'
            s.contact_email = 'support@mylink.asia'
            s.save()

        self.stdout.write(self.style.SUCCESS('Seed tayyor.'))
        self.stdout.write('Admin: admin@mylink.asia / +998900000000 / admin1234')
        self.stdout.write('Free:  free@mylink.asia / test1234')
        self.stdout.write('Pro:   pro@mylink.asia / test1234')
        self.stdout.write('Promokodlar: TEST1, PRO30, ODDIY1, ONCE1, OFF1(faolsiz)')
        self.stdout.write('Shablon demolari: /probiz1(restoran) /probiz2(moda) /probiz3(klinika) /motorhub(avto) /pulsegym(fitnes) /freebiz(classic)')
