import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ic, Seal } from './icons';
import CatalogLightbox from './CatalogLightbox';
import { themeTexture, themeVars } from '../../lib/catalogThemes';
import { formatPrice } from '../../lib/format';
import '../../pages/MenuPage.css';

const Thumb = ({ item, cls }) => {
    const cover = item.images?.[0];
    const count = item.images?.length || 0;
    return (
        <span className={`menu-th ${cls}`}>
            {cover
                ? <img src={cover.thumb || cover.image} alt="" loading="lazy" />
                : <span className="menu-thl">{item.name.charAt(0)}</span>}
            {cover && <span className="menu-shine" />}
            {count > 1 && (
                <span className="menu-imgn"><Ic n="layers" s={10} w={2.4} />{count}</span>
            )}
        </span>
    );
};

const Narx = ({ item, currency }) => (
    <span className="menu-narx">
        {item.old_price ? <s>{formatPrice(item.old_price)}</s> : null}
        <b>{formatPrice(item.price)}<i> {currency}</i></b>
    </span>
);

const Card = ({ item, currency, layout, onOpen, t }) => {
    const sold = !item.is_available;
    const tappable = (item.images?.length || 0) > 0 && !sold && !!onOpen;
    return (
        <button
            type="button"
            className={`menu-card menu-c${layout === 'grid' ? 'g' : 'l'}${sold ? ' is-sold' : ''}${tappable ? ' is-tap' : ''}`}
            onClick={tappable ? () => onOpen(item) : undefined}
        >
            <Thumb item={item} cls={layout === 'grid' ? 'menu-th-g' : 'menu-th-s'} />
            <span className="menu-cb">
                <span className="menu-cnom">{item.name}</span>
                {item.description ? <span className="menu-ct">{item.description}</span> : null}
                <Narx item={item} currency={currency} />
            </span>
            {sold ? <span className="menu-soldtag">{t('menu.sold_out')}</span> : null}
        </button>
    );
};

const Chips = ({ categories, act, onPick }) => {
    const wrap = useRef(null);
    useEffect(() => {
        const w = wrap.current;
        const el = w?.querySelector('.menu-chip.on');
        if (!w || !el) return;
        w.scrollTo({
            left: Math.max(0, el.offsetLeft - w.clientWidth / 2 + el.offsetWidth / 2),
            behavior: 'smooth',
        });
    }, [act]);
    return (
        <nav className="menu-chips">
            <div className="menu-chipsrow" ref={wrap}>
                {categories.map((c) => (
                    <button
                        key={c.id} type="button"
                        className={`menu-chip${act === c.id ? ' on' : ''}`}
                        onClick={() => onPick(c.id)}
                    >
                        {c.name}
                    </button>
                ))}
            </div>
        </nav>
    );
};

/**
 * The web-menu itself, themed from the catalog payload. Rendered twice:
 * standalone on /:path/menu (document scroll) and inside the editor's phone
 * preview with `embedded` (own scroller, phone layout at any viewport, no
 * lightbox — a fixed overlay would cover the whole editor).
 */
const CatalogMenu = ({ data, embedded = false }) => {
    const { t } = useTranslation();
    // Stable identity so the scroll-sync effect doesn't resubscribe every render.
    const categories = useMemo(() => data.categories || [], [data.categories]);
    const [act, setAct] = useState(categories[0]?.id ?? null);
    const [lb, setLb] = useState(null);
    const scRef = useRef(null);
    const secRefs = useRef({});
    const lock = useRef(0); // ignore scroll sync while a chip-click glide runs

    const vars = themeVars(data.theme, data.theme_mode);
    const tex = themeTexture(data.theme, data.theme_mode);
    const layout = data.card_style === 'grid' ? 'grid' : 'list';
    const biz = data.business || {};

    // Highlight the chip of the category currently under the sticky bar.
    useEffect(() => {
        if (!categories.length) return undefined;
        const target = embedded ? scRef.current : window;
        if (!target) return undefined;
        const onScroll = () => {
            if (Date.now() < lock.current) return;
            const base = embedded ? scRef.current.getBoundingClientRect().top : 0;
            const line = base + 120;
            let cur = categories[0].id;
            categories.forEach((c) => {
                const el = secRefs.current[c.id];
                if (el && el.getBoundingClientRect().top <= line) cur = c.id;
            });
            setAct(cur);
        };
        target.addEventListener('scroll', onScroll, { passive: true });
        return () => target.removeEventListener('scroll', onScroll);
    }, [categories, embedded]);

    const pick = (id) => {
        setAct(id);
        lock.current = Date.now() + 700;
        const el = secRefs.current[id];
        if (!el) return;
        if (embedded) {
            const sc = scRef.current;
            const delta = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
            sc.scrollTo({ top: sc.scrollTop + delta - 56, behavior: 'smooth' });
        } else {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const bannerStyle = data.banner
        ? undefined
        : { backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${vars['--accent']} 88%, ${vars['--bg']}), color-mix(in oklab, ${vars['--a2']} 88%, ${vars['--bg']}))` };

    return (
        <div className={`menu-root${embedded ? ' menu-embed' : ''}`} style={vars}>
            <span className="menu-tex" style={tex} />
            <div className="menu-scroll" ref={scRef}>
                <div className="menu-banner" style={bannerStyle}>
                    {data.banner ? <img src={data.banner} alt="" /> : null}
                    <span className="menu-bpat" />
                </div>

                <Link className="menu-biz" to={`/${biz.path}`}>
                    {biz.logo
                        ? <img className="menu-logo" src={biz.logo} alt="" />
                        : <span className="menu-logo">{(biz.name || '?').charAt(0)}</span>}
                    <span className="menu-bizt">
                        <b>
                            {biz.name}
                            {biz.verified && <Seal s={15} c="var(--accent)" />}
                        </b>
                        <i>{t('menu.back')}</i>
                    </span>
                    <Ic n="chevR" s={15} className="menu-bizch" />
                </Link>

                {categories.length === 0 ? (
                    <div className="menu-state">
                        <span className="menu-stico"><Ic n="book" s={26} w={1.6} /></span>
                        <h3>{t('menu.empty_title')}</h3>
                        <p>{t('menu.empty')}</p>
                    </div>
                ) : (
                    <>
                        <Chips categories={categories} act={act} onPick={pick} />
                        <div className="menu-body">
                            {categories.map((c) => (
                                <section
                                    key={c.id} className="menu-sec"
                                    ref={(el) => { secRefs.current[c.id] = el; }}
                                >
                                    <h2 className="menu-kh">
                                        {c.name}<i>{t('menu.item_count', { n: c.items.length })}</i>
                                    </h2>
                                    <div className={layout === 'grid' ? 'menu-grid' : 'menu-list'}>
                                        {c.items.map((item) => (
                                            <Card
                                                key={item.id} item={item} layout={layout}
                                                currency={data.currency}
                                                onOpen={embedded ? null : setLb} t={t}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                            <footer className="menu-foot">
                                <Link className="menu-fbiz" to={`/${biz.path}`}>{biz.name}</Link>
                                <a className="menu-pow" href="https://mylink.asia" target="_blank" rel="noopener noreferrer">
                                    <span className="menu-mk" />{t('menu.powered_by')}
                                </a>
                            </footer>
                        </div>
                    </>
                )}
            </div>

            {lb && (
                <CatalogLightbox
                    images={lb.images} title={lb.name} onClose={() => setLb(null)}
                />
            )}
        </div>
    );
};

export default CatalogMenu;
