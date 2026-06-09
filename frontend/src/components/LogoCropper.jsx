import React, { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { useTranslation } from 'react-i18next';

const createImage = (url) =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener('load', () => resolve(img));
        img.addEventListener('error', reject);
        img.src = url;
    });

// Crop `src` to the chosen square area and return it as a PNG File.
async function getCroppedFile(src, pixels) {
    const image = await createImage(src);
    const size = Math.max(1, Math.round(pixels.width));
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image, pixels.x, pixels.y, pixels.width, pixels.height, 0, 0, size, size);
    return new Promise((resolve) => {
        canvas.toBlob(
            (blob) => resolve(blob ? new File([blob], 'logo.png', { type: 'image/png' }) : null),
            'image/png',
        );
    });
}

// Square avatar crop modal shown when a logo image is selected.
const LogoCropper = ({ src, onCancel, onComplete }) => {
    const { t } = useTranslation();
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [pixels, setPixels] = useState(null);
    const [busy, setBusy] = useState(false);

    const onCropComplete = useCallback((_, areaPixels) => setPixels(areaPixels), []);

    const apply = async () => {
        if (!pixels) return;
        setBusy(true);
        const file = await getCroppedFile(src, pixels);
        setBusy(false);
        if (file) onComplete(file);
    };

    return (
        <div className="cropper-modal" onClick={onCancel}>
            <div className="cropper-box" onClick={(e) => e.stopPropagation()}>
                <h3>{t('crop.title')}</h3>
                <div className="cropper-area">
                    <Cropper
                        image={src}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
                        cropShape="round"
                        showGrid={false}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                    />
                </div>
                <input
                    className="cropper-zoom"
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                    aria-label="zoom"
                />
                <div className="cropper-actions">
                    <button type="button" className="cropper-cancel" onClick={onCancel}>
                        {t('common.cancel')}
                    </button>
                    <button type="button" className="cropper-save" onClick={apply} disabled={busy || !pixels}>
                        {busy ? t('crop.saving') : t('crop.apply')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogoCropper;
