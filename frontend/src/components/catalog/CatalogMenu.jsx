import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Ic, Seal } from './icons';
import CatalogLightbox from './CatalogLightbox';
import ProductModal from './ProductModal';
import CartSheet from './CartSheet';
import { themeTexture, themeVars } from '../../lib/catalogThemes';
import { formatPrice } from '../../lib/format';
import { useCart } from '../../lib/catalogCart';
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

const Card = ({ item, currency, layout, onOpen, cartEnabled, qty, onAdd, onSetQty, t }) => {
    const sold = !item.is_available;
    // The stepper sits on top of the card, so its clicks must not open the modal.
    const stop = (e) => { e.stopPropagation(); };
    return (
        <article
            className={`menu-card menu-c${layout === 'grid' ? 'g' : 'l'}${sold ? ' is-sold' : ''}`}
            onClick={() => onOpen(item)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(item); } }}
        >
            <Thumb item={item} cls={layout === 'grid' ? 'menu-th-g' : 'menu-th-s'} />
            <span className="menu-cb">
                <span className="menu-cnom">{item.name}</span>
                {item.description ? <span className="menu-ct">{item.description}</span> : null}
                <span className="menu-crow">
                    <Narx item={item} currency={currency} />
                    {cartEnabled && !sold && (
                        qty > 0 ? (
                            <span className="menu-step" onClick={stop} role="presentation">
                                <button type="button" onClick={() => onSetQty(item, qty - 1)} aria-label="−">
                                    <Ic n="minus" s={13} w={2.4} />
                                </button>
                                <b>{qty}</b>
                                <button type="button" onClick={() => onAdd(item, 1)} aria-label="+">
                                    <Ic n="plus" s={13} w={2.4} />
                                </button>
                            </span>
                        ) : (
                            <button
                                type="button" className="menu-addbtn"
                                onClick={(e) => { stop(e); onAdd(item, 1); }}
                                aria-label={t('menu.add_to_cart')}
                            >
                                <Ic n="plus" s={15} w={2.6} />
                            </button>
                        )
                    )}
                </span>
            </span>
            {sold ? <span className="menu-soldtag">{t('menu.sold_out')}</span> : null}
        </article>
    );
};

/**
 * The web-menu itself, themed from the catalog payload. Rendered standalone on
 * /:path/menu (document scroll, desktop gets a category rail) and inside the
 * editor's phone preview with `embedded` — which keeps the phone layout at any
 * viewport and turns off the overlays that would cover the editor.
 */
const CatalogMenu = ({ data, embedded = false }) => {
    const { t } = useTranslation();
    const categories = useMemo(() => data.categories || [], [data.categories]);
    const biz = data.business || {};
    const [act, setAct] = useState(categories[0]?.id ?? null);
    const [query, setQuery] = useState('');
    const [layout, setLayout] = useState(data.card_style === 'list' ? 'list' : 'grid');
    const [product, setProduct] = useState(null);
    const [lb, setLb] = useState(null);
    const [cartOpen, setCartOpen] = useState(false);
    const scRef = useRef(null);
    const secRefs = useRef({});
    // Ignore scroll-sync while a chip/rail click glides to its section.
    const lock = useRef(false);
    const lockTimer = useRef(null);
    useEffect(() => () => clearTimeout(lockTimer.current), []);

    const cart = useCart(embedded ? null : biz.path);
    const cartEnabled = !!data.cart_enabled && !embedded;

    const vars = themeVars(data.theme, data.theme_mode);
    const tex = themeTexture(data.theme, data.theme_mode);

    // The owner's default applies until the visitor picks a view; when the
    // owner switches it (editor preview) the view follows. Render-phase
    // adjustment per the React docs — an effect here would cascade a render.
    const [prevCard, setPrevCard] = useState(data.card_style);
    if (prevCard !== data.card_style) {
        setPrevCard(data.card_style);
        setLayout(data.card_style === 'list' ? 'list' : 'grid');
    }

    const q = query.trim().toLowerCase();
    const results = useMemo(() => {
        if (!q) return null;
        const hits = [];
        categories.forEach((c) => c.items.forEach((it) => {
            if (it.name.toLowerCase().includes(q) || (it.description || '').toLowerCase().includes(q)) {
                hits.push(it);
            }
        }));
        return hits;
    }, [q, categories]);

    // Highlight the category currently under the sticky bar.
    useEffect(() => {
        if (!categories.length || results) return undefined;
        const target = embedded ? scRef.current : window;
        if (!target) return undefined;
        const onScroll = () => {
            if (lock.current) return;
            const base = embedded ? scRef.current.getBoundingClientRect().top : 0;
            const line = base + 130;
            let cur = categories[0].id;
            categories.forEach((c) => {
                const el = secRefs.current[c.id];
                if (el && el.getBoundingClientRect().top <= line) cur = c.id;
            });
            setAct(cur);
        };
        target.addEventListener('scroll', onScroll, { passive: true });
        return () => target.removeEventListener('scroll', onScroll);
    }, [categories, embedded, results]);

    const pick = (id) => {
        setAct(id);
        lock.current = true;
        clearTimeout(lockTimer.current);
        lockTimer.current = setTimeout(() => { lock.current = false; }, 700);
        const el = secRefs.current[id];
        if (!el) return;
        if (embedded) {
            const sc = scRef.current;
            const delta = el.getBoundingClientRect().top - sc.getBoundingClientRect().top;
            sc.scrollTo({ top: sc.scrollTop + delta - 114, behavior: 'smooth' });
        } else {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const bannerStyle = data.banner
        ? undefined
        : { backgroundImage: `linear-gradient(160deg, color-mix(in oklab, ${vars['--accent']} 88%, ${vars['--bg']}), color-mix(in oklab, ${vars['--a2']} 88%, ${vars['--bg']}))` };

    const cardProps = {
        currency: data.currency, layout, cartEnabled, t,
        onOpen: setProduct, onAdd: cart.add, onSetQty: cart.setQty,
    };

    return (
        <div className={`menu-root${embedded ? ' menu-embed' : ''}`} style={vars}>
            <span className="menu-tex" style={tex} />
            <div className="menu-scroll" ref={scRef}>
                <div className="menu-banner" style={bannerStyle}>
                    {data.banner ? <img src={data.banner} alt="" /> : null}
                    <span className="menu-bpat" />
                </div>

                <header className="menu-hero">
                    {biz.logo
                        ? <img className="menu-logo" src={biz.logo} alt="" />
                        : <span className="menu-logo">{(biz.name || '?').charAt(0)}</span>}
                    <Link className="menu-back" to={`/${biz.path}`}>
                        <Ic n="back" s={13} w={2.4} />{t('menu.back')}
                    </Link>
                    <div className="menu-bizname">
                        <b>
                            {biz.name}
                            {biz.verified && <Seal s={17} c="var(--accent)" style={{ marginLeft: 7, flex: 'none' }} />}
                        </b>
                        {biz.description && <i>{biz.description}</i>}
                    </div>
                </header>

                {/* Search + view switch + chips travel together and pin to the
                    top, so the visitor can search from anywhere in the menu. */}
                {categories.length > 0 && (
                    <div className="menu-stick">
                        <div className="menu-wrap">
                            <div className="menu-tools">
                                <label className="menu-search">
                                    <Ic n="search" s={17} w={2} />
                                    <input
                                        type="search" value={query} placeholder={t('menu.search_ph')}
                                        onChange={(e) => setQuery(e.target.value)}
                                    />
                                    {query && (
                                        <button type="button" onClick={() => setQuery('')} aria-label={t('common.cancel')}>
                                            <Ic n="x" s={14} w={2.2} />
                                        </button>
                                    )}
                                </label>
                                <div className="menu-views">
                                    <button
                                        type="button" className={layout === 'grid' ? 'on' : ''}
                                        onClick={() => setLayout('grid')} aria-label={t('catalog.card_grid')}
                                    >
                                        <Ic n="grid" s={17} w={1.7} />
                                    </button>
                                    <button
                                        type="button" className={layout === 'list' ? 'on' : ''}
                                        onClick={() => setLayout('list')} aria-label={t('catalog.card_list')}
                                    >
                                        <Ic n="rows" s={17} w={2} />
                                    </button>
                                </div>
                            </div>
                        </div>
                        {!results && (
                            <nav className="menu-chips">
                                <div className="menu-chipsrow">
                                    {categories.map((c) => (
                                        <button
                                            key={c.id} type="button"
                                            className={`menu-chip${act === c.id ? ' on' : ''}`}
                                            onClick={() => pick(c.id)}
                                        >
                                            {c.name}
                                        </button>
                                    ))}
                                </div>
                            </nav>
                        )}
                    </div>
                )}

                {categories.length === 0 ? (
                    <div className="menu-state">
                        <span className="menu-stico"><Ic n="book" s={26} w={1.6} /></span>
                        <h3>{t('menu.empty_title')}</h3>
                        <p>{t('menu.empty')}</p>
                    </div>
                ) : results ? (
                    <div className="menu-wrap menu-results">
                        <h2 className="menu-kh">
                            {t('menu.results')}<i>{t('menu.item_count', { n: results.length })}</i>
                        </h2>
                        {results.length === 0 ? (
                            <p className="menu-noresult">{t('menu.no_results', { q: query.trim() })}</p>
                        ) : (
                            <div className={layout === 'grid' ? 'menu-grid' : 'menu-list'}>
                                {results.map((item) => (
                                    <Card key={item.id} item={item} qty={cart.qtyOf(item.id)} {...cardProps} />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="menu-wrap">
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
                                            <Card key={item.id} item={item} qty={cart.qtyOf(item.id)} {...cardProps} />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </div>
                )}

                <footer className="menu-foot">
                    <Link className="menu-fbiz" to={`/${biz.path}`}>{biz.name}</Link>
                    <a className="menu-pow" href="https://mylink.asia" target="_blank" rel="noopener noreferrer">
                        <img className="menu-mk" src="/brand/appicon-192.png" alt="MyLink" />
                        {t('menu.powered_by')}
                    </a>
                </footer>
            </div>

            {cartEnabled && cart.count > 0 && (
                <button type="button" className="menu-cartbar" onClick={() => setCartOpen(true)}>
                    <span className="menu-cartico"><Ic n="cart" s={17} /><i>{cart.count}</i></span>
                    <span className="menu-cartlbl">{t('menu.cart')}</span>
                    <b>{formatPrice(cart.total)} {data.currency}</b>
                </button>
            )}

            {product && (
                <ProductModal
                    item={product} currency={data.currency} cartEnabled={cartEnabled}
                    qty={cart.qtyOf(product.id)} onAdd={cart.add} onSetQty={cart.setQty}
                    onZoom={(i) => setLb({ images: product.images, name: product.name, start: i })}
                    onClose={() => setProduct(null)} paused={!!lb}
                />
            )}

            {cartOpen && (
                <CartSheet
                    cart={cart} currency={data.currency} order={data.order}
                    orderLabel={data.order_label} businessName={biz.name}
                    onClose={() => setCartOpen(false)}
                />
            )}

            {lb && (
                <CatalogLightbox
                    images={lb.images} title={lb.name} start={lb.start || 0}
                    onClose={() => setLb(null)}
                />
            )}
        </div>
    );
};

export default CatalogMenu;
