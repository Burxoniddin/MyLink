"""Pillow-only recompression for catalog uploads (no new dependencies).

Phone photos arrive huge and often EXIF-rotated; everything is normalized to
plain JPEG here so the public menu stays fast: full-size for the lightbox,
a small thumb for the card grid. Raises ``InvalidImage`` for unreadable files —
callers map it to ``{'reason': 'invalid_image'}``.
"""
import os
from io import BytesIO

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 10 * 1024 * 1024  # raw upload cap (pre-processing)


class InvalidImage(ValueError):
    pass


def _recode(uploaded, max_side, quality):
    try:
        uploaded.seek(0)
    except (AttributeError, OSError):
        pass
    try:
        img = Image.open(uploaded)
        img.load()
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as exc:
        raise InvalidImage(str(exc)) from exc

    img = ImageOps.exif_transpose(img)

    # Flatten alpha/palette onto white so any input becomes a valid JPEG.
    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
        base = Image.new('RGB', img.size, (255, 255, 255))
        rgba = img.convert('RGBA')
        base.paste(rgba, mask=rgba.split()[-1])
        img = base
    elif img.mode != 'RGB':
        img = img.convert('RGB')

    w, h = img.size
    scale = max(w, h) / max_side
    if scale > 1:
        img = img.resize((max(1, round(w / scale)), max(1, round(h / scale))), Image.LANCZOS)

    buf = BytesIO()
    img.save(buf, format='JPEG', quality=quality, optimize=True)
    stem = os.path.splitext(os.path.basename(getattr(uploaded, 'name', '') or 'image'))[0]
    return ContentFile(buf.getvalue(), name=f'{stem}.jpg')


def process_image(uploaded):
    """Full-size product photo (lightbox)."""
    return _recode(uploaded, max_side=1600, quality=82)


def make_thumb(uploaded):
    """Card-grid thumbnail."""
    return _recode(uploaded, max_side=480, quality=78)


def process_banner(uploaded):
    """Wide catalog banner."""
    return _recode(uploaded, max_side=1920, quality=82)
