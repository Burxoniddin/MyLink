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


# Stend geometriyasi — assets/stand_bg.jpg (2481x3508 px, 300dpi A4) ichidagi
# dizayn elementlarining piksel koordinatalari (dizayn SVG'idan o'lchangan).
_STAND = {
    'card': (607, 897, 1873, 2478, 64),   # l, t, r, b, burchak radiusi
    'avatar': (1225, 898, 111, 128),      # cx, cy, logo r, oq halqa r
    'name_base': 1150,                    # nom baseline (px, tepadan)
    'qr_top': 1269,
    'qr_size': 820,
    'bio_base': (2259, 2352),             # bio 2 qator baseline
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
        bio_size = 11.5
        lines = _wrap_pdf(business.description.strip(), 'Helvetica', bio_size, max_w)
        c.setFillColor(colors.HexColor('#2d2d2d'))
        c.setFont('Helvetica', bio_size)
        for i, line in enumerate(lines[:2]):
            c.drawCentredString(X(cx), Y(_STAND['bio_base'][i]), line)

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


def _chip_icon(kind, size=128):
    """Kontakt chipi uchun platforma ikonkasi (PIL, RGBA)."""
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == 'phone':
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.3),
                            fill=(34, 197, 94, 255))
        # Trubka: pastga ochilgan yarim halqa + ikki uchida dumaloq "quloqcha".
        d.arc((28, 34, 100, 106), start=195, end=345, fill=(255, 255, 255, 255), width=17)
        d.ellipse((22, 52, 46, 76), fill=(255, 255, 255, 255))
        d.ellipse((82, 52, 106, 76), fill=(255, 255, 255, 255))
    elif kind == 'telegram':
        d.ellipse((0, 0, size - 1, size - 1), fill=(34, 158, 217, 255))
        d.polygon([(26, 62), (100, 32), (80, 98), (60, 76), (52, 92), (50, 66)],
                  fill=(255, 255, 255, 255))
    else:  # instagram
        d.rounded_rectangle((0, 0, size - 1, size - 1), radius=int(size * 0.3),
                            fill=(214, 51, 108, 255))
        d.rounded_rectangle((28, 28, 100, 100), radius=22, outline=(255, 255, 255, 255), width=9)
        d.ellipse((47, 47, 81, 81), outline=(255, 255, 255, 255), width=9)
        d.ellipse((84, 34, 96, 46), fill=(255, 255, 255, 255))
    return _image_reader(img)


def card_pdf_bytes(business, url):
    """Ikki tomonlama 85x55 mm vizitka; fon rangi biznes sahifasi temasidan.

    Old tomon: tema-gradient fonda chapda dumaloq logo, o'ngida nom va tavsif.
    Orqa tomon: tepada kichik logo+nom+tavsif (chap) va sahifa linki (o'ng),
    pastki chapda oq kontakt chiplari (telefon/Telegram/Instagram), o'ngda oq
    QR paneli. Har bir matn o'lchanadi: nom kichrayadi, qolganlari '...' bilan
    kesiladi."""
    c1, c2, accent, light = _card_theme(business)
    ink = colors.HexColor('#1c1813') if light else colors.white
    ink_soft = (colors.Color(0.11, 0.09, 0.07, alpha=0.7) if light
                else colors.Color(1, 1, 1, alpha=0.78))

    buf = BytesIO()
    card_w, card_h = 85 * mm, 55 * mm
    c = canvas.Canvas(buf, pagesize=(card_w, card_h))
    margin = 8 * mm
    plain_url = url.replace('https://', '').replace('http://', '')

    def bg():
        c.linearGradient(0, card_h, card_w, 0,
                         (colors.HexColor(c1), colors.HexColor(c2)), extend=True)

    def logo_disc(cx, cy, r):
        c.setFillColor(colors.white)
        c.circle(cx, cy, r + 0.6 * mm, stroke=0, fill=1)
        _draw_logo_circle(c, business, cx, cy, r, accent=accent)

    # ---- OLD TOMON ----
    bg()
    logo_r = 9 * mm
    logo_cx, logo_cy = margin + logo_r + 2 * mm, card_h / 2
    logo_disc(logo_cx, logo_cy, logo_r)

    text_x = logo_cx + logo_r + 5 * mm
    text_w = card_w - margin - text_x
    name = (business.name or '').strip() or 'MyLink'
    name_size = _fit_size(name, 'Helvetica-Bold', 16, 10, text_w)
    name = _truncated(name, 'Helvetica-Bold', name_size, text_w)
    c.setFillColor(ink)
    c.setFont('Helvetica-Bold', name_size)
    if business.description:
        c.drawString(text_x, card_h / 2 + 1.2 * mm, name)
        c.setFillColor(ink_soft)
        c.setFont('Helvetica', 8)
        c.drawString(text_x, card_h / 2 - 4.8 * mm,
                     _truncated(business.description.strip(), 'Helvetica', 8, text_w))
    else:
        c.drawString(text_x, card_h / 2 - name_size * 0.36, name)
    c.showPage()

    # ---- ORQA TOMON ----
    bg()

    # Tepada: kichik logo + nom + tavsif (chapda), sahifa linki (o'ngda).
    m_r = 4 * mm
    logo_disc(margin + m_r, card_h - 8.5 * mm, m_r)
    url_w = stringWidth(plain_url, 'Helvetica', 7)
    head_x = margin + 2 * m_r + 3 * mm
    head_w = card_w - margin - head_x - url_w - 3 * mm
    c.setFillColor(ink)
    c.setFont('Helvetica-Bold', 8.5)
    c.drawString(head_x, card_h - 8 * mm,
                 _truncated(name, 'Helvetica-Bold', 8.5, head_w))
    if business.description:
        c.setFillColor(ink_soft)
        c.setFont('Helvetica', 5.5)
        c.drawString(head_x, card_h - 11.2 * mm,
                     _truncated(business.description.strip(), 'Helvetica', 5.5, head_w))
    c.setFillColor(ink_soft)
    c.setFont('Helvetica', 7)
    c.drawRightString(card_w - margin, card_h - 8.5 * mm, plain_url)

    # O'ngda oq QR paneli.
    panel = 30 * mm
    px_, py_ = card_w - 7 * mm - panel, 5.5 * mm
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor('#e5e7eb') if light else colors.Color(1, 1, 1, alpha=0.25))
    c.setLineWidth(0.6)
    c.roundRect(px_, py_, panel, panel, 3 * mm, stroke=1, fill=1)
    qr_size = 26 * mm
    c.drawImage(_image_reader(_qr_image(url, box_size=6, border=0)),
                px_ + (panel - qr_size) / 2, py_ + (panel - qr_size) / 2, qr_size, qr_size)

    # Pastki chapda kontakt chiplari (rasmdagidek oq pill + platforma ikonkasi).
    contacts = business_contacts(business)
    rows = []
    if contacts['phone']:
        rows.append(('phone', _fmt_phone(contacts['phone'])))
    if contacts['telegram']:
        rows.append(('telegram', '@' + contacts['telegram']))
    if contacts['instagram']:
        rows.append(('instagram', '@' + contacts['instagram']))

    chip_h, chip_gap = 7 * mm, 1.8 * mm
    chip_zone_r = px_ - 3 * mm
    chip_max_w = chip_zone_r - margin
    chip_y = card_h - 8.5 * mm - m_r - 6 * mm - chip_h  # header ostidan boshlab
    icon = 4.6 * mm
    for kind, label in rows[:3]:
        label = _truncated(label, 'Helvetica-Bold', 7.5, chip_max_w - icon - 6 * mm)
        chip_w = min(chip_max_w, icon + 6 * mm + stringWidth(label, 'Helvetica-Bold', 7.5))
        c.setFillColor(colors.white)
        c.setStrokeColor(colors.HexColor('#e5e7eb') if light else colors.Color(1, 1, 1, alpha=0.18))
        c.setLineWidth(0.5)
        c.roundRect(margin, chip_y, chip_w, chip_h, chip_h / 2, stroke=1, fill=1)
        c.drawImage(_chip_icon(kind), margin + 1.7 * mm, chip_y + (chip_h - icon) / 2,
                    icon, icon, mask='auto')
        c.setFillColor(colors.HexColor('#1f2937'))
        c.setFont('Helvetica-Bold', 7.5)
        c.drawString(margin + 1.7 * mm + icon + 2 * mm, chip_y + chip_h / 2 - 1.2 * mm, label)
        chip_y -= chip_h + chip_gap

    c.showPage()
    c.save()
    return buf.getvalue()
