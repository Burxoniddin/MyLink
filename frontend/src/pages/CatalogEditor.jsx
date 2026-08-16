import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from '../components/Toast';
import ItemModal from '../components/catalog/ItemModal';
import CatalogMenu from '../components/catalog/CatalogMenu';
import { Ic } from '../components/catalog/icons';
import { CATALOG_THEMES } from '../lib/catalogThemes';
import { formatPrice } from '../lib/format';
import '../components/catalog/catalog.css';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MAX_CATEGORIES = 20;
const PUBLIC_ORIGIN = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.origin
    : 'https://mylink.asia';

// Typed fields wait for the Save button; everything else applies immediately.
const TEXT_FIELDS = ['name', 'button_label', 'currency', 'order_link', 'order_label'];
const pickText = (c) => Object.fromEntries(TEXT_FIELDS.map((k) => [k, c[k] ?? '']));

/* ---- one product row inside an expanded category ---- */
const ItemRow = ({ item, onEdit, onDelete, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const cover = item.images?.[0];
    return (
        <div ref={setNodeRef} style={style} className={`ed-item${item.is_available ? '' : ' off'}`}>
            <span {...attributes} {...listeners}><Ic n="drag" s={14} className="ed-drag" /></span>
            <span className="ed-thumb">
                {cover ? <img src={cover.thumb || cover.image} alt="" /> : item.name.charAt(0)}
            </span>
            <span className="ed-inom">{item.name}</span>
            <span className="ed-inarx">
                {item.old_price ? <s>{formatPrice(item.old_price)}</s> : null}
                {formatPrice(item.price)}
            </span>
            <span
                className={`ed-dot${item.is_available ? '' : ' off'}`}
                title={item.is_available ? t('catalog.available') : t('catalog.unavailable')}
            />
            <button type="button" className="ed-ico" onClick={() => onEdit(item)} aria-label={t('common.edit')}>
                <Ic n="pen" s={14} />
            </button>
            <button type="button" className="ed-ico danger" onClick={() => onDelete(item)} aria-label={t('common.delete')}>
                <Ic n="trash" s={14} />
            </button>
        </div>
    );
};

/* ---- one collapsible category ---- */
const CatRow = ({ cat, open, onToggle, onRename, onDelete, children, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: cat.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const [name, setName] = useState(cat.name);
    const [prev, setPrev] = useState(cat.name);
    if (prev !== cat.name) { setPrev(cat.name); setName(cat.name); }
    return (
        <div ref={setNodeRef} style={style} className={`ed-kat${open ? ' open' : ''}`}>
            <div className="ed-krow">
                <span {...attributes} {...listeners}><Ic n="drag" s={14} className="ed-drag" /></span>
                <input
                    className="ed-knom" value={name}
                    placeholder={t('catalog.category_ph')}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => { if (name.trim() && name !== cat.name) onRename(cat.id, name.trim()); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                />
                <span className="ed-kcount">{cat.items?.length || 0}</span>
                <button type="button" className="ed-ico danger" onClick={() => onDelete(cat)} aria-label={t('common.delete')}>
                    <Ic n="trash" s={13} />
                </button>
                <button type="button" className="ed-ico" onClick={() => onToggle(cat.id)} aria-label={cat.name}>
                    <Ic n="chevD" s={14} className="ed-kchev" />
                </button>
            </div>
            {open && <div className="ed-items">{children}</div>}
        </div>
    );
};

const CatalogEditor = () => {
    const { id } = useParams();
    const { t } = useTranslation();
    const toast = useToast();
    const navigate = useNavigate();
    const { entitlements } = useEntitlements();
    const [catalog, setCatalog] = useState(null);
    const [businesses, setBusinesses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(null);
    const [modal, setModal] = useState(null);
    const [copied, setCopied] = useState(false);
    const [bannerBusy, setBannerBusy] = useState(false);
    const [form, setForm] = useState(null);
    const [saving, setSaving] = useState(false);
    const bannerInput = useRef(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const canCatalog = !!entitlements?.features?.catalog;

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return undefined; }
        let active = true;
        Promise.all([api.get(`catalogs/${id}/`), api.get('businesses/')])
            .then(([catRes, bizRes]) => {
                if (!active) return;
                setCatalog(catRes.data);
                setForm(pickText(catRes.data));
                setBusinesses(bizRes.data.filter((b) => b.role === 'owner'));
            })
            .catch((err) => {
                if (err.response?.status === 401) navigate('/login');
                else if (err.response?.status === 404) navigate('/catalogs');
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const attached = !!catalog?.business;
    const menuUrl = attached ? `${PUBLIC_ORIGIN}/${catalog.business_path}/menu` : null;

    const setField = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const dirty = !!form && !!catalog && TEXT_FIELDS.some((k) => (form[k] ?? '') !== (catalog[k] ?? ''));

    const showErr = (err) => {
        const reason = err?.response?.data?.reason;
        const key = `catalog.err_${reason}`;
        toast.error(reason && t(key) !== key ? t(key) : t('common.error'));
    };

    const refetch = async () => {
        try {
            const res = await api.get(`catalogs/${id}/`);
            setCatalog(res.data);
        } catch (err) { showErr(err); }
    };

    // Optimistic for appearance switches (they drive the live preview), with a
    // refetch-free rollback if the API rejects.
    const saveField = async (patch, optimistic = false) => {
        const before = catalog;
        if (optimistic) setCatalog((c) => ({ ...c, ...patch }));
        try {
            const res = await api.patch(`catalogs/${id}/`, patch);
            setCatalog(res.data);
        } catch (err) {
            if (optimistic) setCatalog(before);
            showErr(err);
        }
    };

    const saveAll = async () => {
        if (!dirty || saving) return;
        setSaving(true);
        const patch = {};
        TEXT_FIELDS.forEach((k) => {
            if ((form[k] ?? '') !== (catalog[k] ?? '')) patch[k] = form[k];
        });
        try {
            const res = await api.patch(`catalogs/${id}/`, patch);
            setCatalog(res.data);
            setForm(pickText(res.data));
            toast.success(t('detail.saved'));
        } catch (err) { showErr(err); } finally { setSaving(false); }
    };

    const uploadBanner = async (file) => {
        setBannerBusy(true);
        try {
            const fd = new FormData();
            fd.append('banner_upload', file);
            const res = await api.patch(`catalogs/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            setCatalog(res.data);
        } catch (err) { showErr(err); } finally { setBannerBusy(false); }
    };

    const deleteCatalog = async () => {
        if (!window.confirm(t('catalog.confirm_delete_catalog'))) return;
        try {
            await api.delete(`catalogs/${id}/`);
            navigate('/catalogs');
        } catch (err) { showErr(err); }
    };

    const downloadQr = async () => {
        try {
            const res = await api.get(`catalogs/${id}/qr.png`, { responseType: 'blob' });
            const url = URL.createObjectURL(res.data);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${catalog.business_path || 'menu'}-qr.png`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (err) { showErr(err); }
    };

    const copyLink = () => {
        navigator.clipboard?.writeText(menuUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
    };

    /* ---- categories ---- */
    const patchCats = (fn) => setCatalog((c) => ({ ...c, categories: fn(c.categories || []) }));

    const addCategory = async () => {
        try {
            const res = await api.post(`catalogs/${id}/categories/`, { name: t('catalog.new_category') });
            patchCats((cs) => [...cs, { ...res.data, items: res.data.items || [] }]);
            setOpen(res.data.id);
        } catch (err) { showErr(err); }
    };

    const renameCategory = async (cid, name) => {
        try {
            const res = await api.patch(`catalog/categories/${cid}/`, { name });
            patchCats((cs) => cs.map((c) => (c.id === cid ? { ...c, name: res.data.name } : c)));
        } catch (err) { showErr(err); }
    };

    const deleteCategory = async (cat) => {
        if (!window.confirm(t('catalog.confirm_delete_category'))) return;
        try {
            await api.delete(`catalog/categories/${cat.id}/`);
            patchCats((cs) => cs.filter((c) => c.id !== cat.id));
        } catch (err) { showErr(err); }
    };

    const onCatDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const cs = catalog.categories || [];
        const next = arrayMove(cs, cs.findIndex((c) => c.id === active.id), cs.findIndex((c) => c.id === over.id));
        patchCats(() => next);
        try {
            await api.post(`catalogs/${id}/categories/reorder/`, { order: next.map((c) => c.id) });
        } catch (err) { showErr(err); }
    };

    /* ---- items ---- */
    const deleteItem = (cat) => async (item) => {
        if (!window.confirm(t('catalog.confirm_delete_item'))) return;
        try {
            await api.delete(`catalog/items/${item.id}/`);
            patchCats((cs) => cs.map((c) => (
                c.id === cat.id ? { ...c, items: (c.items || []).filter((i) => i.id !== item.id) } : c
            )));
        } catch (err) { showErr(err); }
    };

    const onItemDragEnd = (cat) => async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const items = cat.items || [];
        const next = arrayMove(items, items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
        patchCats((cs) => cs.map((c) => (c.id === cat.id ? { ...c, items: next } : c)));
        try {
            await api.post(`catalogs/${id}/items/reorder/`, { order: next.map((i) => i.id) });
        } catch (err) { showErr(err); }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner" /><p>{t('common.loading')}</p></div>;
    }
    if (!catalog) return null;

    const categories = catalog.categories || [];
    // The preview renders the exact public payload shape; unsaved text is
    // merged in so typing a currency or label shows up straight away.
    const previewData = {
        ...catalog,
        ...(form || {}),
        business: attached
            ? {
                name: catalog.business_name, path: catalog.business_path,
                description: businesses.find((b) => b.id === catalog.business)?.description || '',
                logo: null, verified: false,
            }
            : { name: t('catalog.not_attached'), path: '', description: '', logo: null, verified: false },
        categories: categories.filter((c) => (c.items || []).length > 0),
    };

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container cat-scope">
                    <div className="ed-top">
                        <Link
                            to="/catalogs" className="mc-btn sm ghost"
                            onClick={(e) => {
                                if (dirty && !window.confirm(t('catalog.leave_unsaved'))) e.preventDefault();
                            }}
                        >
                            <Ic n="back" s={14} />{t('catalog.back')}
                        </Link>
                        <h1 className="ed-h1">
                            <input
                                value={form?.name ?? ''} placeholder={t('catalog.name_ph')} maxLength={100}
                                onChange={(e) => setField('name', e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveAll(); }}
                            />
                        </h1>
                        <button
                            type="button" className="mc-btn sm grad"
                            onClick={saveAll} disabled={!dirty || saving}
                        >
                            {saving ? t('detail.saving') : t('common.save')}
                        </button>
                        <button type="button" className="mc-btn sm danger" onClick={deleteCatalog}>{t('common.delete')}</button>
                    </div>
                    {dirty && <p className="ed-note" style={{ marginBottom: 14 }}>
                        <Ic n="warn" s={12} w={2} style={{ flex: 'none', marginTop: 2 }} />
                        {t('catalog.unsaved')}
                    </p>}

                    {!canCatalog && (
                        <p className="ed-note" style={{ marginBottom: 16 }}>
                            <Ic n="warn" s={12} w={2} style={{ flex: 'none', marginTop: 2 }} />
                            {t('catalog.downgraded_note')}
                        </p>
                    )}

                    <div className="ed-cols">
                        {/* ---- column 1: settings + appearance ---- */}
                        <div className="ed-col1">
                            <div className="mc-card">
                                <h3 className="mc-ch">{t('catalog.settings')}</h3>

                                <label className="ed-lab" htmlFor="cat-biz">{t('catalog.attach_business')}</label>
                                <select
                                    id="cat-biz" className="ed-select" value={catalog.business || ''}
                                    onChange={(e) => saveField({ business: e.target.value ? Number(e.target.value) : null })}
                                >
                                    <option value="">{t('catalog.not_attached_option')}</option>
                                    {businesses.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name} — /{b.path}</option>
                                    ))}
                                </select>

                                {attached ? (
                                    <>
                                        <label className="ed-lab">{t('catalog.menu_link')}</label>
                                        <div className="ed-linkrow">
                                            <span className="ed-url">{menuUrl.replace(/^https?:\/\//, '')}</span>
                                            <button type="button" className="ed-ico" onClick={copyLink} aria-label={t('catalog.copy')}>
                                                {copied
                                                    ? <Ic n="check" s={14} w={2.4} style={{ color: '#16A34A' }} />
                                                    : <Ic n="copy" s={14} />}
                                            </button>
                                            <a className="ed-ico" href={menuUrl} target="_blank" rel="noopener noreferrer" aria-label={t('catalog.open')}>
                                                <Ic n="out" s={14} />
                                            </a>
                                        </div>
                                        {copied && <span className="ed-copied">{t('catalog.link_copied')}</span>}
                                    </>
                                ) : (
                                    <p className="ed-note">
                                        <Ic n="warn" s={12} w={2} style={{ flex: 'none', marginTop: 2 }} />
                                        {t('catalog.not_attached_hint')}
                                    </p>
                                )}

                                <div className="ed-2col">
                                    <span>
                                        <label className="ed-lab" htmlFor="cat-btn">
                                            {t('catalog.button_label')}<i>{(form?.button_label || '').length}/30</i>
                                        </label>
                                        <input
                                            id="cat-btn" className="ed-in" value={form?.button_label ?? ''}
                                            placeholder={t('catalog.button_label_ph')} maxLength={30}
                                            onChange={(e) => setField('button_label', e.target.value)}
                                        />
                                    </span>
                                    <span>
                                        <label className="ed-lab" htmlFor="cat-cur">{t('catalog.currency')}</label>
                                        <input
                                            id="cat-cur" className="ed-in" value={form?.currency ?? ''} maxLength={12}
                                            onChange={(e) => setField('currency', e.target.value)}
                                        />
                                    </span>
                                </div>

                                <label className="ed-lab">{t('catalog.banner')}</label>
                                <input
                                    ref={bannerInput} type="file" accept="image/*" hidden
                                    onChange={(e) => { const f = e.target.files[0]; if (f) uploadBanner(f); e.target.value = ''; }}
                                />
                                {catalog.banner ? (
                                    <div className="ed-banrow">
                                        <img className="ed-banprev" src={catalog.banner} alt="" />
                                        <span className="ed-banmeta">
                                            <b>{t('catalog.banner')}</b>
                                            <i>{t('catalog.banner_change')}</i>
                                        </span>
                                        <button type="button" className="ed-ico" onClick={() => bannerInput.current?.click()} aria-label={t('catalog.banner_change')}>
                                            <Ic n="pen" s={14} />
                                        </button>
                                        <button type="button" className="ed-ico danger" onClick={() => saveField({ banner_remove: true })} aria-label={t('catalog.banner_remove')}>
                                            <Ic n="trash" s={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button type="button" className="ed-banadd" onClick={() => bannerInput.current?.click()} disabled={bannerBusy}>
                                        {bannerBusy ? <span className="spinner spinner-sm" /> : <Ic n="img" s={16} w={1.7} />}
                                        {t('catalog.banner_set')}
                                    </button>
                                )}

                                <div className="ed-tglrow">
                                    <span>{t('catalog.active')}</span>
                                    <button
                                        type="button" className={`mc-tgl${catalog.is_active ? ' on' : ''}`}
                                        onClick={() => saveField({ is_active: !catalog.is_active }, true)}
                                        aria-label={t('catalog.active')}
                                    >
                                        <span />
                                    </button>
                                </div>

                                <button type="button" className="mc-btn ghost w100" onClick={downloadQr} disabled={!attached}>
                                    <Ic n="qr" s={15} />{t('catalog.qr_download')}
                                </button>
                                {attached && (
                                    <p className="ed-note">
                                        <Ic n="warn" s={12} w={2} style={{ flex: 'none', marginTop: 2 }} />
                                        {t('catalog.qr_hint')}
                                    </p>
                                )}
                            </div>

                            <div className="mc-card">
                                <h3 className="mc-ch">
                                    {t('catalog.ordering')}
                                    <span className="mc-chsub">{t('catalog.ordering_sub')}</span>
                                </h3>

                                <div className="ed-tglrow" style={{ borderTop: 0, marginTop: 4, paddingTop: 4 }}>
                                    <span>{t('catalog.cart_enabled')}</span>
                                    <button
                                        type="button" className={`mc-tgl${catalog.cart_enabled ? ' on' : ''}`}
                                        onClick={() => saveField({ cart_enabled: !catalog.cart_enabled }, true)}
                                        aria-label={t('catalog.cart_enabled')}
                                    >
                                        <span />
                                    </button>
                                </div>
                                <p className="ed-note soft" style={{ marginTop: 0 }}>{t('catalog.cart_hint')}</p>

                                <div className="ed-tglrow">
                                    <span>{t('catalog.order_enabled')}</span>
                                    <button
                                        type="button" className={`mc-tgl${catalog.order_enabled ? ' on' : ''}`}
                                        onClick={() => saveField({ order_enabled: !catalog.order_enabled }, true)}
                                        aria-label={t('catalog.order_enabled')}
                                    >
                                        <span />
                                    </button>
                                </div>

                                {catalog.order_enabled && (
                                    <>
                                        <label className="ed-lab" htmlFor="cat-olink">{t('catalog.order_link')}</label>
                                        <input
                                            id="cat-olink" className="ed-in" value={form?.order_link ?? ''}
                                            placeholder={t('catalog.order_link_ph')} maxLength={200}
                                            onChange={(e) => setField('order_link', e.target.value)}
                                        />
                                        <p className="ed-note soft">{t('catalog.order_link_hint')}</p>

                                        <label className="ed-lab" htmlFor="cat-olabel">{t('catalog.order_label')}</label>
                                        <input
                                            id="cat-olabel" className="ed-in" value={form?.order_label ?? ''}
                                            placeholder={t('menu.order_cta')} maxLength={40}
                                            onChange={(e) => setField('order_label', e.target.value)}
                                        />
                                    </>
                                )}
                            </div>

                            <div className="mc-card">
                                <h3 className="mc-ch">
                                    {t('catalog.appearance')}
                                    <span className="mc-chsub">{t('catalog.appearance_sub')}</span>
                                </h3>

                                <label className="ed-lab">{t('catalog.theme')}</label>
                                <div className="ed-themes">
                                    {CATALOG_THEMES.map((x) => (
                                        <button
                                            key={x.id} type="button"
                                            className={`ed-theme${catalog.theme === x.id ? ' on' : ''}`}
                                            onClick={() => saveField({ theme: x.id }, true)}
                                        >
                                            <span style={{ background: `linear-gradient(135deg, ${x.sw[0]}, ${x.sw[1]})` }} />
                                            <i>{t(`catalog.theme_${x.id}`, x.nom)}</i>
                                        </button>
                                    ))}
                                </div>

                                <div className="ed-2col">
                                    <span>
                                        <label className="ed-lab">{t('catalog.mode')}</label>
                                        <div className="ed-seg">
                                            {['dark', 'light'].map((m) => (
                                                <button
                                                    key={m} type="button" className={catalog.theme_mode === m ? 'on' : ''}
                                                    onClick={() => saveField({ theme_mode: m }, true)}
                                                >
                                                    {t(`catalog.mode_${m}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </span>
                                    <span>
                                        <label className="ed-lab">{t('catalog.card_style')}</label>
                                        <div className="ed-seg">
                                            {['list', 'grid'].map((m) => (
                                                <button
                                                    key={m} type="button" className={catalog.card_style === m ? 'on' : ''}
                                                    onClick={() => saveField({ card_style: m }, true)}
                                                >
                                                    {t(`catalog.card_${m}`)}
                                                </button>
                                            ))}
                                        </div>
                                    </span>
                                </div>
                                <p className="ed-note soft">{t('catalog.preview_note')}</p>
                            </div>
                        </div>

                        {/* ---- column 2: categories ---- */}
                        <div className="ed-col2 mc-card">
                            <h3 className="mc-ch">
                                {t('catalog.categories')}
                                <span className="mc-chsub">{categories.length} / {MAX_CATEGORIES}</span>
                                <button
                                    type="button" className="mc-btn sm ghost" style={{ marginLeft: 'auto' }}
                                    onClick={addCategory} disabled={categories.length >= MAX_CATEGORIES}
                                >
                                    <Ic n="plus" s={13} w={2.2} />{t('catalog.add_category')}
                                </button>
                            </h3>

                            {categories.length === 0 ? (
                                <p className="ed-empty">{t('catalog.empty_categories')}</p>
                            ) : (
                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCatDragEnd}>
                                    <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                                        {categories.map((c) => (
                                            <CatRow
                                                key={c.id} cat={c} open={open === c.id} t={t}
                                                onToggle={(cid) => setOpen((v) => (v === cid ? null : cid))}
                                                onRename={renameCategory}
                                                onDelete={deleteCategory}
                                            >
                                                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd(c)}>
                                                    <SortableContext items={(c.items || []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                                        {(c.items || []).map((item) => (
                                                            <ItemRow
                                                                key={item.id} item={item} t={t}
                                                                onEdit={(it) => setModal({ categoryId: c.id, item: it })}
                                                                onDelete={deleteItem(c)}
                                                            />
                                                        ))}
                                                    </SortableContext>
                                                </DndContext>
                                                {(c.items || []).length === 0 && <p className="ed-empty">{t('catalog.empty_items')}</p>}
                                                <button type="button" className="ed-addit" onClick={() => setModal({ categoryId: c.id, item: null })}>
                                                    <Ic n="plus" s={14} w={2.2} />{t('catalog.add_item')}
                                                </button>
                                            </CatRow>
                                        ))}
                                    </SortableContext>
                                </DndContext>
                            )}
                        </div>

                        {/* ---- column 3: live preview ---- */}
                        <div className="ed-col3">
                            <span className="ed-prevlab">{t('catalog.live_preview')}</span>
                            <div className="ed-phone">
                                {/* Remount on palette change: Chromium keeps transitioned
                                    properties on their old value when the var() behind
                                    them changes, so switching themes in place left the
                                    preview on the previous colours. */}
                                <CatalogMenu
                                    key={`${catalog.theme}-${catalog.theme_mode}`}
                                    data={previewData} embedded
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {modal && (
                <ItemModal
                    catalogId={catalog.id}
                    categoryId={modal.categoryId}
                    item={modal.item}
                    currency={catalog.currency}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); refetch(); }}
                    showErr={showErr}
                />
            )}
        </div>
    );
};

export default CatalogEditor;
