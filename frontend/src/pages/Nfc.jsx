import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import OfferConsent from '../components/OfferConsent';
import { fetchSiteSettings } from '../lib/siteSettings';
import { formatPrice } from '../lib/format';

// Variant A of the NFC redesign (claude.ai/design "NFC sahifa redesign"):
// dark hero panel with a rotating card mock carousel, light form + orders grid.
const CARDS = ['/nfc/card-1.webp', '/nfc/card-2.webp', '/nfc/card-3.webp', '/nfc/card-4.webp'];

const STATUS_BADGE = {
    new: { bg: '#eceafd', fg: '#5c56e8' },
    processing: { bg: '#fef3c7', fg: '#92400e' },
    done: { bg: '#dcfce7', fg: '#166534' },
    canceled: { bg: '#fee2e2', fg: '#991b1b' },
};

const CheckIcon = ({ light }) => (
    <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill={light ? '#fff' : '#eceafd'} opacity={light ? '.18' : '1'} />
        <path d="M6 10.2l2.6 2.6L14 7.5" stroke={light ? '#fff' : '#5c56e8'} strokeWidth="2"
            fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

const Nfc = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState({ full_name: '', phone: '', quantity: 1, note: '', business: '' });
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [slide, setSlide] = useState(0);
    // Narx adminkadan keladi; oferta belgilanmasa to'lash tugmasi ochilmaydi.
    const [unitPrice, setUnitPrice] = useState(0);
    const [agree, setAgree] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        // Click'dan qaytish: ?paid=1 (muvaffaqiyatda payment_status=2 qo'shiladi).
        const q = new URLSearchParams(window.location.search);
        if (q.get('paid')) {
            setMsg(q.get('payment_status') === '2'
                ? { type: 'success', text: t('nfc.paid_ok') }
                : { type: 'info', text: t('nfc.paid_wait') });
            window.history.replaceState({}, '', '/nfc');
        }
        fetchSiteSettings().then((s) => setUnitPrice(Number(s?.nfc_price) || 0));
        Promise.all([
            api.get('nfc/orders/').then((res) => setOrders(res.data)),
            // Only the user's own pages are offered (and accepted by the backend).
            api.get('businesses/')
                .then((res) => setBusinesses(res.data.filter((b) => b.role === 'owner')))
                .catch(() => {}),
        ])
            .catch((err) => { if (err.response?.status === 401) navigate('/login'); })
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Card mock carousel: cross-fade every 3s (back card previews the next one).
    useEffect(() => {
        const id = setInterval(() => setSlide((s) => (s + 1) % CARDS.length), 3000);
        return () => clearInterval(id);
    }, []);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        setMsg({ type: '', text: '' });
        try {
            const payload = {
                ...form,
                quantity: Number(form.quantity) || 1,
                offer_accepted: agree,
                return_url: `${window.location.origin}/nfc?paid=1`,
            };
            if (!payload.business) delete payload.business;  // optional
            const res = await api.post('nfc/orders/', payload);
            // Narx belgilangan va Click ulangan bo'lsa — to'lovga o'tamiz.
            if (res.data?.pay_url) {
                window.location.href = res.data.pay_url;
                return;
            }
            setOrders([res.data, ...orders]);
            setForm({ full_name: '', phone: '', quantity: 1, note: '', business: '' });
            setAgree(false);
            setMsg({ type: 'success', text: t('nfc.sent') });
        } catch (err) {
            // Surface the first field error (e.g. phone format) if present.
            const data = err.response?.data;
            const fieldErr = data && typeof data === 'object'
                ? Object.values(data).flat().find(Boolean) : null;
            setMsg({ type: 'error', text: fieldErr || t('common.error') });
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner" /><p>{t('common.loading')}</p></div>;
    }

    const benefits = [t('nfc.benefit_1'), t('nfc.benefit_2'), t('nfc.benefit_3')];

    return (
        <div className="dashboard nfc2">
            <main className="dashboard-main">
                <div className="nfc2-wrap">
                    {/* HERO — dark panel with glows + card carousel */}
                    <div className="nfc2-hero">
                        <span className="nfc2-glowB" aria-hidden="true"></span>
                        <span className="nfc2-glowP" aria-hidden="true"></span>
                        <div className="nfc2-tx">
                            <svg className="nfc2-wave" viewBox="0 0 44 44" aria-hidden="true">
                                <path d="M14 16c3.5 3.5 3.5 8.5 0 12" stroke="#7db3ff" strokeWidth="3" fill="none" strokeLinecap="round" />
                                <path d="M21 11c6 6 6 16 0 22" stroke="#9d8cff" strokeWidth="3" opacity=".8" fill="none" strokeLinecap="round" />
                                <path d="M28 6c8.8 8.8 8.8 23.2 0 32" stroke="#c98fdb" strokeWidth="3" opacity=".55" fill="none" strokeLinecap="round" />
                            </svg>
                            <h1>{t('nfc.title')}</h1>
                            <p>{t('nfc.lead')}</p>
                            <div className="nfc2-checks">
                                {benefits.map((b) => (
                                    <span key={b} className="nfc2-check"><CheckIcon light /> {b}</span>
                                ))}
                            </div>
                        </div>
                        <div className="nfc2-visual">
                            {CARDS.map((src, i) => (
                                <img key={`b-${src}`} src={src} alt="" loading="lazy"
                                    className={`nfc2-card nfc2-c2 ${((slide + 1) % CARDS.length) === i ? 'show' : ''}`} />
                            ))}
                            {CARDS.map((src, i) => (
                                <img key={`f-${src}`} src={src} alt="MyLink NFC card" loading="lazy"
                                    className={`nfc2-card nfc2-c1 ${slide === i ? 'show' : ''}`} />
                            ))}
                        </div>
                    </div>

                    {/* FORM + ORDERS */}
                    <div className="nfc2-grid">
                        <div className="nfc2-panel">
                            <h2>{t('nfc.order_title')}</h2>
                            {msg.text && (
                                <div className={`message ${msg.type}`} style={{ marginBottom: 18 }}>{msg.text}</div>
                            )}
                            <form onSubmit={submit}>
                                <div className="nfc2-row2">
                                    <div className="nfc2-field">
                                        <label>{t('nfc.name')}</label>
                                        <input className="nfc2-in" value={form.full_name}
                                            onChange={(e) => setForm({ ...form, full_name: e.target.value })} required />
                                    </div>
                                    <div className="nfc2-field">
                                        <label>{t('nfc.phone')}</label>
                                        <input className="nfc2-in" type="tel" value={form.phone}
                                            placeholder="+998 90 123 45 67"
                                            onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="nfc2-row2">
                                    <div className="nfc2-field">
                                        <label>{t('nfc.business')}</label>
                                        <div className="nfc2-selwrap">
                                            <select className="nfc2-in" value={form.business}
                                                onChange={(e) => setForm({ ...form, business: e.target.value })}>
                                                <option value="">{t('nfc.business_none')}</option>
                                                {businesses.map((b) => (
                                                    <option key={b.id} value={b.id}>{b.name} (mylink.asia/{b.path})</option>
                                                ))}
                                            </select>
                                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                                        </div>
                                    </div>
                                    <div className="nfc2-field">
                                        <label>{t('nfc.quantity')}</label>
                                        <input type="number" min="1" max="1000" className="nfc2-in" value={form.quantity}
                                            onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
                                    </div>
                                </div>
                                <div className="nfc2-field">
                                    <label>{t('nfc.note')}</label>
                                    <textarea className="nfc2-in" rows="3" value={form.note}
                                        onChange={(e) => setForm({ ...form, note: e.target.value })} />
                                </div>
                                {unitPrice > 0 && (
                                    <div className="nfc2-price">
                                        <span className="nfc2-price-unit">
                                            {t('nfc.price_unit', { price: formatPrice(unitPrice) })}
                                        </span>
                                        <span className="nfc2-price-total">
                                            <b>{formatPrice(unitPrice * (Number(form.quantity) || 1))}</b> {t('pricing.feat.som')}
                                        </span>
                                    </div>
                                )}
                                <OfferConsent checked={agree} onChange={setAgree} />
                                <button type="submit" className="nfc2-btn" disabled={busy || !agree}>
                                    {busy ? t('nfc.sending') : (unitPrice > 0 ? t('nfc.pay') : t('nfc.submit'))}
                                </button>
                                <p className="nfc2-paynote">
                                    {unitPrice > 0 ? t('nfc.pay_note') : t('nfc.no_payment')}
                                </p>
                            </form>
                        </div>

                        <div className="nfc2-panel nfc2-orders">
                            <h2>{t('nfc.history')}</h2>
                            {orders.map((o) => {
                                const c = STATUS_BADGE[o.status] || STATUS_BADGE.new;
                                return (
                                    <div key={o.id} className="nfc2-orow">
                                        <span className="nfc2-chip" aria-hidden="true"></span>
                                        <span className="nfc2-ot">
                                            <b>×{o.quantity} — {o.full_name}</b>
                                            <span>
                                                {o.amount > 0 ? `${formatPrice(o.amount)} ${t('pricing.feat.som')} · ` : ''}
                                                {o.amount > 0 ? `${o.is_paid ? t('nfc.paid') : t('nfc.unpaid')} · ` : ''}
                                                {o.business_name ? `${o.business_name} · ` : ''}
                                                {new Date(o.created_at).toLocaleDateString()}
                                            </span>
                                        </span>
                                        <span className="nfc2-badge" style={{ background: c.bg, color: c.fg }}>
                                            {o.status_display}
                                        </span>
                                    </div>
                                );
                            })}
                            <p className="nfc2-note">{t('nfc.orders_note')}</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Nfc;
