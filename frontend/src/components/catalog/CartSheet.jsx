import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Ic } from './icons';
import { formatPrice } from '../../lib/format';
import { buildOrderMessage, orderHref } from '../../lib/catalogCart';

/**
 * The cart contents plus the order CTA. Telegram/WhatsApp open with the whole
 * order prefilled (the customer taps Send); any other link just opens, so the
 * list is also shown as copyable text there.
 */
const CartSheet = ({ cart, currency, order, orderLabel, businessName, onClose }) => {
    const { t } = useTranslation();
    const { list, total, add, setQty, clear } = cart;

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    const message = buildOrderMessage({ list, total, currency, businessName, t });
    const href = orderHref(order, message);
    const prefills = order?.kind === 'telegram' || order?.kind === 'whatsapp';

    return (
        <div className="cs-ovl" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="cs-sheet" role="dialog" aria-label={t('menu.cart')}>
                <div className="cs-head">
                    <b>{t('menu.cart')}</b>
                    <button type="button" className="cs-x" onClick={onClose} aria-label={t('common.close')}>
                        <Ic n="x" s={17} />
                    </button>
                </div>

                {list.length === 0 ? (
                    <p className="cs-empty">{t('menu.cart_empty')}</p>
                ) : (
                    <>
                        <ul className="cs-list">
                            {list.map((l) => (
                                <li key={l.id} className="cs-row">
                                    <span className="cs-nom">{l.name}</span>
                                    <span className="cs-step">
                                        <button type="button" onClick={() => setQty(l, l.qty - 1)} aria-label="−">
                                            <Ic n="minus" s={13} w={2.4} />
                                        </button>
                                        <b>{l.qty}</b>
                                        <button type="button" onClick={() => add(l, 1)} aria-label="+">
                                            <Ic n="plus" s={13} w={2.4} />
                                        </button>
                                    </span>
                                    <span className="cs-sum">{formatPrice(l.price * l.qty)}</span>
                                </li>
                            ))}
                        </ul>

                        <div className="cs-total">
                            <span>{t('menu.total')}</span>
                            <b>{formatPrice(total)} {currency}</b>
                        </div>

                        {href ? (
                            <>
                                <a className="cs-order" href={href} target="_blank" rel="noopener noreferrer">
                                    <Ic n="send" s={16} />
                                    {orderLabel || t('menu.order_cta')}
                                </a>
                                <p className="cs-hint">
                                    {prefills ? t('menu.order_hint') : t('menu.order_hint_plain')}
                                </p>
                            </>
                        ) : (
                            <p className="cs-hint">{t('menu.order_off')}</p>
                        )}

                        <button type="button" className="cs-clear" onClick={clear}>
                            <Ic n="trash" s={13} />{t('menu.cart_clear')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default CartSheet;
