import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { useToast } from '../components/Toast';
import SiteHeader from '../components/site/SiteHeader';
import SiteFooter from '../components/site/SiteFooter';
import './HomePage.css';

// Fallback contact details (used until admin fills SiteSettings).
const FALLBACK = {
    contact_email: 'salom@mylink.asia',
    contact_phone: '+998 90 123 45 67',
    contact_telegram: '@mylink_asia',
    support_telegram_url: 'https://t.me/mylink_asia',
};

const HomePage = () => {
    const { t } = useTranslation();
    const toast = useToast();
    const location = useLocation();
    const rootRef = useRef(null);
    const isLoggedIn = !!localStorage.getItem('token');
    const startTo = isLoggedIn ? '/dashboard' : '/register';

    const [counts, setCounts] = useState({ businesses: 0, links: 0, users: 0 });
    const [settings, setSettings] = useState(null);
    const [featured, setFeatured] = useState([]);
    const [sending, setSending] = useState(false);

    // Fetch real stats + admin-editable contact settings + featured clients.
    useEffect(() => {
        api.get('public/stats/').then((r) => setCounts(r.data)).catch(() => {});
        api.get('public/settings/').then((r) => setSettings(r.data)).catch(() => {});
        api.get('public/featured/').then((r) => setFeatured(r.data || [])).catch(() => {});
    }, []);

    // Arriving from another page with /#section — scroll to it once rendered.
    useEffect(() => {
        if (!location.hash) return;
        const el = document.getElementById(location.hash.slice(1));
        if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 60);
    }, [location.hash]);

    // Scroll reveal + count-up (ported from design reveal.js).
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const countUp = (el) => {
            const target = parseFloat(el.getAttribute('data-count')) || 0;
            const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
            const suffix = el.getAttribute('data-suffix') || '';
            const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
            if (reduce) { el.textContent = fmt(target); return; }
            const dur = 1400;
            const start = performance.now();
            const tick = (now) => {
                const p = Math.min(1, (now - start) / dur);
                const eased = 1 - Math.pow(1 - p, 3);
                el.textContent = fmt(target * eased);
                if (p < 1) requestAnimationFrame(tick);
                else el.textContent = fmt(target);
            };
            requestAnimationFrame(tick);
        };

        const trigger = (el) => {
            if (el.dataset.revealed) return;
            el.dataset.revealed = '1';
            if (el.hasAttribute('data-count') && !el.dataset.counted) {
                el.dataset.counted = '1';
                countUp(el);
            }
            el.classList.add('in');
        };

        const items = Array.from(root.querySelectorAll('.reveal, [data-count]'));
        let io = null;
        if ('IntersectionObserver' in window) {
            io = new IntersectionObserver((entries) => {
                entries.forEach((e) => { if (e.isIntersecting) { trigger(e.target); io.unobserve(e.target); } });
            }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
            items.forEach((el) => io.observe(el));
        } else {
            items.forEach(trigger);
        }
        const safety = setTimeout(() => items.forEach(trigger), 2600);

        return () => { if (io) io.disconnect(); clearTimeout(safety); };
    }, [counts]);

    const c = {
        email: settings?.contact_email || FALLBACK.contact_email,
        phone: settings?.contact_phone || FALLBACK.contact_phone,
        telegram: settings?.contact_telegram || FALLBACK.contact_telegram,
        tgUrl: settings?.support_telegram_url || FALLBACK.support_telegram_url,
    };

    const prices = [
        { tier: t('home.tier_free'), amt: '0', unit: t('home.unit_free'), pop: false, btn: 'btn-soft', cta: t('home.price_cta_free'), feats: [t('home.f_free_1'), t('home.f_free_2'), t('home.f_free_3')] },
        { tier: 'Oddiy', amt: '19 000', unit: t('home.unit_oddiy'), pop: false, btn: 'btn-soft', cta: t('home.price_cta_oddiy'), feats: [t('home.f_oddiy_1'), t('home.f_oddiy_2'), t('home.f_oddiy_3')] },
        { tier: 'Pro', tag: t('home.popular'), amt: '39 000', unit: t('home.unit_pro'), pop: true, btn: 'btn-primary', cta: t('home.price_cta_pro'), feats: [t('home.f_pro_1'), t('home.f_pro_2'), t('home.f_pro_3'), t('home.f_pro_4')] },
    ];

    const onContactSubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const phone = f.elements.phone.value.trim();
        const contact = f.elements.contact.value.trim();
        if (!phone && !contact) {
            toast.error(t('home.form_one_required'));
            return;
        }
        setSending(true);
        try {
            await api.post('contact/', {
                name: f.elements.name.value,
                phone,
                contact,
                message: f.elements.message.value,
            });
            toast.success(t('home.form_ok'));
            f.reset();
        } catch {
            toast.error(t('common.error'));
        } finally {
            setSending(false);
        }
    };

    // Seamless marquee needs the list at least twice.
    const marquee = featured.length > 0 ? [...featured, ...featured] : [];

    return (
        <div className="lpc" ref={rootRef}>
            <SiteHeader />

            <main>
                {/* HERO */}
                <section className="hero">
                    <div className="mesh"></div>
                    <span className="shape c anim2" style={{ width: 120, height: 120, background: 'color-mix(in srgb,var(--coral) 80%,#fff)', left: '6%', top: 140, opacity: .5 }}></span>
                    <span className="shape sq animspin" style={{ width: 54, height: 54, background: 'var(--lime)', left: '46%', top: 70, opacity: .55 }}></span>
                    <span className="shape c anim1" style={{ width: 26, height: 26, background: 'var(--cyan)', left: '40%', bottom: 80 }}></span>
                    <div className="wrap">
                        <div className="hero-grid">
                            <div>
                                <h1 className="reveal">{t('home.hero_title')} <span className="grad">{t('home.hero_title_grad')}</span></h1>
                                <p className="lead reveal" data-d="2">{t('home.hero_lead')}</p>
                                <div className="hero-cta reveal" data-d="2">
                                    <Link to={startTo} className="btn btn-primary">{t('home.start_free')}</Link>
                                    <a href="#how" className="btn btn-soft">{t('home.nav_how')}</a>
                                </div>
                                <div className="hero-pills reveal" data-d="3">
                                    <span className="pill"><i style={{ background: 'var(--coral)' }}></i> Instagram</span>
                                    <span className="pill"><i style={{ background: 'var(--cyan)' }}></i> Telegram</span>
                                    <span className="pill"><i style={{ background: 'var(--indigo)' }}></i> {t('home.pill_shop')}</span>
                                    <span className="pill"><i style={{ background: 'var(--lime)' }}></i> {t('home.pill_more')}</span>
                                </div>
                            </div>
                            <div className="phone-stage reveal" data-d="2">
                                <div className="phone">
                                    <div className="notch"></div>
                                    <div className="screen">
                                        <div className="pf-avatar">D</div>
                                        <div className="pf-name">@dilnoza.shop</div>
                                        <div className="pf-bio">{t('home.phone_bio')}</div>
                                        <div className="pf-links">
                                            <span className="pf-link"><span className="pf-ico" style={{ background: '#e1306c' }}>In</span> Instagram <span className="chev">›</span></span>
                                            <span className="pf-link"><span className="pf-ico" style={{ background: '#229ed9' }}>Tg</span> Telegram <span className="chev">›</span></span>
                                            <span className="pf-link"><span className="pf-ico" style={{ background: '#4f46e5' }}>Sh</span> {t('home.pill_shop')} <span className="chev">›</span></span>
                                            <span className="pf-link"><span className="pf-ico" style={{ background: '#16a34a' }}>Te</span> {t('home.phone_call')} <span className="chev">›</span></span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ABOUT */}
                <section className="block" id="about">
                    <div className="wrap">
                        <div className="sec-head reveal" style={{ maxWidth: 600 }}>
                            <span className="eyebrow">{t('home.about_eyebrow')}</span>
                            <h2>{t('home.about_title')}</h2>
                            <p>{t('home.about_text')}</p>
                        </div>
                        <div className="features">
                            <div className="feature reveal"><div className="fi" style={{ background: 'linear-gradient(135deg,var(--indigo),var(--violet))' }}>∞</div><h3>{t('home.f1_title')}</h3><p>{t('home.f1_text')}</p></div>
                            <div className="feature reveal" data-d="1"><div className="fi" style={{ background: 'linear-gradient(135deg,var(--coral),var(--violet))' }}>✦</div><h3>{t('home.f2_title')}</h3><p>{t('home.f2_text')}</p></div>
                            <div className="feature reveal" data-d="2"><div className="fi" style={{ background: 'linear-gradient(135deg,var(--cyan),var(--indigo))' }}>▲</div><h3>{t('home.f3_title')}</h3><p>{t('home.f3_text')}</p></div>
                        </div>
                    </div>
                </section>

                {/* HOW */}
                <section className="block" id="how" style={{ background: '#fff' }}>
                    <span className="shape c anim1" style={{ width: 80, height: 80, background: 'color-mix(in srgb,var(--violet) 40%,#fff)', right: '8%', top: 60, opacity: .6 }}></span>
                    <div className="wrap">
                        <div className="sec-head reveal" style={{ maxWidth: 600 }}>
                            <span className="eyebrow">{t('home.nav_how')}</span>
                            <h2>{t('home.how_title')}</h2>
                        </div>
                        <div className="steps">
                            <div className="step reveal"><div className="num" style={{ background: 'linear-gradient(135deg,var(--indigo),var(--violet))' }}>1</div><h3>{t('home.s1_title')}</h3><p>{t('home.s1_text')}</p></div>
                            <div className="step reveal" data-d="1"><div className="num" style={{ background: 'linear-gradient(135deg,var(--coral),var(--violet))' }}>2</div><h3>{t('home.s2_title')}</h3><p>{t('home.s2_text')}</p></div>
                            <div className="step reveal" data-d="2"><div className="num" style={{ background: 'linear-gradient(135deg,var(--cyan),var(--indigo))' }}>3</div><h3>{t('home.s3_title')}</h3><p>{t('home.s3_text')}</p></div>
                        </div>
                    </div>
                </section>

                {/* STATS — two big live counters */}
                <section className="block">
                    <div className="wrap">
                        <div className="stats-wrap reveal">
                            <span className="blob" style={{ width: 200, height: 200, background: 'rgba(255,255,255,.14)', left: -40, top: -50 }}></span>
                            <span className="blob" style={{ width: 160, height: 160, background: 'rgba(255,255,255,.1)', right: 30, bottom: -60 }}></span>
                            <div className="stats-head">
                                <span className="eyebrow">{t('home.stats_eyebrow')}</span>
                                <h2>{t('home.stats_title')}</h2>
                                <p>{t('home.stats_text')}</p>
                            </div>
                            <div className="stats-duo">
                                <div className="stat-big reveal">
                                    <div className="sb-ring"><span>✦</span></div>
                                    <b><span data-count={counts.users}>{counts.users}</span><i>+</i></b>
                                    <span className="sb-label">{t('home.stat_users')}</span>
                                </div>
                                <div className="stat-big reveal" data-d="1">
                                    <div className="sb-ring"><span>◆</span></div>
                                    <b><span data-count={counts.businesses}>{counts.businesses}</span><i>+</i></b>
                                    <span className="sb-label">{t('home.stat_pages')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CLIENTS — admin-curated infinite carousel */}
                {featured.length > 0 && (
                    <section className="block clients-block">
                        <div className="wrap">
                            <div className="sec-head center reveal" style={{ maxWidth: 600 }}>
                                <span className="eyebrow">{t('home.clients_eyebrow')}</span>
                                <h2>{t('home.clients_title')}</h2>
                            </div>
                        </div>
                        <div className="clients-marquee reveal" data-d="1">
                            <div className="clients-track" style={{ '--n': featured.length }}>
                                {marquee.map((b, i) => (
                                    <a key={`${b.path}-${i}`} href={`/${b.path}`} target="_blank" rel="noreferrer" className="client-card" aria-hidden={i >= featured.length}>
                                        {b.logo
                                            ? <img src={b.logo} alt={b.name} />
                                            : <span className="client-letter">{b.name.charAt(0)}</span>}
                                        <span className="client-name">{b.name}</span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* PRICING */}
                <section className="block" id="pricing" style={{ background: '#fff' }}>
                    <div className="wrap">
                        <div className="sec-head center reveal" style={{ maxWidth: 600 }}>
                            <span className="eyebrow">{t('home.pricing_eyebrow')}</span>
                            <h2>{t('home.pricing_title')}</h2>
                            <p style={{ marginInline: 'auto' }}>{t('home.pricing_text')}</p>
                        </div>
                        <div className="prices">
                            {prices.map((p, i) => (
                                <div className={`price reveal${p.pop ? ' pop' : ''}`} data-d={i} key={i}>
                                    <div className="tier">{p.tier}{p.tag && <span className="tag">{p.tag}</span>}</div>
                                    <div className="amt">{p.amt}<small> {p.unit}</small></div>
                                    <ul>
                                        {p.feats.map((f, j) => (<li key={j}><span className="ok">✓</span> <span>{f}</span></li>))}
                                    </ul>
                                    <Link to={startTo} className={`btn ${p.btn}`}>{p.cta}</Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* CONTACT */}
                <section className="block" id="contact">
                    <div className="wrap">
                        <div className="sec-head reveal" style={{ maxWidth: 600 }}>
                            <span className="eyebrow">{t('home.nav_contact')}</span>
                            <h2>{t('home.contact_title')}</h2>
                        </div>
                        <div className="contact-card reveal" data-d="1">
                            <div className="contact-info">
                                <h2>{t('home.contact_q')}</h2>
                                <p>{t('home.contact_q_text')}</p>
                                <a className="ci" href={`mailto:${c.email}`}><span className="ic">@</span><div><b>{c.email}</b><span>{t('home.ci_email')}</span></div></a>
                                <a className="ci" href={`tel:${c.phone.replace(/\s/g, '')}`}><span className="ic">✆</span><div><b>{c.phone}</b><span>{t('home.ci_phone')}</span></div></a>
                                <a className="ci" href={c.tgUrl} target="_blank" rel="noreferrer"><span className="ic">◈</span><div><b>{c.telegram}</b><span>{t('home.ci_tg')}</span></div></a>
                            </div>
                            <form className="lp-form" onSubmit={onContactSubmit}>
                                <div className="field"><label>{t('home.form_name')}</label><input name="name" required placeholder={t('home.form_name_ph')} /></div>
                                <div className="field"><label>{t('home.form_phone')}</label><input name="phone" type="tel" placeholder="+998 90 123 45 67" /></div>
                                <div className="field"><label>{t('home.form_contact')}</label><input name="contact" type="email" placeholder="you@example.com" /></div>
                                <div className="form-hint">{t('home.form_one_required')}</div>
                                <div className="field"><label>{t('home.form_msg')}</label><textarea name="message" required placeholder={t('home.form_msg_ph')}></textarea></div>
                                <button className="btn btn-primary" type="submit" disabled={sending} style={{ width: '100%', justifyContent: 'center' }}>{t('home.form_send')}</button>
                            </form>
                        </div>
                    </div>
                </section>
            </main>

            <SiteFooter />
        </div>
    );
};

export default HomePage;
