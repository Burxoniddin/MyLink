"""Ommaviy oferta PDF'i.

Matn ``assets/oferta_uz.txt`` da turadi (``# ...`` — bo'lim sarlavhasi), rekvizit
o'rinbosarlari ({COMPANY}, {TIN}, ...) esa SiteSettings dan to'ldiriladi — ya'ni
hujjat adminkadan boshqariladi. Admin tayyor PDF yuklasa (SiteSettings.offer_pdf),
sayt o'sha faylni ko'rsatadi va bu modul ishlatilmaydi.

Shrift — qr.py dagi bilan bir xil Noto Sans: standart Helvetica o'zbekcha 'ʻ'
va kirill harflarini kvadratga aylantirib qo'yadi.
"""

import os
from io import BytesIO

from django.utils import timezone
from reportlab.lib.enums import TA_JUSTIFY
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

from .qr import FONT, FONT_BOLD

_TEXT_PATH = os.path.join(os.path.dirname(__file__), 'assets', 'oferta_uz.txt')

_BODY = ParagraphStyle('body', fontName=FONT, fontSize=9.5, leading=14,
                       alignment=TA_JUSTIFY, spaceAfter=6)
_H1 = ParagraphStyle('h1', fontName=FONT_BOLD, fontSize=15, leading=20,
                     spaceBefore=2, spaceAfter=10)
_H2 = ParagraphStyle('h2', fontName=FONT_BOLD, fontSize=11, leading=15,
                     spaceBefore=10, spaceAfter=4)


def _placeholders(settings_row):
    """Hujjatdagi {O'RINBOSAR}lar uchun qiymatlar (bo'sh bo'lsa — chiziqcha)."""
    dash = '_________________'
    return {
        'DATE': timezone.localdate().strftime('%d.%m.%Y'),
        'COMPANY': settings_row.company_name or dash,
        'TIN': settings_row.company_tin or dash,
        'ADDRESS': settings_row.company_address or dash,
        'PHONE': settings_row.contact_phone or dash,
        'EMAIL': settings_row.contact_email or dash,
    }


def offer_pdf_bytes():
    """Amaldagi sozlamalar bilan to'ldirilgan oferta PDF baytlari."""
    from .models import SiteSettings

    values = _placeholders(SiteSettings.get_settings())
    raw = open(_TEXT_PATH, encoding='utf-8').read()
    for key, value in values.items():
        raw = raw.replace('{' + key + '}', str(value))

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title='MyLink.asia — Ommaviy oferta', author='MyLink.asia',
    )
    def para(text):
        """Matndagi & < > belgilari platypus markup'i deb o'qilib ketmasin."""
        safe = text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
        return safe.replace('\n', '<br/>')

    flow, first_heading = [], True
    for block in (b.strip() for b in raw.split('\n\n')):
        if not block:
            continue
        if block.startswith('# '):
            flow.append(Paragraph(para(block[2:].strip()), _H1 if first_heading else _H2))
            first_heading = False
        else:
            flow.append(Paragraph(para(block), _BODY))
    flow.append(Spacer(1, 6 * mm))
    doc.build(flow)
    return buf.getvalue()
