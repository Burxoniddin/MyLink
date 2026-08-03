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

def _vgradient(w, h, top, bottom):
    """Vertical 2-colour gradient (rendered 1px-wide then stretched)."""
    col = Image.new('RGB', (1, h))
    for y in range(h):
        t = y / (h - 1)
        col.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return col.resize((w, h))


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


def story_png_bytes(business, url):
    """A ready-to-post 1080x1920 Instagram-story image: brand gradient, logo,
    name, description, a white QR panel and the MyLink watermark. Open to all
    tiers — it's watermarked marketing the user shares to their story."""
    W, H = 1080, 1920
    img = _vgradient(W, H, INDIGO, DEEP)
    draw = ImageDraw.Draw(img, 'RGBA')
    cx = W // 2

    # Soft decorative blobs.
    draw.ellipse((-160, -160, 220, 220), fill=(255, 255, 255, 22))
    draw.ellipse((W - 240, 120, W + 160, 540), fill=(255, 255, 255, 16))

    # Logo (circle) or initial.
    logo_size = 230
    ly = 250
    placed = False
    if business.logo:
        try:
            with Image.open(business.logo.path) as lg:
                img.paste(_circle_logo(lg, logo_size), (cx - logo_size // 2, ly), _circle_logo(lg, logo_size))
            placed = True
        except Exception:
            placed = False
    if not placed:
        draw.ellipse((cx - logo_size // 2, ly, cx + logo_size // 2, ly + logo_size), fill=(255, 255, 255, 38))
        initial = (business.name or 'M').strip()[:1].upper()
        f = _font(120, bold=True)
        bb = draw.textbbox((0, 0), initial, font=f)
        draw.text((cx - (bb[2] - bb[0]) / 2, ly + logo_size / 2 - (bb[3] - bb[1]) / 2 - bb[1]), initial, font=f, fill=(255, 255, 255, 235))

    # Name (wrapped, up to 2 lines).
    y = ly + logo_size + 60
    name_font = _font(76, bold=True)
    for line in _wrap(draw, business.name or '', name_font, W - 200)[:2]:
        _centred(draw, cx, y, line, name_font, (255, 255, 255, 255))
        y += 92

    # Description (wrapped, up to 2 lines).
    if business.description:
        y += 6
        desc_font = _font(38)
        for line in _wrap(draw, business.description, desc_font, W - 260)[:2]:
            _centred(draw, cx, y, line, desc_font, (255, 255, 255, 205))
            y += 52

    # "Scan me" pill to fill the gap above the panel.
    pill_font = _font(34, bold=True)
    pill_txt = 'SAHIFAMNI OCHING'
    pw = draw.textlength(pill_txt, font=pill_font)
    pill_y = 940
    draw.rounded_rectangle((cx - pw / 2 - 34, pill_y, cx + pw / 2 + 34, pill_y + 70), radius=35, fill=(255, 255, 255, 40))
    _centred(draw, cx, pill_y + 14, pill_txt, pill_font, (255, 255, 255, 235))

    # White QR panel.
    panel_w, panel_h = 700, 640
    px, py = cx - panel_w // 2, 1070
    draw.rounded_rectangle((px, py, px + panel_w, py + panel_h), radius=48, fill=(255, 255, 255, 255))

    qr_size = 480
    qr_im = _qr_image(url, box_size=20, border=0).resize((qr_size, qr_size), Image.NEAREST)
    img.paste(qr_im, (cx - qr_size // 2, py + 60))

    path_font = _font(38, bold=True)
    _centred(draw, cx, py + 60 + qr_size + 26, url.replace('https://', '').replace('http://', ''), path_font, (31, 27, 79))

    # Watermark (below the panel, on the gradient).
    wm_font = _font(42, bold=True)
    tag_font = _font(30)
    _centred(draw, cx, H - 132, 'MyLink.asia', wm_font, (255, 255, 255, 240))
    _centred(draw, cx, H - 82, 'Skanerlang va kuzating', tag_font, (255, 255, 255, 175))

    buf = BytesIO()
    img.convert('RGB').save(buf, format='PNG')
    return buf.getvalue()


# --------------------------------------------------------------------------- #
# PDF deliverables
# --------------------------------------------------------------------------- #

def qr_pdf_bytes(business, url):
    """A4 PDF: large centred QR + business name + URL (Pro tier)."""
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4

    # Brand logo (or initial) centred near the top.
    _draw_logo_circle(c, business, w / 2, h - 35 * mm, 18 * mm)

    size = 90 * mm
    x = (w - size) / 2
    y = h - size - 70 * mm
    c.drawImage(_image_reader(_qr_image(url, border=1)), x, y, size, size)

    c.setFillColor(colors.HexColor('#1f1b4f'))
    c.setFont('Helvetica-Bold', 26)
    c.drawCentredString(w / 2, y - 18 * mm, business.name)
    c.setFont('Helvetica', 14)
    c.setFillColorRGB(0.31, 0.27, 0.9)  # indigo
    c.drawCentredString(w / 2, y - 30 * mm, url)

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


# Vizitka colour designs, one per page-template family — the picker in the
# editor's Promomaterial tab shows the same palette swatches. 'light' means a
# light front, so front text flips to dark ink.
CARD_DESIGNS = {
    'classic':  {'front1': '#4f46e5', 'front2': '#7c3aad', 'accent': '#4f46e5', 'light': False},
    'restoran': {'front1': '#2e2017', 'front2': '#160f0b', 'accent': '#f0a23c', 'light': False},
    'moda':     {'front1': '#faf8f3', 'front2': '#efe9dd', 'accent': '#9c8466', 'light': True},
    'klinika':  {'front1': '#2aa79f', 'front2': '#17615c', 'accent': '#2aa79f', 'light': False},
    'avto':     {'front1': '#1c2028', 'front2': '#0a0b0e', 'accent': '#e11d2a', 'light': False},
    'fitnes':   {'front1': '#1c1f18', 'front2': '#0b0c0a', 'accent': '#b6f23a', 'light': False},
}


def _with_alpha(hex_color, alpha):
    r, g, b = colors.HexColor(hex_color).rgb()
    return colors.Color(r, g, b, alpha=alpha)


def card_pdf_bytes(business, url, design='classic'):
    """Double-sided 85x55 mm business card in one of the ``CARD_DESIGNS``
    palettes (unknown slugs fall back to classic).

    Every text is measured: the name shrinks to fit, description/contacts/path
    truncate with '...' — nothing can overlap or run off the card.

    Front: brand gradient, round logo, fitted name + description, thin accent
    divider, contact rows (phone / telegram / instagram), path + MyLink mark.
    Back: accent top strip, white QR panel, scan label + path."""
    d = CARD_DESIGNS.get(design) or CARD_DESIGNS['classic']
    ink = colors.HexColor('#1c1813') if d['light'] else colors.white
    ink_soft = _with_alpha('#1c1813', 0.72) if d['light'] else colors.Color(1, 1, 1, alpha=0.82)
    corner = _with_alpha(d['accent'], 0.12) if d['light'] else colors.Color(1, 1, 1, alpha=0.08)

    buf = BytesIO()
    card_w, card_h = 85 * mm, 55 * mm
    c = canvas.Canvas(buf, pagesize=(card_w, card_h))
    margin = 8 * mm
    plain_url = url.replace('https://', '').replace('http://', '')

    # ---- FRONT ----
    c.linearGradient(0, card_h, card_w, 0,
                     (colors.HexColor(d['front1']), colors.HexColor(d['front2'])), extend=True)
    # Faint corner accents, kept away from the text zones.
    c.setFillColor(corner)
    c.circle(card_w + 2 * mm, card_h + 2 * mm, 18 * mm, stroke=0, fill=1)
    c.circle(-2 * mm, -2 * mm, 14 * mm, stroke=0, fill=1)

    # Header band: round logo left, name (+ optional description) to the right.
    logo_r = 8 * mm
    logo_cx, logo_cy = margin + logo_r, card_h - 13 * mm
    _draw_logo_circle(c, business, logo_cx, logo_cy, logo_r, accent=d['accent'])

    text_x = logo_cx + logo_r + 3.5 * mm
    text_w = card_w - margin - text_x
    name = (business.name or '').strip() or 'MyLink'
    name_size = _fit_size(name, 'Helvetica-Bold', 15, 9, text_w)
    name = _truncated(name, 'Helvetica-Bold', name_size, text_w)

    c.setFillColor(ink)
    c.setFont('Helvetica-Bold', name_size)
    if business.description:
        c.drawString(text_x, card_h - 12.5 * mm, name)
        c.setFillColor(ink_soft)
        c.setFont('Helvetica', 7.5)
        c.drawString(text_x, card_h - 17.5 * mm,
                     _truncated(business.description.strip(), 'Helvetica', 7.5, text_w))
    else:
        c.drawString(text_x, card_h - 14.5 * mm, name)  # optically centred with the logo

    # Thin accent divider between the header and the contact rows.
    c.setStrokeColor(_with_alpha(d['accent'], 0.55))
    c.setLineWidth(0.8)
    c.line(margin, card_h - 23 * mm, card_w - margin, card_h - 23 * mm)

    # Contact rows pulled from the page's links: phone, Telegram, Instagram.
    contacts = business_contacts(business)
    rows = []
    if contacts['phone']:
        rows.append((colors.HexColor('#16a34a'), contacts['phone']))
    if contacts['telegram']:
        rows.append((colors.HexColor('#229ed9'), '@' + contacts['telegram']))
    if contacts['instagram']:
        rows.append((colors.HexColor('#e1306c'), '@' + contacts['instagram']))

    row_y = card_h - 29 * mm
    label_x = margin + 5 * mm
    label_w = card_w - margin - label_x
    for dot, label in rows[:3]:
        c.setFillColor(dot)
        c.circle(margin + 1.6 * mm, row_y + 1.1 * mm, 1.3 * mm, stroke=0, fill=1)
        c.setFillColor(ink)
        c.setFont('Helvetica-Bold', 8.5)
        c.drawString(label_x, row_y, _truncated(label, 'Helvetica-Bold', 8.5, label_w))
        row_y -= 5.6 * mm

    # Bottom line: page path left, MyLink mark right — measured so they never meet.
    brand = 'MyLink.asia'
    brand_w = stringWidth(brand, 'Helvetica', 7)
    c.setFillColor(ink)
    c.setFont('Helvetica-Bold', 9)
    c.drawString(margin, 6.5 * mm,
                 _truncated(plain_url, 'Helvetica-Bold', 9, card_w - 2 * margin - brand_w - 4 * mm))
    c.setFillColor(ink_soft)
    c.setFont('Helvetica', 7)
    c.drawRightString(card_w - margin, 6.5 * mm, brand)
    c.showPage()

    # ---- BACK ----
    c.setFillColor(colors.white)
    c.rect(0, 0, card_w, card_h, stroke=0, fill=1)

    # Accent strip across the top with a small brand mark.
    strip_h = 4.5 * mm
    c.setFillColor(colors.HexColor(d['accent']))
    c.rect(0, card_h - strip_h, card_w, strip_h, stroke=0, fill=1)
    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 6.5)
    c.drawCentredString(card_w / 2, card_h - strip_h + 1.4 * mm, 'MyLink.asia')

    # White QR panel, centred.
    panel = 31 * mm
    pjx = (card_w - panel) / 2
    pjy = card_h - strip_h - 3 * mm - panel
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor('#e5e7eb'))
    c.setLineWidth(0.7)
    c.roundRect(pjx, pjy, panel, panel, 3 * mm, stroke=1, fill=1)

    qr_size = 25 * mm
    c.drawImage(
        _image_reader(_qr_image(url, box_size=4, border=0)),
        (card_w - qr_size) / 2, pjy + (panel - qr_size) / 2, qr_size, qr_size,
    )

    c.setFillColor(colors.HexColor('#1f2937'))
    c.setFont('Helvetica-Bold', 8.5)
    c.drawCentredString(card_w / 2, 10.5 * mm, 'Skanerlang va kuzating')
    c.setFillColor(colors.HexColor(d['accent']))
    c.setFont('Helvetica-Bold', 9)
    c.drawCentredString(card_w / 2, 5.5 * mm,
                        _truncated(plain_url, 'Helvetica-Bold', 9, card_w - 2 * margin))

    c.showPage()
    c.save()
    return buf.getvalue()
