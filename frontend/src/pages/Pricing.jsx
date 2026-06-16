import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useEntitlements } from '../context/EntitlementContext';
import './HomePage.css';

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
    const { entitlements } = useEntitlements();
    const currentTier = entitlements?.tier || 'free';
    const [plans, setPlans] = useState(null);

    useEffect(() => {
        api.get('plans/').then((r) => setPlans(r.data)).catch(() => setPlans([]));
    }, []);

    // Render from the API; while loading or if it's empty, fall back gracefully.
    const list = (plans && plans.length > 0 ? plans : []).map((p) => ({
        slug: p.slug,
        name: p.name,
        pop: !p.is_default && p.rank > 0 && p.features?.team,  // highlight the top tier
        feats: featureLines(p.features, t),
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

                    <div style={{
                        maxWidth: 720, margin: '28px auto 0', padding: '14px 18px',
                        background: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: 14,
                        color: '#3730a3', fontSize: 15, textAlign: 'center',
                    }}>💳 {t('pricing.payment_soon')}</div>

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
                                        {isCurrent ? (
                                            <div className="btn btn-soft" style={{ cursor: 'default', opacity: 0.7, pointerEvents: 'none' }}>
                                                {t('pricing.your_plan')}
                                            </div>
                                        ) : (
                                            <Link to="/profile" className={`btn ${p.pop ? 'btn-primary' : 'btn-soft'}`}>
                                                {t('pricing.activate_promo')}
                                            </Link>
                                        )}
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
