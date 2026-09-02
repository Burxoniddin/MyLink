"""QR code + PDF (business card) + Instagram-story image generation for a
business's public page.

Used by the businesses asset endpoints. Gating by tier (qr: none/png/full)
happens in the view; this module is pure rendering. PDF text uses Helvetica
(Latin, covers Uzbek-Latin); the story image uses reportlab's bundled Vera
TTFs so PIL has a real font on the Linux server too.
"""

import os
from io import BytesIO

import qrcode
import reportlab
from PIL import Image, ImageDraw, ImageFont, ImageOps
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

# Brand palette.
INDIGO = (79, 70, 229)
VIOLET = (124, 58, 173)
DEEP = (49, 46, 129)

_FONT_DIR = os.path.join(os.path.dirname(reportlab.__file__), 'fonts')


def _font(size, bold=False):
    return ImageFont.truetype(os.path.join(_FONT_DIR, 'VeraBd.ttf' if bold else 'Vera.ttf'), size)


def _qr_image(url, box_size=10, border=2, fill='black'):
    """Return a PIL image of the QR for ``url``."""
    qr = qrcode.QRCode(
        box_size=box_size,
        border=border,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
    )
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(fill_color=fill, back_color='white').convert('RGB')


def _image_reader(pil_img):
    buf = BytesIO()
    pil_img.save(buf, format='PNG')
    buf.seek(0)
    return ImageReader(buf)


def qr_png_bytes(url):
    """PNG bytes of the QR — the Oddiy-tier deliverable."""
    buf = BytesIO()
    _qr_image(url).save(buf, format='PNG')
    return buf.getvalue()


def _handle_from_url(url):
    """Last path segment of a profile URL, e.g. t.me/shop -> 'shop'."""
    s = (url or '').split('?')[0].strip().rstrip('/')
    s = s.replace('https://', '').replace('http://', '')
    parts = [p for p in s.split('/') if p]
    return parts[-1] if len(parts) >= 2 else ''


def business_contacts(business):
    """Pull phone / Telegram / Instagram off a business's links for the card.

    Returns the first match of each as ``{'phone', 'telegram', 'instagram'}``
    (usernames without the leading @)."""
    phone = telegram = instagram = ''
    for link in business.links.all():
        u = (link.url or '').strip()
        it = link.icon_type
        if not phone and (it in ('phone', 'telegram_number') or u.startswith('tel:')):
            phone = u.replace('tel:', '').strip()
        elif not telegram and it == 'telegram':
            telegram = _handle_from_url(u).lstrip('@')
        elif not instagram and it == 'instagram':
            instagram = _handle_from_url(u).lstrip('@')
    return {'phone': phone, 'telegram': telegram, 'instagram': instagram}


# --------------------------------------------------------------------------- #
# PIL helpers (Instagram story)
# --------------------------------------------------------------------------- #

def _circle_logo(pil_img, size):
    """Crop ``pil_img`` to a centred circle of ``size`` px (RGBA)."""
    img = ImageOps.fit(pil_img.convert('RGB'), (size, size), Image.LANCZOS)
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def _wrap(draw, text, font, max_w):
    lines, cur = [], ''
    for word in text.split():
        test = (cur + ' ' + word).strip()
        if draw.textlength(test, font=font) <= max_w or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    return lines


def _centred(draw, cx, y, text, font, fill):
    w = draw.textlength(text, font=font)
    draw.text((cx - w / 2, y), text, font=font, fill=fill)


_ASSETS_DIR = os.path.join(os.path.dirname(__file__), 'assets')


def story_png_bytes(business, url):
    """A ready-to-post 1080x1920 Instagram-story image on the branded chain
    background (assets/story_bg.jpg): a white rounded card carrying the logo
    disc, business name, page QR and bio, with the page URL underneath.
    Open to all tiers — it's branded marketing the user shares to their story."""
    W, H = 1080, 1920
    img = Image.open(os.path.join(_ASSETS_DIR, 'story_bg.jpg')).convert('RGB')
    if img.size != (W, H):
        img = img.resize((W, H), Image.LANCZOS)
    draw = ImageDraw.Draw(img, 'RGBA')
    cx = W // 2

    # White rounded card (shorter when there is no bio under the QR).
    card_l, card_r, card_t = 190, 890, 521
    card_b = 1393 if business.description else 1265
    draw.rounded_rectangle((card_l, card_t, card_r, card_b), radius=56, fill=(255, 255, 255, 255))

    # Logo disc straddling the card's top edge: white ring + logo or initials.
    ring_r, logo_r, ly = 68, 58, card_t - 3
    draw.ellipse((cx - ring_r, ly - ring_r, cx + ring_r, ly + ring_r), fill=(255, 255, 255, 255))
    placed = False
    if business.logo:
        try:
            with Image.open(business.logo.path) as lg:
                circ = _circle_logo(lg, logo_r * 2)
            img.paste(circ, (cx - logo_r, ly - logo_r), circ)
            placed = True
        except Exception:
            placed = False
    if not placed:
        draw.ellipse((cx - logo_r, ly - logo_r, cx + logo_r, ly + logo_r), fill=(59, 130, 246, 255))
        initials = ''.join(w[0] for w in (business.name or 'M').split()[:2]).upper()
        f = _font(50, bold=True)
        bb = draw.textbbox((0, 0), initials, font=f)
        draw.text((cx - (bb[2] - bb[0]) / 2 - bb[0], ly - (bb[3] - bb[1]) / 2 - bb[1]),
                  initials, font=f, fill=(255, 255, 255, 255))

    # Business name — shrinks to fit the card, hard-truncates as a last resort.
    name = (business.name or 'MyLink').strip()
    max_w = card_r - card_l - 70
    size = 50
    name_font = _font(size, bold=True)
    while size > 28 and draw.textlength(name, font=name_font) > max_w:
        size -= 2
        name_font = _font(size, bold=True)
    if draw.textlength(name, font=name_font) > max_w:
        while name and draw.textlength(name + '...', font=name_font) > max_w:
            name = name[:-1]
        name += '...'
    _centred(draw, cx, 612, name, name_font, (17, 17, 17))

    # Page QR.
    qr_size = 470
    qr_im = _qr_image(url, box_size=20, border=0).resize((qr_size, qr_size), Image.NEAREST)
    img.paste(qr_im, (cx - qr_size // 2, 722))

    # Bio: up to 2 centred lines under the QR ('...' when cut short).
    if business.description:
        bio_font = _font(32)
        bio_w = card_r - card_l - 90
        lines = _wrap(draw, business.description.strip(), bio_font, bio_w)
        y = 1240
        for i, line in enumerate(lines[:2]):
            if i == 1 and len(lines) > 2:
                while line and draw.textlength(line + '...', font=bio_font) > bio_w:
                    line = line[:-1]
                line += '...'
            _centred(draw, cx, y, line, bio_font, (45, 45, 45))
            y += 46

    # Page URL below the card.
    plain = url.replace('https://', '').replace('http://', '')
    _centred(draw, cx, card_b + 72, plain, _font(48), (255, 255, 255, 242))

    buf = BytesIO()
    img.save(buf, format='PNG')
    return buf.getvalue()


# --------------------------------------------------------------------------- #
# PDF deliverables
# --------------------------------------------------------------------------- #

def _wrap_pdf(text, font, size, max_w, max_lines=2):
    """stringWidth asosida so'zma-so'z o'rash; oxirgi qator '...' bilan kesiladi."""
    lines, cur = [], ''
    for word in text.split():
        test = (cur + ' ' + word).strip()
        if stringWidth(test, font, size) <= max_w or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = word
    if cur:
        lines.append(cur)
    if len(lines) > max_lines:
        last = lines[max_lines - 1]
        while last and stringWidth(last + '...', font, size) > max_w:
            last = last[:-1]
        lines = lines[:max_lines - 1] + [last + '...']
    return lines


def _bio_layout(text, max_w, zone_t, zone_b, k):
    """Stend bio bloki: zonaga sig'adigan eng katta o'lchamni tanlab, qatorlarni
    zona bo'yicha markazlaydi. Qaytaradi: (o'lcham, qatorlar, oraliq, 1-baseline).

    ``k`` — px -> pt koeffitsienti; zona chegaralari rasm pikselida."""
    zone_h = zone_b - zone_t

    def metrics(size, n):
        leading, cap = size * 1.2 / k, size * 0.72 / k
        return leading, cap, (n - 1) * leading + cap

    size_used, lines = 10.5, None
    for size in (16.5, 15.5, 14.5, 13.5, 12.5, 11.5, 10.5):
        wrapped = _wrap_pdf(text, 'Helvetica-Bold', size, max_w, max_lines=99)
        if len(wrapped) <= 3 and metrics(size, len(wrapped))[2] <= zone_h:
            size_used, lines = size, wrapped
            break
    if lines is None:  # juda uzun — eng kichik o'lchamda 3 qatorga kesiladi
        lines = _wrap_pdf(text, 'Helvetica-Bold', size_used, max_w, max_lines=3)

    leading, cap, block = metrics(size_used, len(lines))
    first = zone_t + cap + max(0, (zone_h - block) / 2)
    return size_used, lines, leading, first


# Stend geometriyasi — assets/stand_bg.jpg (2481x3508 px, 300dpi A4) ichidagi
# dizayn elementlarining piksel koordinatalari (dizayn SVG'idan o'lchangan).
_STAND = {
    'card': (607, 897, 1873, 2478, 92),   # l, t, r, b, burchak radiusi
    'avatar': (1225, 898, 111, 128),      # cx, cy, logo r, oq halqa r
    'name_base': 1150,                    # nom baseline (px, tepadan)
    'qr_top': 1215,
    'qr_size': 920,
    'bio_zone': (2210, 2405),             # bio bloki markazlanadigan oraliq
}


def qr_pdf_bytes(business, url):
    """A4 stend PDF: brendlangan zanjirli fon (assets/stand_bg.jpg) ustiga oq
    karta qayta chizilib, ichiga logo/avatar, biznes nomi, QR va bio tushadi.
    Statik matnlar (BIZNI KUZATING!, ikonkalar, MyLink) fonda tayyor turadi;
    fondagi namunaviy karta to'liq ustidan yopiladi."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    k = w / 2481.0  # px -> pt

    def X(px):
        return px * k

    def Y(px):  # rasm (tepadan) -> PDF (pastdan)
        return h - px * k

    c.drawImage(os.path.join(_ASSETS_DIR, 'stand_bg.jpg'), 0, 0, w, h)

    l, t, r, b, rad = _STAND['card']
    c.setFillColor(colors.white)
    c.roundRect(X(l) - 1, Y(b) - 1, (r - l) * k + 2, (b - t) * k + 2, rad * k, stroke=0, fill=1)

    # Avatar: oq halqa + logo yoki bosh harflar (fondagi namunani ham yopadi).
    acx, acy, logo_r, ring_r = _STAND['avatar']
    c.setFillColor(colors.white)
    c.circle(X(acx), Y(acy), ring_r * k, stroke=0, fill=1)
    logo = _logo_reader(business)
    if logo is not None:
        c.drawImage(logo, X(acx) - logo_r * k, Y(acy) - logo_r * k,
                    2 * logo_r * k, 2 * logo_r * k, mask='auto')
    else:
        c.setFillColor(colors.HexColor('#3b82f6'))
        c.circle(X(acx), Y(acy), logo_r * k, stroke=0, fill=1)
        initials = ''.join(wd[0] for wd in (business.name or 'M').split()[:2]).upper()
        c.setFillColor(colors.white)
        c.setFont('Helvetica-Bold', logo_r * k * 0.8)
        c.drawCentredString(X(acx), Y(acy) - logo_r * k * 0.28, initials)

    cx = (l + r) / 2.0
    max_w = (r - l) * k - 2 * 70 * k

    name = (business.name or 'MyLink').strip()
    name_size = _fit_size(name, 'Helvetica-Bold', 24, 13, max_w)
    name = _truncated(name, 'Helvetica-Bold', name_size, max_w)
    c.setFillColor(colors.HexColor('#111111'))
    c.setFont('Helvetica-Bold', name_size)
    c.drawCentredString(X(cx), Y(_STAND['name_base']), name)

    qs = _STAND['qr_size']
    c.drawImage(_image_reader(_qr_image(url, box_size=28, border=0)),
                X(cx) - qs * k / 2, Y(_STAND['qr_top'] + qs), qs * k, qs * k)

    if business.description:
        # Bio kartani to'ldiradi: 3 qatorga sig'adigan eng katta o'lcham
        # tanlanadi (dizayn namunasida ~16.5pt), blok zonada markazlanadi.
        zone_t, zone_b = _STAND['bio_zone']
        bio_size, lines, leading, first = _bio_layout(
            business.description.strip(), max_w, zone_t, zone_b, k)
        c.setFillColor(colors.HexColor('#1f2937'))
        c.setFont('Helvetica-Bold', bio_size)
        for i, line in enumerate(lines):
            c.drawCentredString(X(cx), Y(first + i * leading), line)

    c.showPage()
    c.save()
    return buf.getvalue()


def _logo_reader(business, size_px=320):
    """Circular-cropped PNG ImageReader of the logo (None if absent/unreadable)
    so PDFs never paste a rectangular logo over the round disc."""
    if not business.logo:
        return None
    try:
        with Image.open(business.logo.path) as lg:
            circ = _circle_logo(lg, size_px)
        buf = BytesIO()
        circ.save(buf, format='PNG')
        buf.seek(0)
        return ImageReader(buf)
    except Exception:
        return None


def _draw_logo_circle(c, business, cx, cy, r, accent='#4f46e5'):
    """White disc filled by the circular-cropped logo (or the brand initial)."""
    c.setFillColor(colors.white)
    c.circle(cx, cy, r, stroke=0, fill=1)
    logo = _logo_reader(business)
    if logo is not None:
        c.drawImage(logo, cx - r, cy - r, r * 2, r * 2, mask='auto')
        return
    c.setFillColor(colors.HexColor(accent))
    c.setFont('Helvetica-Bold', r * 1.1)
    c.drawCentredString(cx, cy - r * 0.38, (business.name or 'M').strip()[:1].upper())


def _fit_size(text, font, max_size, min_size, max_width):
    """Largest font size (stepping down) at which ``text`` fits ``max_width``."""
    size = max_size
    while size > min_size and stringWidth(text, font, size) > max_width:
        size -= 0.5
    return size


def _truncated(text, font, size, max_width):
    """``text`` cut with '...' so it never draws past ``max_width``."""
    if stringWidth(text, font, size) <= max_width:
        return text
    while text and stringWidth(text + '...', font, size) > max_width:
        text = text[:-1]
    return (text + '...') if text else ''


# Vizitka foni biznes sahifasining amaldagi temasidan olinadi (frontend
# lib/palettes.js va templates/templateMeta.js bilan sinxron qiymatlar).
_CLASSIC_PALETTES = {
    'default': ('#312e81', '#0f0f1a', '#6366f1'),
    'ocean':   ('#0b2545', '#0f3d5e', '#0ea5e9'),
    'forest':  ('#0c1f17', '#14352a', '#16a34a'),
    'noir':    ('#1c1c20', '#070708', '#a1a1aa'),
    'rose':    ('#2a0f1f', '#3d1330', '#e11d6b'),
    'sunset':  ('#2a160b', '#3d2413', '#f97316'),
}
_TEMPLATE_COLORS = {
    'restoran': ('#2e2017', '#160f0b', '#f0a23c', False),
    'moda':     ('#faf8f3', '#efe9dd', '#9c8466', True),
    'klinika':  ('#f7fbfb', '#e2efee', '#2aa79f', True),
    'avto':     ('#1c2028', '#0a0b0e', '#e11d2a', False),
    'fitnes':   ('#1c1f18', '#0b0c0a', '#b6f23a', False),
}


def _fmt_phone(phone):
    """+998901234567 -> '+998 90 123 45 67' (boshqa formatlar o'z holicha)."""
    p = phone.replace(' ', '')
    if p.startswith('+998') and len(p) == 13 and p[1:].isdigit():
        return f"{p[:4]} {p[4:6]} {p[6:9]} {p[9:11]} {p[11:]}"
    return phone


def _card_theme(business):
    """(c1, c2, accent, light) — sahifa shabloni/palitrasi/rejimidan."""
    tpl = business.template or 'classic'
    mode = business.theme_mode or ''
    if tpl == 'classic':
        c1, c2, accent = _CLASSIC_PALETTES.get(business.theme or 'default',
                                               _CLASSIC_PALETTES['default'])
        if mode == 'light':
            return '#f8fafc', '#e9edf5', accent, True
        return c1, c2, accent, False
    c1, c2, accent, light = _TEMPLATE_COLORS.get(tpl, _TEMPLATE_COLORS['restoran'])
    if mode == 'light' and not light:
        return '#f6f5f2', '#eae8e3', accent, True
    if mode == 'dark' and light:
        return '#1c1a16', '#0e0d0b', accent, False
    return c1, c2, accent, light


def _chip_icon(kind):
    """Kontakt chipi uchun haqiqiy brend ikonkasi (assets/chips/*.png —
    react-icons'dagi rasmiy SVG'lardan oldindan render qilingan)."""
    return os.path.join(_ASSETS_DIR, 'chips', f'{kind}.png')


# Vizitka geometriyasi — Figma dizaynidan ("Business card Mylink", ikki yuz
# 1062x590 px = 90x50 mm @300dpi). Barcha qiymatlar dizayn pikselida, _CARD_K
# orqali pt ga o'giriladi; shu bois joylashuv dizayn bilan bir xil bo'ladi.
_CARD_W, _CARD_H = 90 * mm, 50 * mm
_CARD_K = _CARD_W / 1062.0

_CARD_FRONT = {
    'avatar': (531, 228, 88, 90),     # cx, cy, foto radiusi, halqa radiusi
    'name': (402, 12.7),              # baseline, maksimal o'lcham
    'desc': (453, 7.3),               # 1-qator baseline, o'lcham
    'pad': 100,                       # chap/o'ng hoshiya
}
_CARD_BACK = {
    'avatar': (137, 137, 35, 36.5),
    'name': (204, 136, 7.7),          # x, baseline, o'lcham
    'desc': (203, 160, 5.2),
    'url': (831, 160, 5.2),           # markaz x, baseline, o'lcham
    'chip': (100, 354, 74, 23),       # x, eni, balandligi, radius
    'chip_tops': (228, 322, 415),
    'chip_icon': (115, 45),           # x, o'lcham (kvadrat)
    'chip_label': (180, 46, 7.35),    # x, chip tepasidan baseline, o'lcham
    'qr': (700, 228, 262, 222),       # x, y, oq kvadrat, ichidagi modul zonasi
}

# Chip glow ranglari — dizayndagidek platforma ranglari.
_CHIP_COLORS = {'phone': '#34c759', 'telegram': '#229ed9', 'instagram': '#d6249f'}


def _avatar(c, business, cx, cy, r, ring_w, accent, light):
    """Dumaloq logo (yo'q bo'lsa — bosh harf) va atrofida nozik halqa."""
    logo = _logo_reader(business)
    if logo is not None:
        c.drawImage(logo, cx - r, cy - r, r * 2, r * 2, mask='auto')
    else:
        c.setFillColor(colors.HexColor(accent))
        c.circle(cx, cy, r, stroke=0, fill=1)
        c.setFillColor(colors.white)
        c.setFont('Helvetica-Bold', r * 1.05)
        c.drawCentredString(cx, cy - r * 0.36, (business.name or 'M').strip()[:1].upper())
    c.setStrokeColor(colors.HexColor('#3f3f46') if light else colors.HexColor('#f6f6f6'))
    c.setLineWidth(ring_w)
    c.circle(cx, cy, r + ring_w / 2, stroke=1, fill=0)


def _chip_glow(c, x, y, w, h, r, hex_color, spread, steps=9, peak=0.15):
    """Chip atrofidagi rangli yorug'lik — tashqariga qarab so'nuvchi konturlar."""
    red, green, blue = colors.HexColor(hex_color).rgb()
    for i in range(steps, 0, -1):
        t = i / steps                       # 1 — eng tashqi halqa
        d = spread * t
        c.setStrokeColor(colors.Color(red, green, blue, alpha=peak * (1 - t) ** 1.5))
        c.setLineWidth(spread / steps * 1.8)
        c.roundRect(x - d, y - d, w + 2 * d, h + 2 * d, r + d, stroke=1, fill=0)
    c.setStrokeAlpha(1)


def card_pdf_bytes(business, url):
    """Ikki tomonlama 90x55 mm vizitka — Figma dizayni bo'yicha; fon rangi
    biznes sahifasining amaldagi temasidan olinadi (faqat fon almashadi).

    Old tomon: markazda dumaloq logo, ostida nom va tavsif.
    Orqa tomon: tepada kichik logo + nom/tavsif (chapda) va sahifa linki
    (QR ustida markazda); pastda chapda kontakt chiplari (platforma rangli
    yorug'lik bilan), o'ngda oq QR kvadrat."""
    c1, c2, accent, light = _card_theme(business)
    ink = colors.HexColor('#1c1813') if light else colors.white
    ink_soft = (colors.Color(0.11, 0.09, 0.07, alpha=0.72) if light
                else colors.Color(1, 1, 1, alpha=0.82))

    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=(_CARD_W, _CARD_H))
    k = _CARD_K

    def X(px):
        return px * k

    def Y(px):                     # dizayn (tepadan) -> PDF (pastdan)
        return _CARD_H - px * k

    def bg():
        c.linearGradient(0, _CARD_H, _CARD_W, 0,
                         (colors.HexColor(c1), colors.HexColor(c2)), extend=True)

    name = (business.name or '').strip() or 'MyLink'
    desc = (business.description or '').strip()
    plain_url = url.replace('https://', '').replace('http://', '')

    # ------------------------------ OLD TOMON ------------------------------
    bg()
    acx, acy, ar, ring = _CARD_FRONT['avatar']
    _avatar(c, business, X(acx), Y(acy), X(ar), X(ring - ar), accent, light)

    pad = _CARD_FRONT['pad']
    max_w = X(1062 - 2 * pad)
    base, max_size = _CARD_FRONT['name']
    size = _fit_size(name, 'Helvetica-Bold', max_size, 8, max_w)
    c.setFillColor(ink)
    c.setFont('Helvetica-Bold', size)
    c.drawCentredString(X(531), Y(base), _truncated(name, 'Helvetica-Bold', size, max_w))

    if desc:
        base, size = _CARD_FRONT['desc']
        lines = _wrap_pdf(desc, 'Helvetica', size, max_w, max_lines=2)
        c.setFillColor(ink_soft)
        c.setFont('Helvetica', size)
        for i, line in enumerate(lines):
            c.drawCentredString(X(531), Y(base + i * size * 1.35 / k), line)
    c.showPage()

    # ------------------------------ ORQA TOMON -----------------------------
    bg()
    acx, acy, ar, ring = _CARD_BACK['avatar']
    _avatar(c, business, X(acx), Y(acy), X(ar), X(ring - ar), accent, light)

    qx, qy, qbox, qmod = _CARD_BACK['qr']
    head_w = X(qx - 30) - X(_CARD_BACK['name'][0])      # QR ustunigacha
    nx, nbase, nsize = _CARD_BACK['name']
    c.setFillColor(ink)
    c.setFont('Helvetica-Bold', nsize)
    c.drawString(X(nx), Y(nbase), _truncated(name, 'Helvetica-Bold', nsize, head_w))
    if desc:
        dx, dbase, dsize = _CARD_BACK['desc']
        c.setFillColor(ink_soft)
        c.setFont('Helvetica', dsize)
        c.drawString(X(dx), Y(dbase), _truncated(desc, 'Helvetica', dsize, head_w))

    ux, ubase, usize = _CARD_BACK['url']
    c.setFillColor(ink_soft)
    c.setFont('Helvetica', usize)
    c.drawCentredString(X(ux), Y(ubase), plain_url)

    # QR — oq kvadrat, ichida modullar (dizayndagi oq hoshiya saqlanadi).
    c.setFillColor(colors.white)
    c.rect(X(qx), Y(qy + qbox), X(qbox), X(qbox), stroke=0, fill=1)
    c.drawImage(_image_reader(_qr_image(url, box_size=8, border=0)),
                X(qx + (qbox - qmod) / 2), Y(qy + (qbox + qmod) / 2), X(qmod), X(qmod))

    # Kontakt chiplari: telefon / Telegram / Instagram.
    contacts = business_contacts(business)
    rows = []
    if contacts['phone']:
        rows.append(('phone', _fmt_phone(contacts['phone'])))
    if contacts['telegram']:
        rows.append(('telegram', '@' + contacts['telegram']))
    if contacts['instagram']:
        rows.append(('instagram', '@' + contacts['instagram']))

    cx_, cw, ch, crad = _CARD_BACK['chip']
    icon_x, icon_sz = _CARD_BACK['chip_icon']
    lab_x, lab_dy, lab_size = _CARD_BACK['chip_label']
    lab_w = X(cx_ + cw - 20 - lab_x)
    # Uchala yozuv bir xil o'lchamda bo'lishi uchun eng uzuniga qarab tanlanadi.
    if rows:
        lab_size = min(_fit_size(lbl, 'Helvetica', lab_size, 5.8, lab_w) for _, lbl in rows[:3])
    for (kind, label), top in zip(rows[:3], _CARD_BACK['chip_tops']):
        x, y, w, h = X(cx_), Y(top + ch), X(cw), X(ch)
        _chip_glow(c, x, y, w, h, X(crad), _CHIP_COLORS[kind], X(14))
        c.setFillColor(colors.Color(0, 0, 0, alpha=0.05) if light
                       else colors.Color(1, 1, 1, alpha=0.045))
        c.setStrokeColor(colors.Color(0, 0, 0, alpha=0.35) if light
                         else colors.Color(1, 1, 1, alpha=0.5))
        c.setLineWidth(0.5)
        c.roundRect(x, y, w, h, X(crad), stroke=1, fill=1)
        c.setFillAlpha(1)
        c.setStrokeAlpha(1)
        c.drawImage(_chip_icon(kind), X(icon_x), Y(top + (ch + icon_sz) / 2),
                    X(icon_sz), X(icon_sz), mask='auto')
        c.setFillColor(ink)
        c.setFont('Helvetica', lab_size)
        c.drawString(X(lab_x), Y(top + lab_dy),
                     _truncated(label, 'Helvetica', lab_size, lab_w))

    c.showPage()
    c.save()
    return buf.getvalue()
