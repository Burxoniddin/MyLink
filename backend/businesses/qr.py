"""QR code + PDF (business card) generation for a business's public page.

Used by the businesses asset endpoints. Gating by tier (qr: none/png/full)
happens in the view; this module is pure rendering. Text is drawn with the
built-in Helvetica font (Latin), which covers Uzbek-Latin business names.
"""

from io import BytesIO

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def _qr_image(url, box_size=10, border=2):
    """Return a PIL image of the QR for ``url``."""
    qr = qrcode.QRCode(
        box_size=box_size,
        border=border,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
    )
    qr.add_data(url)
    qr.make(fit=True)
    return qr.make_image(fill_color='black', back_color='white').convert('RGB')


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


def card_pdf_bytes(business, url):
    """Standard 85×55 mm business card: name + description + URL on the left,
    QR on the right, optional logo top-left (Pro tier)."""
    buf = BytesIO()
    card_w, card_h = 85 * mm, 55 * mm
    c = canvas.Canvas(buf, pagesize=(card_w, card_h))

    # Subtle border
    c.setStrokeColorRGB(0.89, 0.9, 0.94)
    c.setLineWidth(0.5)
    c.rect(2 * mm, 2 * mm, card_w - 4 * mm, card_h - 4 * mm)

    # QR on the right
    qr_size = 30 * mm
    c.drawImage(
        _image_reader(_qr_image(url, box_size=4, border=1)),
        card_w - qr_size - 5 * mm, (card_h - qr_size) / 2, qr_size, qr_size,
    )

    left = 7 * mm
    text_top = card_h - 13 * mm

    # Optional logo (local storage only; degrade gracefully)
    if business.logo:
        try:
            c.drawImage(
                ImageReader(business.logo.path),
                left, card_h - 17 * mm, 9 * mm, 9 * mm,
                preserveAspectRatio=True, mask='auto',
            )
            left += 12 * mm
            text_top = card_h - 11 * mm
        except Exception:
            pass

    c.setFillColorRGB(0.1, 0.1, 0.12)
    c.setFont('Helvetica-Bold', 13)
    c.drawString(left, text_top, business.name[:28])

    if business.description:
        c.setFillColorRGB(0.42, 0.45, 0.5)
        c.setFont('Helvetica', 8)
        c.drawString(left, text_top - 6 * mm, business.description[:48])

    c.setFillColorRGB(0.31, 0.27, 0.9)
    c.setFont('Helvetica', 8)
    c.drawString(7 * mm, 6 * mm, url)

    c.showPage()
    c.save()
    return buf.getvalue()
