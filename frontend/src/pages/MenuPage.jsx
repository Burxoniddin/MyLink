import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import CatalogLightbox from '../components/catalog/CatalogLightbox';
import { formatPrice } from '../lib/format';
import VerifiedBadge from '../components/VerifiedBadge';
import './MenuPage.css';

/**
 * Public mini web-menu at /:path/menu — the page a restaurant's table QR opens.
 * Mobile-first, dark, standalone (no .landing-page styles): banner, sticky
 * category chips, product cards, fullscreen image carousel.
 */
const MenuPage = () => {
    const { path } = useParams();
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [activeCat, setActiveCat] = useState(null);
    const [lightbox, setLightbox] = useState(null); // { images, title }
    const sectionRefs = useRef({});
    const chipsRef = useRef(null);
    // Chip taps scroll the page; ignore the observer until the scroll settles.
    const clickScroll = useRef(null);

    useEffect(() => {
        let active = true;
        api.get(`public/${path}/catalog/`)
            .then((res) => {
                if (!active) return;
                setData(res.data);
                setActiveCat(res.data.categories[0]?.id ?? null);
                document.title = `${res.data.business.name} — ${res.data.button_label || 'Menu'}`;
            })
            .catch(() => { if (active) setError(true); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [path]);

    // Highlight the chip of the category currently on screen.
    useEffect(() => {
        if (!data) return undefined;
        const observer = new IntersectionObserver(
            (entries) => {
                if (clickScroll.current) return;
                const visible = entries.filter((e) => e.isIntersecting);
                if (visible.length) {
                    const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                    setActiveCat(Number(top.target.dataset.cat));
                }
            },
            { rootMargin: '-96px 0px -55% 0px' },
        );
        Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el));
        return () => observer.disconnect();
    }, [data]);

    // Keep the active chip visible inside the horizontally scrolling bar.
    useEffect(() => {
        if (activeCat === null) return;
        chipsRef.current
            ?.querySelector(`[data-chip="${activeCat}"]`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }, [activeCat]);

    const jumpTo = (cid) => {
        setActiveCat(cid);
        clearTimeout(clickScroll.current);
        clickScroll.current = setTimeout(() => { clickScroll.current = null; }, 700);
        sectionRefs.current[cid]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    if (loading) {
        return (
            <div className="menu-page menu-center">
                <div className="menu-spinner" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="menu-page menu-center">
                <div className="menu-notfound">
                    <span className="menu-notfound-icon">🍽️</span>
                    <h1>{t('menu.not_found')}</h1>
                    <p>{t('menu.not_found_desc')}</p>
                    <Link to={`/${path}`} className="menu-back-btn">{t('menu.back')}</Link>
                </div>
            </div>
        );
    }

    const { business, categories, currency } = data;

    return (
        <div className="menu-page">
            {/* Banner / hero */}
            <div className="menu-hero">
                {data.banner
                    ? <img className="menu-banner" src={data.banner} alt="" />
                    : <div className="menu-banner menu-banner-fallback" />}
                <div className="menu-hero-overlay" />
                <Link to={`/${business.path}`} className="menu-biz">
                    {business.logo
                        ? <img className="menu-biz-logo" src={business.logo} alt="" />
                        : <span className="menu-biz-logo menu-biz-initial">{business.name.charAt(0)}</span>}
                    <span className="menu-biz-name">
                        {business.name}
                        {business.verified && <VerifiedBadge size={15} />}
                    </span>
                </Link>
            </div>

            {categories.length === 0 ? (
                <div className="menu-center" style={{ minHeight: '40vh' }}>
                    <p className="menu-empty">{t('menu.empty')}</p>
                </div>
            ) : (
                <>
                    {/* Sticky category chips */}
                    <nav className="menu-chips" ref={chipsRef}>
                        {categories.map((c) => (
                            <button
                                key={c.id} type="button" data-chip={c.id}
                                className={`menu-chip ${activeCat === c.id ? 'on' : ''}`}
                                onClick={() => jumpTo(c.id)}
                            >
                                {c.name}
                            </button>
                        ))}
                    </nav>

                    {/* Category sections */}
                    <main className="menu-body">
                        {categories.map((c) => (
                            <section
                                key={c.id}
                                data-cat={c.id}
                                ref={(el) => { sectionRefs.current[c.id] = el; }}
                                className="menu-section"
                            >
                                <h2 className="menu-section-title">{c.name}</h2>
                                <div className="menu-cards">
                                    {c.items.map((item) => {
                                        const cover = item.images[0];
                                        const unavailable = !item.is_available;
                                        return (
                                            <article
                                                key={item.id}
                                                className={`menu-card ${unavailable ? 'off' : ''}`}
                                                onClick={() => {
                                                    if (item.images.length) {
                                                        setLightbox({ images: item.images, title: item.name });
                                                    }
                                                }}
                                            >
                                                {cover && (
                                                    <div className="menu-card-img">
                                                        <img src={cover.thumb || cover.image} alt={item.name} loading="lazy" />
                                                        {item.images.length > 1 && (
                                                            <span className="menu-card-count">{item.images.length}</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="menu-card-info">
                                                    <h3 className="menu-card-name">{item.name}</h3>
                                                    {item.description && (
                                                        <p className="menu-card-desc">{item.description}</p>
                                                    )}
                                                    <div className="menu-card-price">
                                                        {item.old_price ? (
                                                            <s>{formatPrice(item.old_price)}</s>
                                                        ) : null}
                                                        <strong>{formatPrice(item.price)} {currency}</strong>
                                                        {unavailable && (
                                                            <span className="menu-soldout">{t('menu.sold_out')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            </section>
                        ))}
                    </main>
                </>
            )}

            <footer className="menu-footer">
                <Link to={`/${business.path}`}>{business.name}</Link>
                <span className="menu-footer-dot">·</span>
                <a href="https://mylink.asia" target="_blank" rel="noopener noreferrer">MyLink</a>
            </footer>

            {lightbox && (
                <CatalogLightbox
                    images={lightbox.images}
                    title={lightbox.title}
                    onClose={() => setLightbox(null)}
                />
            )}
        </div>
    );
};

export default MenuPage;
