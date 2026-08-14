import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPrice } from './format';

const KEY = (slug) => `mylink-cart-${slug}`;

const read = (slug) => {
    try {
        const raw = localStorage.getItem(KEY(slug));
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
        return {};
    }
};

/**
 * Visitor's cart for one menu, kept in localStorage so it survives a reload
 * while they walk through the menu at a table. Lines are keyed by item id and
 * store a snapshot of name/price — the order message must still read correctly
 * if the owner edits the item between adding and sending.
 */
export const useCart = (slug) => {
    const [lines, setLines] = useState(() => (slug ? read(slug) : {}));

    useEffect(() => {
        if (!slug) return;
        try {
            if (Object.keys(lines).length) localStorage.setItem(KEY(slug), JSON.stringify(lines));
            else localStorage.removeItem(KEY(slug));
        } catch { /* private mode / quota — the cart just won't persist */ }
    }, [slug, lines]);

    const setQty = useCallback((item, qty) => {
        setLines((prev) => {
            const next = { ...prev };
            if (qty <= 0) delete next[item.id];
            else next[item.id] = { id: item.id, name: item.name, price: item.price, qty };
            return next;
        });
    }, []);

    const add = useCallback((item, delta = 1) => {
        setLines((prev) => {
            const cur = prev[item.id]?.qty || 0;
            const qty = cur + delta;
            const next = { ...prev };
            if (qty <= 0) delete next[item.id];
            else next[item.id] = { id: item.id, name: item.name, price: item.price, qty };
            return next;
        });
    }, []);

    const clear = useCallback(() => setLines({}), []);

    const list = useMemo(() => Object.values(lines), [lines]);
    const count = useMemo(() => list.reduce((s, l) => s + l.qty, 0), [list]);
    const total = useMemo(() => list.reduce((s, l) => s + l.price * l.qty, 0), [list]);
    const qtyOf = useCallback((id) => lines[id]?.qty || 0, [lines]);

    return { lines, list, count, total, add, setQty, clear, qtyOf };
};

/**
 * Order text for the owner's Telegram/WhatsApp. The customer still taps Send —
 * messengers do not allow sending on someone's behalf — but nothing has to be
 * retyped or asked back.
 */
export const buildOrderMessage = ({ list, total, currency, businessName, t }) => {
    const head = t('menu.order_intro', { biz: businessName });
    const rows = list.map((l, i) => (
        `${i + 1}. ${l.name} × ${l.qty} — ${formatPrice(l.price * l.qty)} ${currency}`
    ));
    const sum = `${t('menu.total')}: ${formatPrice(total)} ${currency}`;
    return `${head}\n\n${rows.join('\n')}\n\n${sum}`;
};

/** Append the prefilled message where the messenger supports it. */
export const orderHref = (order, message) => {
    if (!order?.url) return null;
    if (order.kind === 'telegram' || order.kind === 'whatsapp') {
        const sep = order.url.includes('?') ? '&' : '?';
        return `${order.url}${sep}text=${encodeURIComponent(message)}`;
    }
    return order.url;
};
