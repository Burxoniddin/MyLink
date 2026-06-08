import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import './HomePage.css';

const Pricing = () => {
    const { t } = useTranslation();
    const { entitlements } = useEntitlements();
    const currentTier = entitlements?.tier || 'free';

    const plans = [
        { slug: 'free', tier: t('home.tier_free'), amt: '0', unit: t('home.unit_free'), feats: [t('home.f_free_1'), t('home.f_free_2'), t('home.f_free_3')] },
        { slug: 'oddiy', tier: 'Oddiy', amt: '19 000', unit: t('home.unit_oddiy'), feats: [t('home.f_oddiy_1'), t('home.f_oddiy_2'), t('home.f_oddiy_3')] },
        { slug: 'pro', tier: 'Pro', tag: t('home.popular'), pop: true, amt: '39 000', unit: t('home.unit_pro'), feats: [t('home.f_pro_1'), t('home.f_pro_2'), t('home.f_pro_3'), t('home.f_pro_4')] },
    ];

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

                    <div className="prices">
                        {plans.map((p) => {
                            const isCurrent = p.slug === currentTier;
                            return (
                                <div
                                    className={`price${p.pop ? ' pop' : ''}`}
                                    key={p.slug}
                                    style={isCurrent ? { borderColor: '#16a34a', boxShadow: '0 0 0 2px #16a34a inset' } : undefined}
                                >
                                    <div className="tier">
                                        {p.tier}
                                        {p.tag && <span className="tag">{p.tag}</span>}
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
                </div>
            </section>
        </div>
    );
};

export default Pricing;
