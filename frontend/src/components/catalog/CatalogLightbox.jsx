import React, { useEffect, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaTimes } from 'react-icons/fa';
import './CatalogLightbox.css';

/**
 * Fullscreen swipeable viewer for one product's images (hl-modal fork, no
 * auto-advance). Touch: swipe to navigate, double-tap to zoom 2.2x. Desktop:
 * arrows / arrow keys, Escape or backdrop click to close.
 */
const CatalogLightbox = ({ images, start = 0, title, onClose }) => {
    const [idx, setIdx] = useState(start);
    const [zoomed, setZoomed] = useState(false);
    const [origin, setOrigin] = useState('50% 50%');
    const touchX = useRef(null);
    const count = images.length;

    const go = (delta) => {
        setZoomed(false);
        setIdx((i) => (i + delta + count) % count);
    };

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            else if (e.key === 'ArrowLeft') go(-1);
            else if (e.key === 'ArrowRight') go(1);
        };
        window.addEventListener('keydown', onKey);
        // Lock body scroll while open.
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [count]);

    const onTouchStart = (e) => { touchX.current = e.touches[0].clientX; };
    const onTouchEnd = (e) => {
        if (touchX.current === null || zoomed) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 40) go(dx > 0 ? -1 : 1);
    };

    const toggleZoom = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX ?? rect.width / 2) - rect.left) / rect.width * 100;
        const y = ((e.clientY ?? rect.height / 2) - rect.top) / rect.height * 100;
        setOrigin(`${x}% ${y}%`);
        setZoomed((z) => !z);
    };

    if (!count) return null;
    const img = images[idx];

    return (
        <div className="cat-lb" onClick={onClose}>
            <button type="button" className="cat-lb-close" onClick={onClose} aria-label="close"><FaTimes /></button>
            {title && <div className="cat-lb-title">{title}</div>}

            <div
                className="cat-lb-stage"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
                onDoubleClick={toggleZoom}
            >
                <img
                    src={img.image || img.thumb}
                    alt={title || ''}
                    className={zoomed ? 'zoomed' : ''}
                    style={zoomed ? { transformOrigin: origin } : undefined}
                    draggable={false}
                />
            </div>

            {count > 1 && (
                <>
                    <button type="button" className="cat-lb-nav cat-lb-prev"
                        onClick={(e) => { e.stopPropagation(); go(-1); }} aria-label="prev">
                        <FaChevronLeft />
                    </button>
                    <button type="button" className="cat-lb-nav cat-lb-next"
                        onClick={(e) => { e.stopPropagation(); go(1); }} aria-label="next">
                        <FaChevronRight />
                    </button>
                    <div className="cat-lb-dots" onClick={(e) => e.stopPropagation()}>
                        {images.map((_, i) => (
                            <button
                                key={i} type="button" aria-label={`image ${i + 1}`}
                                className={`cat-lb-dot ${i === idx ? 'on' : ''}`}
                                onClick={() => { setZoomed(false); setIdx(i); }}
                            />
                        ))}
                    </div>
                    <div className="cat-lb-counter">{idx + 1}/{count}</div>
                </>
            )}
        </div>
    );
};

export default CatalogLightbox;
