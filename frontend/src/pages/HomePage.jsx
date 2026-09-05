import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FaEnvelope, FaPhoneAlt, FaTelegramPlane } from 'react-icons/fa';
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

// Hero phone: four of the real page designs, cycled every few seconds. Static
// demo data on purpose — DB-independent, so it renders the same everywhere
// (a live iframe would 404 wherever the demo path doesn't exist). Palettes and
// fonts mirror templates.css; `id` picks the matching block in HomePage.css.
// `label` = brand name (never translated), `key` = a home.* translation key.
const HERO_MOCKS = [
    {
        id: 'classic', initial: 'M', name: 'MYBRAND', path: 'mybrand', bio: 'mock_bio_classic',
        links: [
            { label: 'Instagram', dot: 'var(--coral)' },
            { label: 'Telegram', dot: 'var(--cyan)' },
            { key: 'mock_shop', dot: 'var(--indigo)' },
            { key: 'mock_phone', dot: 'var(--lime)' },
        ],
        media: ['linear-gradient(135deg,#312e81,#6d28d9)', 'linear-gradient(135deg,#0e7490,#2563eb)', 'linear-gradient(135deg,#9d174d,#f59e0b)'],
    },
    {
        id: 'restoran', initial: 'O', name: 'OSH MARKAZI', path: 'oshmarkazi', bio: 'mock_bio_restoran',
        links: [
            { key: 'mock_menu', dot: '#f0a23c' },
            { label: 'Instagram', dot: '#e1306c' },
            { label: 'Telegram', dot: '#2aabee' },
            { key: 'mock_phone', dot: '#d4582a' },
        ],
        media: ['linear-gradient(135deg,#d4582a,#f0a23c)', 'linear-gradient(135deg,#7c2d12,#c2410c)', 'linear-gradient(135deg,#b45309,#fbbf24)'],
    },
    {
        id: 'moda', initial: 'N', name: 'MAISON NUR', path: 'maisonnur', bio: 'mock_bio_moda',
        links: [
            { label: 'Instagram', dot: '#9c8466' },
            { label: 'Telegram', dot: '#9c8466' },
            { key: 'mock_shop', dot: '#9c8466' },
            { key: 'mock_phone', dot: '#9c8466' },
        ],
        media: ['linear-gradient(135deg,#d8d1c2,#9c8466)', 'linear-gradient(135deg,#e8e2d6,#b8a184)', 'linear-gradient(135deg,#c7bda6,#8a7355)'],
    },
    {
        id: 'fitnes', initial: 'P', name: 'PULSE GYM', path: 'pulsegym', bio: 'mock_bio_fitnes',
        links: [
            { key: 'mock_book', dot: '#b6f23a' },
            { label: 'Instagram', dot: '#e1306c' },
            { label: 'Telegram', dot: '#2aabee' },
            { key: 'mock_phone', dot: '#93d11f' },
        ],
        media: ['linear-gradient(135deg,#3f6212,#b6f23a)', 'linear-gradient(135deg,#1c1f18,#65a30d)', 'linear-gradient(135deg,#4d7c0f,#d9f99d)'],
    },
];
const MOCK_MS = 3600;

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

    // Hero phone rotates through HERO_MOCKS. Reduced motion → first one, fixed.
    const [mockIdx, setMockIdx] = useState(0);
    useEffect(() => {
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
        const id = setInterval(() => setMockIdx((i) => (i + 1) % HERO_MOCKS.length), MOCK_MS);
        return () => clearInterval(id);
    }, []);
    const mock = HERO_MOCKS[mockIdx];

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
                                        {/* Shablon maketlari almashib turadi (HERO_MOCKS). `key`
                                            har almashuvda qayta ulaydi — shunda kirish animatsiyasi
                                            takrorlanadi va tema o'zgaruvchilari kechikmasdan tushadi. */}
                                        <div className="pf-mock" data-m={mock.id} key={mock.id} aria-hidden="true">
                                            <div className="pfm-avatar">{mock.initial}</div>
                                            <div className="pfm-name">{mock.name}</div>
                                            <div className="pfm-bio">{t(`home.${mock.bio}`)}</div>
                                            <div className="pfm-links">
                                                {mock.links.map((l) => (
                                                    <span className="pfm-link" key={l.label || l.key}>
                                                        <i style={{ background: l.dot }}></i>
                                                        {l.label || t(`home.${l.key}`)}
                                                    </span>
                                                ))}
                                            </div>
                                            <div className="pfm-media">
                                                {mock.media.map((bg) => <span key={bg} style={{ background: bg }}></span>)}
                                            </div>
                                            <div className="pfm-url">mylink.asia/{mock.path}</div>
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

                {/* FEATURES — "Imkoniyatlar": blog-style alternating rows */}
                <section className="block" id="features">
                    <div className="wrap">
                        <div className="sec-head center reveal" style={{ maxWidth: 640 }}>
                            <span className="eyebrow">{t('home.feats_eyebrow')}</span>
                            <h2>{t('home.feats_title')}</h2>
                            <p style={{ marginInline: 'auto' }}>{t('home.feats_text')}</p>
                        </div>
                        <div className="featrows">
                            {/* 1 — Templates & colors */}
                            <div className="featrow reveal">
                                <div className="fr-tx">
                                    <h3>{t('home.ft1_title')}</h3>
                                    <p>{t('home.ft1_text')}</p>
                                </div>
                                <div className="fr-vis">
                                    <div className="fv-phones">
                                        <div className="fv-ph" style={{ background: 'linear-gradient(170deg,#2e2017,#160f0b)' }}>
                                            <span className="fv-dot" style={{ background: '#f0a23c' }}></span>
                                            <i></i><i></i><i style={{ width: '62%' }}></i>
                                        </div>
                                        <div className="fv-ph" style={{ background: 'linear-gradient(170deg,#2aa79f,#17615c)' }}>
                                            <span className="fv-dot" style={{ background: '#d7fef9' }}></span>
                                            <i></i><i></i><i style={{ width: '70%' }}></i>
                                        </div>
                                        <div className="fv-ph" style={{ background: 'linear-gradient(170deg,#4f46e5,#7c3aed)' }}>
                                            <span className="fv-dot" style={{ background: '#c7d2fe' }}></span>
                                            <i></i><i></i><i style={{ width: '55%' }}></i>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* 2 — Media & highlights */}
                            <div className="featrow rev reveal">
                                <div className="fr-tx">
                                    <h3>{t('home.ft2_title')}</h3>
                                    <p>{t('home.ft2_text')}</p>
                                </div>
                                <div className="fr-vis">
                                    <div className="fv-media">
                                        <div className="fv-rings">
                                            <span></span><span></span><span></span><span></span>
                                        </div>
                                        <div className="fv-grid">
                                            <b style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}></b>
                                            <b style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}></b>
                                            <b style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)' }}></b>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* 3 — QR / vizitka / promo */}
                            <div className="featrow reveal">
                                <div className="fr-tx">
                                    <h3>{t('home.ft3_title')}</h3>
                                    <p>{t('home.ft3_text')}</p>
                                </div>
                                <div className="fr-vis">
                                    <div className="fv-promo">
                                        <svg className="fv-qr" viewBox="0 0 21 21" aria-hidden="true">
                                            {[[0,0],[14,0],[0,14]].map(([x,y]) => (
                                                <g key={`${x}${y}`}>
                                                    <rect x={x} y={y} width="7" height="7" fill="none" stroke="#1a1830" strokeWidth="1.6" />
                                                    <rect x={x+2} y={y+2} width="3" height="3" fill="#1a1830" />
                                                </g>
                                            ))}
                                            {[[9,1],[11,3],[9,5],[13,9],[9,9],[11,11],[15,13],[9,15],[13,15],[17,17],[11,17],[15,9],[17,11],[19,9],[9,19],[19,15]].map(([x,y],i) => (
                                                <rect key={i} x={x} y={y} width="2" height="2" fill="#1a1830" />
                                            ))}
                                        </svg>
                                        <div className="fv-card">
                                            <b>MyLink</b>
                                            <span>mylink.asia/siz</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* 4 — Analytics */}
                            <div className="featrow rev reveal">
                                <div className="fr-tx">
                                    <h3>{t('home.ft4_title')}</h3>
                                    <p>{t('home.ft4_text')}</p>
                                </div>
                                <div className="fr-vis">
                                    <svg className="fv-chart" viewBox="0 0 260 140" aria-hidden="true">
                                        {[20, 60, 100, 140, 180, 220].map((x, i) => (
                                            <rect key={x} x={x} y={120 - [34, 52, 40, 72, 60, 92][i]} width="22"
                                                height={[34, 52, 40, 72, 60, 92][i]} rx="6"
                                                fill={i === 5 ? 'url(#fvg)' : '#e9e7f5'} />
                                        ))}
                                        <defs>
                                            <linearGradient id="fvg" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0" stopColor="#4f46e5" />
                                                <stop offset="1" stopColor="#8b5cf6" />
                                            </linearGradient>
                                        </defs>
                                        <polyline points="31,78 71,58 111,70 151,38 191,48 231,20"
                                            fill="none" stroke="#4f46e5" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                                        <circle cx="231" cy="20" r="5" fill="#4f46e5" />
                                    </svg>
                                </div>
                            </div>
                            {/* 5 — Team */}
                            <div className="featrow reveal">
                                <div className="fr-tx">
                                    <h3>{t('home.ft5_title')}</h3>
                                    <p>{t('home.ft5_text')}</p>
                                </div>
                                <div className="fr-vis">
                                    <div className="fv-team">
                                        <div className="fv-avs">
                                            <span style={{ background: 'linear-gradient(135deg,#4f46e5,#8b5cf6)' }}>B</span>
                                            <span style={{ background: 'linear-gradient(135deg,#06b6d4,#3b82f6)' }}>D</span>
                                            <span style={{ background: 'linear-gradient(135deg,#f59e0b,#ef4444)' }}>S</span>
                                        </div>
                                        <div className="fv-roles">
                                            <em style={{ background: '#dbeafe', color: '#1e40af' }}>{t('team.role_admin')}</em>
                                            <em style={{ background: '#dcfce7', color: '#166534' }}>{t('team.role_editor')}</em>
                                            <em style={{ background: '#f3f4f6', color: '#374151' }}>{t('team.role_viewer')}</em>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {/* 6 — NFC (real card image) */}
                            <div className="featrow rev reveal">
                                <div className="fr-tx">
                                    <h3>{t('home.ft6_title')}</h3>
                                    <p>{t('home.ft6_text')}</p>
                                    <Link to="/nfc" className="fr-more">{t('home.ft6_more')} →</Link>
                                </div>
                                <div className="fr-vis fv-dark">
                                    <img src="/nfc-cards/card-1.webp" alt="MyLink NFC card" className="fv-nfc" loading="lazy" />
                                </div>
                            </div>
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
                                <a className="ci" href={`mailto:${c.email}`}><span className="ic"><FaEnvelope /></span><div><b>{c.email}</b><span>{t('home.ci_email')}</span></div></a>
                                <a className="ci" href={`tel:${c.phone.replace(/\s/g, '')}`}><span className="ic"><FaPhoneAlt /></span><div><b>{c.phone}</b><span>{t('home.ci_phone')}</span></div></a>
                                <a className="ci" href={c.tgUrl} target="_blank" rel="noreferrer"><span className="ic"><FaTelegramPlane /></span><div><b>{c.telegram}</b><span>{t('home.ci_tg')}</span></div></a>
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
