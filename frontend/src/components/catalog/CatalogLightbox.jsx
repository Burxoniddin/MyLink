import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ic } from './icons';
import './CatalogLightbox.css';

/**
 * Fullscreen product-photo viewer: swipe or arrows to move between shots,
 * double-tap/click to zoom, Escape or the backdrop to close.
 */
const CatalogLightbox = ({ images = [], title, start = 0, onClose }) => {
    const { t } = useTranslation();
    const n = images.length;
    const [i, setI] = useState(start);
    const [zoom, setZoom] = useState(false);
    const [origin, setOrigin] = useState('50% 50%');
    const px = useRef(null);

    const go = (d) => {
        setZoom(false);
        setI((v) => Math.max(0, Math.min(n - 1, v + d)));
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowRight') go(1);
            else if (e.key === 'ArrowLeft') go(-1);
        };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [n]);

    if (!n) return null;
    const img = images[i];

    const toggleZoom = (e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
        setZoom((z) => !z);
    };

    return (
        <div
            className="cat-lb"
            onPointerDown={(e) => { px.current = e.clientX; }}
            onPointerUp={(e) => {
                if (px.current === null || zoom) return;
                const dx = e.clientX - px.current;
                px.current = null;
                if (Math.abs(dx) > 42) go(dx < 0 ? 1 : -1);
            }}
        >
            <div className="cat-lb-top">
                <span className="cat-lb-nom">{title}</span>
                <button type="button" className="cat-lb-x" onClick={onClose} aria-label={t('common.close')}>
                    <Ic n="x" s={17} />
                </button>
            </div>

            <div className="cat-lb-stage" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
                <img
                    className={`cat-lb-img${zoom ? ' zoom' : ''}`}
                    style={zoom ? { transformOrigin: origin } : undefined}
                    src={img.image || img.thumb} alt={title || ''} draggable={false}
                    onDoubleClick={toggleZoom}
                />
            </div>

            {n > 1 && (
                <>
                    <button type="button" className="cat-lb-ar l" onClick={() => go(-1)} disabled={i === 0} aria-label="prev">
                        <Ic n="back" s={20} />
                    </button>
                    <button type="button" className="cat-lb-ar r" onClick={() => go(1)} disabled={i === n - 1} aria-label="next">
                        <Ic n="chevR" s={20} />
                    </button>
                </>
            )}

            <div className="cat-lb-foot">
                {n > 1 && (
                    <span className="cat-lb-dots">
                        {images.map((im, k) => <span key={im.id ?? k} className={k === i ? 'on' : ''} />)}
                    </span>
                )}
                <span className="cat-lb-count">{i + 1} / {n}</span>
                <span className="cat-lb-hint">{t('menu.lb_hint')}</span>
            </div>
        </div>
    );
};

export default CatalogLightbox;
