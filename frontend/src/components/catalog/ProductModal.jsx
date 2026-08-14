import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ic } from './icons';
import { formatPrice } from '../../lib/format';

/**
 * Product detail sheet: the full photo set, the untruncated description and
 * the price, plus the quantity stepper when the cart is on. Tapping a photo
 * hands off to the fullscreen lightbox.
 */
const ProductModal = ({ item, currency, cartEnabled, qty, onAdd, onSetQty, onZoom, onClose, paused = false }) => {
    const { t } = useTranslation();
    const images = item.images || [];
    const [i, setI] = useState(0);
    const sold = !item.is_available;

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // While the fullscreen zoom is up it owns the keyboard — otherwise one
        // Escape would close the zoom and this sheet together.
        if (paused) return () => { document.body.style.overflow = prev; };
        const onKey = (e) => {
            if (e.key === 'Escape') onClose();
            else if (images.length > 1 && e.key === 'ArrowRight') setI((v) => Math.min(images.length - 1, v + 1));
            else if (images.length > 1 && e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [images.length, onClose, paused]);

    const cover = images[i];

    return (
        <div className="pm-ovl" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="pm-sheet" role="dialog" aria-label={item.name}>
                <button type="button" className="pm-x" onClick={onClose} aria-label={t('common.close')}>
                    <Ic n="x" s={18} />
                </button>

                <div className="pm-media">
                    {cover ? (
                        <button type="button" className="pm-shot" onClick={() => onZoom?.(i)} aria-label={item.name}>
                            <img src={cover.image || cover.thumb} alt={item.name} />
                            <span className="pm-zoom"><Ic n="layers" s={13} w={2.2} />{t('menu.tap_to_zoom')}</span>
                        </button>
                    ) : (
                        <div className="pm-shot pm-noshot"><span>{item.name.charAt(0)}</span></div>
                    )}

                    {images.length > 1 && (
                        <div className="pm-thumbs">
                            {images.map((im, k) => (
                                <button
                                    key={im.id ?? k} type="button"
                                    className={`pm-thumb${k === i ? ' on' : ''}`}
                                    onClick={() => setI(k)} aria-label={`${k + 1}`}
                                >
                                    <img src={im.thumb || im.image} alt="" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pm-body">
                    <h2 className="pm-nom">{item.name}</h2>
                    {sold && <span className="pm-sold">{t('menu.sold_out')}</span>}
                    {item.description && <p className="pm-desc">{item.description}</p>}

                    <div className="pm-foot">
                        <span className="pm-narx">
                            {item.old_price ? <s>{formatPrice(item.old_price)}</s> : null}
                            <b>{formatPrice(item.price)}<i> {currency}</i></b>
                        </span>

                        {cartEnabled && !sold && (
                            qty > 0 ? (
                                <span className="pm-step">
                                    <button type="button" onClick={() => onSetQty(item, qty - 1)} aria-label="−">
                                        <Ic n="minus" s={14} w={2.4} />
                                    </button>
                                    <b>{qty}</b>
                                    <button type="button" onClick={() => onAdd(item, 1)} aria-label="+">
                                        <Ic n="plus" s={14} w={2.4} />
                                    </button>
                                </span>
                            ) : (
                                <button type="button" className="pm-add" onClick={() => onAdd(item, 1)}>
                                    <Ic n="plus" s={15} w={2.4} />{t('menu.add_to_cart')}
                                </button>
                            )
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProductModal;
