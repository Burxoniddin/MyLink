import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from '../components/Toast';
import './HomePage.css';

const PERIOD_ORDER = ['onetime', '1m', '6m', '1y'];

// Build localized feature bullets from a plan's feature matrix (item 6 dynamic).
const featureLines = (f, t) => {
    if (!f) return [];
    const lines = [];
    if (f.profile_limit) lines.push(t('pricing.feat.limit', { n: f.profile_limit }));
    if (f.templates) lines.push(t('pricing.feat.templates', { n: f.templates }));
    if (f.color_edit) lines.push(t('pricing.feat.color'));
    if (f.banners) lines.push(t('pricing.feat.banners', { n: f.banners }));
    if (f.banner_video) lines.push(t('pricing.feat.video'));
    if (f.analytics === 'partial') lines.push(t('pricing.feat.analytics_partial'));
    if (f.analytics === 'full') lines.push(t('pricing.feat.analytics_full'));
    if (f.qr === 'png') lines.push(t('pricing.feat.qr_png'));
    if (f.qr === 'full') lines.push(t('pricing.feat.qr_full'));
    if (f.branding_removed) lines.push(t('pricing.feat.branding'));
    if (f.verified_badge) lines.push(t('pricing.feat.verified'));
    if (f.team) lines.push(t('pricing.feat.team'));
    if (f.catalog) lines.push(t('pricing.feat.catalog'));
    return lines;
};

// Lowest non-zero price across periods (for the headline amount).
const headlineAmount = (prices, t) => {
    const vals = Object.values(prices || {}).filter((v) => v > 0);
    if (vals.length === 0) return { amt: '0', unit: t('home.unit_free') };
    const min = Math.min(...vals);
    return { amt: min.toLocaleString('en-US').replace(/,/g, ' '), unit: t('pricing.feat.som') };
};

const Pricing = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const navigate = useNavigate();
    const location = useLocation();
    const { entitlements, refresh } = useEntitlements();
    const currentTier = entitlements?.tier || 'free';
    const [plans, setPlans] = useState(null);
    const [periodSel, setPeriodSel] = useState({});   // slug -> chosen period
    const [buying, setBuying] = useState('');

    useEffect(() => {
        api.get('plans/').then((r) => setPlans(r.data)).catch(() => setPlans([]));
    }, []);

    // Back from Click checkout: ?paid=1 (+ Click appends payment_status=2 on success).
    useEffect(() => {
        const q = new URLSearchParams(location.search);
        if (!q.get('paid')) return;
        if (q.get('payment_status') === '2') {
            toast.success(t('pricing.paid_ok'));
        } else {
            toast.info(t('pricing.paid_wait'));
        }
        refresh();
        navigate('/pricing', { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const buy = async (slug) => {
        if (!localStorage.getItem('token')) { navigate('/login'); return; }
        const period = periodSel[slug];
        if (!period) return;
        setBuying(slug);
        try {
            const res = await api.post('payments/click/create/', {
                tier: slug,
                period,
                return_url: `${window.location.origin}/pricing?paid=1`,
            });
            window.location.href = res.data.pay_url;
        } catch (err) {
            if (err.response?.status === 503) toast.error(t('pricing.err_click_off'));
            else toast.error(t('common.error'));
            setBuying('');
        }
    };

    // Default each paid plan's period selector to its cheapest/first option.
    useEffect(() => {
        if (!plans) return;
        const init = {};
        plans.forEach((p) => {
            const av = PERIOD_ORDER.filter((k) => p.prices && p.prices[k] > 0);
            if (av.length) init[p.slug] = av[0];
        });
        setPeriodSel((cur) => ({ ...init, ...cur }));
    }, [plans]);

    const fmtPrice = (n) => (n || 0).toLocaleString('en-US').replace(/,/g, ' ');

    // Render from the API; while loading or if it's empty, fall back gracefully.
    const list = (plans && plans.length > 0 ? plans : []).map((p) => ({
        slug: p.slug,
        name: p.name,
        pop: !p.is_default && p.rank > 0 && p.features?.team,  // highlight the top tier
        feats: featureLines(p.features, t),
        prices: p.prices || {},
        ...headlineAmount(p.prices, t),
    }));

    return (
        <div className="lpc">
            <section className="block" style={{ background: '#fff', paddingTop: 56 }}>
                <div className="wrap">
                    <div className="sec-head center" style={{ maxWidth: 600 }}>
                        <span className="eyebrow">{t('home.pricing_eyebrow')}</span>
                        <h2>{t('home.pricing_title')}</h2>
                        <p style={{ marginInline: 'auto' }}>{t('home.pricing_text')}</p>
                    </div>

                    {plans === null ? (
                        <p className="cms-loading" style={{ textAlign: 'center', marginTop: 40 }}>{t('common.loading')}</p>
                    ) : (
                        <div className="prices">
                            {list.map((p) => {
                                const isCurrent = p.slug === currentTier;
                                return (
                                    <div
                                        className={`price${p.pop ? ' pop' : ''}`}
                                        key={p.slug}
                                        style={isCurrent ? { borderColor: '#16a34a', boxShadow: '0 0 0 2px #16a34a inset' } : undefined}
                                    >
                                        <div className="tier">
                                            {p.name}
                                            {p.pop && <span className="tag">{t('home.popular')}</span>}
                                            {isCurrent && <span className="tag" style={{ background: '#16a34a' }}>{t('pricing.your_plan')}</span>}
                                        </div>
                                        <div className="amt">{p.amt}<small> {p.unit}</small></div>
                                        <ul>
                                            {p.feats.map((f, j) => (<li key={j}><span className="ok">✓</span> <span>{f}</span></li>))}
                                        </ul>
                                        {(() => {
                                            const periods = PERIOD_ORDER.filter((k) => p.prices[k] > 0);
                                            const sel = periodSel[p.slug] || periods[0];
                                            if (isCurrent) {
                                                return (
                                                    <div className="btn btn-soft" style={{ cursor: 'default', opacity: 0.7, pointerEvents: 'none' }}>
                                                        {t('pricing.your_plan')}
                                                    </div>
                                                );
                                            }
                                            if (periods.length === 0) {
                                                // Narxi 0 — promokod emas, shunchaki boshlash/davom etish.
                                                const authed = !!localStorage.getItem('token');
                                                return (
                                                    <Link to={authed ? '/dashboard' : '/register'} className={`btn ${p.pop ? 'btn-primary' : 'btn-soft'}`}>
                                                        {authed ? t('pricing.continue_free') : t('pricing.start_free')}
                                                    </Link>
                                                );
                                            }
                                            return (
                                                <div className="buy-box">
                                                    {periods.length > 1 && (
                                                        <div className="buy-periods">
                                                            {periods.map((k) => (
                                                                <button key={k} type="button"
                                                                    className={sel === k ? 'on' : ''}
                                                                    onClick={() => setPeriodSel((c) => ({ ...c, [p.slug]: k }))}>
                                                                    {t(`pricing.per_${k}`)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="buy-price">
                                                        {fmtPrice(p.prices[sel])} <small>{t('pricing.feat.som')}{periods.length === 1 ? ` · ${t(`pricing.per_${sel}`)}` : ''}</small>
                                                    </div>
                                                    <button type="button"
                                                        className={`btn ${p.pop ? 'btn-primary' : 'btn-soft'}`}
                                                        style={{ width: '100%', justifyContent: 'center' }}
                                                        disabled={buying === p.slug}
                                                        onClick={() => buy(p.slug)}>
                                                        {buying === p.slug ? t('pricing.buying') : t('pricing.buy')}
                                                    </button>
                                                    <Link to="/profile" className="buy-promo">{t('pricing.activate_promo')}</Link>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};

export default Pricing;
