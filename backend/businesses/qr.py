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

    size = 90 * mm
    x = (w - size) / 2
    y = h - size - 45 * mm
    c.drawImage(_image_reader(_qr_image(url, border=1)), x, y, size, size)

    c.setFont('Helvetica-Bold', 26)
    c.drawCentredString(w / 2, y - 18 * mm, business.name)
    c.setFont('Helvetica', 14)
    c.setFillColorRGB(0.31, 0.27, 0.9)  # indigo
    c.drawCentredString(w / 2, y - 30 * mm, url)

    c.showPage()
    c.save()
    return buf.getvalue()


def _draw_logo_circle(c, business, cx, cy, r):
    """White circle + the logo (or initial) centred at (cx, cy)."""
    c.setFillColor(colors.white)
    c.circle(cx, cy, r, stroke=0, fill=1)
    if business.logo:
        try:
            d = r * 1.5
            c.drawImage(
                ImageReader(business.logo.path), cx - d / 2, cy - d / 2, d, d,
                preserveAspectRatio=True, mask='auto',
            )
            return
        except Exception:
            pass
    c.setFillColor(colors.HexColor('#4f46e5'))
    c.setFont('Helvetica-Bold', r * 1.1)
    c.drawCentredString(cx, cy - r * 0.38, (business.name or 'M').strip()[:1].upper())


def card_pdf_bytes(business, url):
    """Double-sided 85x55 mm business card.

    Front: indigo gradient, logo, name + (short) description, path, MyLink mark.
    Back: white, a QR in a rounded panel, scan label + path, MyLink mark."""
    buf = BytesIO()
    card_w, card_h = 85 * mm, 55 * mm
    c = canvas.Canvas(buf, pagesize=(card_w, card_h))

    # ---- FRONT ----
    c.linearGradient(0, card_h, card_w, 0,
                     (colors.HexColor('#4f46e5'), colors.HexColor('#7c3aad')), extend=True)
    # faint corner accents
    c.setFillColor(colors.Color(1, 1, 1, alpha=0.10))
    c.circle(card_w - 6 * mm, card_h - 4 * mm, 16 * mm, stroke=0, fill=1)
    c.circle(8 * mm, 4 * mm, 12 * mm, stroke=0, fill=1)

    _draw_logo_circle(c, business, 16 * mm, card_h - 18 * mm, 9 * mm)

    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 15)
    c.drawString(30 * mm, card_h - 17 * mm, business.name[:22])
    if business.description:
        c.setFillColor(colors.Color(1, 1, 1, alpha=0.85))
        c.setFont('Helvetica', 8.5)
        c.drawString(30 * mm, card_h - 22 * mm, business.description[:34])

    c.setFillColor(colors.white)
    c.setFont('Helvetica-Bold', 9.5)
    c.drawString(7 * mm, 7 * mm, url.replace('https://', '').replace('http://', ''))
    c.setFont('Helvetica', 7.5)
    c.setFillColor(colors.Color(1, 1, 1, alpha=0.8))
    c.drawRightString(card_w - 7 * mm, 7 * mm, 'MyLink.asia')
    c.showPage()

    # ---- BACK ----
    c.setFillColor(colors.HexColor('#f7f7fb'))
    c.rect(0, 0, card_w, card_h, stroke=0, fill=1)

    panel = 38 * mm
    pjx, pjy = (card_w - panel) / 2, (card_h - panel) / 2 + 3 * mm
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor('#e5e7eb'))
    c.setLineWidth(0.6)
    c.roundRect(pjx, pjy, panel, panel, 3 * mm, stroke=1, fill=1)

    qr_size = 30 * mm
    c.drawImage(
        _image_reader(_qr_image(url, box_size=4, border=0)),
        (card_w - qr_size) / 2, pjy + (panel - qr_size) / 2, qr_size, qr_size,
    )

    c.setFillColor(colors.HexColor('#1f1b4f'))
    c.setFont('Helvetica-Bold', 9)
    c.drawCentredString(card_w / 2, pjy - 5 * mm, 'Skanerlang va kuzating')
    c.setFillColor(colors.HexColor('#4f46e5'))
    c.setFont('Helvetica', 8)
    c.drawCentredString(card_w / 2, 5 * mm, url.replace('https://', '').replace('http://', '') + '  ·  MyLink.asia')

    c.showPage()
    c.save()
    return buf.getvalue()
