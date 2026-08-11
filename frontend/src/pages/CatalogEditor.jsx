import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { useToast } from '../components/Toast';
import ItemModal from '../components/catalog/ItemModal';
import '../components/catalog/catalog.css';
import {
    FaArrowLeft, FaChevronDown, FaChevronUp, FaCopy, FaExternalLinkAlt,
    FaGripLines, FaImage, FaLock, FaPen, FaPlus, FaQrcode, FaTrash,
} from 'react-icons/fa';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatPrice } from '../lib/format';

const MAX_CATEGORIES = 20;

const PUBLIC_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? window.location.origin
    : 'https://mylink.asia';

// One item row inside an expanded category (sortable, compact).
const ItemRow = ({ item, currency, onEdit, onDelete, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const thumb = item.images?.[0]?.thumb || item.images?.[0]?.image;
    return (
        <div ref={setNodeRef} style={style} className="cat-item-row">
            <div className="block-drag" {...attributes} {...listeners}><FaGripLines /></div>
            <div className="cat-item-thumb">{thumb ? <img src={thumb} alt="" /> : <FaImage />}</div>
            <div className="cat-item-info">
                <span className="cat-item-name">
                    {!item.is_available && <span className="cat-dot" title={t('catalog.unavailable')} />}
                    {item.name}
                </span>
                <span className="cat-item-price">
                    {item.old_price ? <s>{formatPrice(item.old_price)}</s> : null}
                    {formatPrice(item.price)} {currency}
                </span>
            </div>
            <button type="button" className="cat-icon-btn" onClick={() => onEdit(item)}><FaPen /></button>
            <button type="button" className="block-del" onClick={() => onDelete(item)}><FaTrash /></button>
        </div>
    );
};

// One category card (SortableSection fork: drag + inline rename + expand).
const SortableCategory = ({ category, expanded, onToggle, onRename, onDelete, children, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: category.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const [name, setName] = useState(category.name);
    const [prevName, setPrevName] = useState(category.name);
    if (prevName !== category.name) {
        setPrevName(category.name);
        setName(category.name);
    }
    return (
        <div ref={setNodeRef} style={style} className="cat-cat-item">
            <div className="cat-cat-head">
                <div className="block-drag" {...attributes} {...listeners}><FaGripLines /></div>
                <input
                    className="cat-cat-name"
                    value={name}
                    placeholder={t('catalog.category_ph')}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => { if (name.trim() && name !== category.name) onRename(category.id, name.trim()); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                />
                <span className="section-count">{(category.items || []).length}</span>
                <button type="button" className="block-del" onClick={() => onDelete(category)}><FaTrash /></button>
                <button type="button" className="section-toggle" onClick={() => onToggle(category.id)}>
                    {expanded ? <FaChevronUp /> : <FaChevronDown />}
                </button>
            </div>
            {expanded && <div className="cat-cat-body">{children}</div>}
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
    const [expanded, setExpanded] = useState(null);
    const [modal, setModal] = useState(null); // { categoryId, item|null }
    const [bannerBusy, setBannerBusy] = useState(false);
    const bannerInput = useRef(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const canCatalog = !!entitlements?.features?.catalog;

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) { navigate('/login'); return; }
        let active = true;
        Promise.all([
            api.get(`catalogs/${id}/`),
            api.get('businesses/'),
        ])
            .then(([catRes, bizRes]) => {
                if (!active) return;
                setCatalog(catRes.data);
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

    // PATCH one/two fields, merge the fresh full payload back.
    const saveField = async (patch) => {
        try {
            const res = await api.patch(`catalogs/${id}/`, patch);
            setCatalog(res.data);
        } catch (err) { showErr(err); }
    };

    const uploadBanner = async (file) => {
        setBannerBusy(true);
        try {
            const fd = new FormData();
            fd.append('banner_upload', file);
            const res = await api.patch(`catalogs/${id}/`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
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
        } catch { toast.error(t('common.error')); }
    };

    const copyLink = () => {
        navigator.clipboard?.writeText(menuUrl);
        toast.success(t('catalog.link_copied'));
    };

    // ---- categories ----
    const patchCategories = (fn) => setCatalog((c) => ({ ...c, categories: fn(c.categories || []) }));

    const addCategory = async () => {
        try {
            const res = await api.post(`catalogs/${id}/categories/`, { name: t('catalog.new_category') });
            patchCategories((cs) => [...cs, { ...res.data, items: res.data.items || [] }]);
            setExpanded(res.data.id);
        } catch (err) { showErr(err); }
    };

    const renameCategory = async (cid, name) => {
        try {
            const res = await api.patch(`catalog/categories/${cid}/`, { name });
            patchCategories((cs) => cs.map((c) => (c.id === cid ? { ...c, name: res.data.name } : c)));
        } catch (err) { showErr(err); }
    };

    const deleteCategory = async (category) => {
        if (!window.confirm(t('catalog.confirm_delete_category'))) return;
        try {
            await api.delete(`catalog/categories/${category.id}/`);
            patchCategories((cs) => cs.filter((c) => c.id !== category.id));
        } catch (err) { showErr(err); }
    };

    const onCategoryDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const cs = catalog.categories || [];
        const next = arrayMove(cs, cs.findIndex((c) => c.id === active.id), cs.findIndex((c) => c.id === over.id));
        patchCategories(() => next);
        try {
            await api.post(`catalogs/${id}/categories/reorder/`, { order: next.map((c) => c.id) });
        } catch (err) { showErr(err); }
    };

    // ---- items ----
    const removeItem = (category) => async (item) => {
        if (!window.confirm(t('catalog.confirm_delete_item'))) return;
        try {
            await api.delete(`catalog/items/${item.id}/`);
            patchCategories((cs) => cs.map((c) => (
                c.id === category.id ? { ...c, items: (c.items || []).filter((i) => i.id !== item.id) } : c
            )));
        } catch (err) { showErr(err); }
    };

    const onItemDragEnd = (category) => async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const items = category.items || [];
        const next = arrayMove(items, items.findIndex((i) => i.id === active.id), items.findIndex((i) => i.id === over.id));
        patchCategories((cs) => cs.map((c) => (c.id === category.id ? { ...c, items: next } : c)));
        try {
            await api.post(`catalogs/${id}/items/reorder/`, { order: next.map((i) => i.id) });
        } catch (err) { showErr(err); }
    };

    if (loading) {
        return <div className="dashboard-loading"><div className="spinner" /><p>{t('common.loading')}</p></div>;
    }
    if (!catalog) return null;

    if (!canCatalog) {
        return (
            <div className="dashboard">
                <main className="dashboard-main">
                    <div className="dashboard-container">
                        <div className="blocks-upsell">
                            <FaLock className="blocks-upsell-icon" />
                            <p>{t('catalog.upsell')}</p>
                            <Link to="/pricing" className="qr-dl">{t('limit.see_plans')}</Link>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    const attached = !!catalog.business;
    const menuUrl = attached ? `${PUBLIC_BASE}/${catalog.business_path}/menu` : null;
    const categories = catalog.categories || [];

    return (
        <div className="dashboard">
            <main className="dashboard-main">
                <div className="dashboard-container cat-page">
                    <div className="cat-head">
                        <Link to="/catalogs" className="cat-back"><FaArrowLeft /> {t('catalog.back')}</Link>
                        <button type="button" className="cat-btn-danger" onClick={deleteCatalog}>
                            <FaTrash /> {t('catalog.delete')}
                        </button>
                    </div>

                    <input
                        className="cat-name-input"
                        defaultValue={catalog.name}
                        placeholder={t('catalog.name_ph')}
                        onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== catalog.name) saveField({ name: v });
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                    />

                    {/* ---- Settings ---- */}
                    <div className="edit-card cat-settings">
                        <h3>{t('catalog.settings')}</h3>

                        <div className="cat-field">
                            <label>{t('catalog.attach_business')}</label>
                            <select
                                className="cat-input"
                                value={catalog.business || ''}
                                onChange={(e) => saveField({ business: e.target.value ? Number(e.target.value) : null })}
                            >
                                <option value="">{t('catalog.not_attached_option')}</option>
                                {businesses.map((b) => (
                                    <option key={b.id} value={b.id}>{b.name} — mylink.asia/{b.path}</option>
                                ))}
                            </select>
                            {!attached && <p className="cat-warn">{t('catalog.not_attached_hint')}</p>}
                        </div>

                        {attached && (
                            <div className="cat-field">
                                <label>{t('catalog.menu_link')}</label>
                                <div className="cat-link-row">
                                    <span className="cat-link">{menuUrl.replace(/^https?:\/\//, '')}</span>
                                    <button type="button" className="cat-icon-btn" title={t('catalog.copy')} onClick={copyLink}><FaCopy /></button>
                                    <a className="cat-icon-btn" href={menuUrl} target="_blank" rel="noopener noreferrer" title={t('catalog.open')}><FaExternalLinkAlt /></a>
                                </div>
                            </div>
                        )}

                        <div className="cat-form-row">
                            <div className="cat-field">
                                <label>{t('catalog.button_label')}</label>
                                <input
                                    className="cat-input"
                                    defaultValue={catalog.button_label}
                                    placeholder={t('catalog.button_label_ph')}
                                    maxLength={30}
                                    onBlur={(e) => {
                                        if (e.target.value !== catalog.button_label) saveField({ button_label: e.target.value });
                                    }}
                                />
                            </div>
                            <div className="cat-field">
                                <label>{t('catalog.currency')}</label>
                                <input
                                    className="cat-input"
                                    defaultValue={catalog.currency}
                                    maxLength={12}
                                    onBlur={(e) => {
                                        const v = e.target.value.trim();
                                        if (v && v !== catalog.currency) saveField({ currency: v });
                                    }}
                                />
                            </div>
                        </div>

                        <div className="cat-field">
                            <label>{t('catalog.banner')}</label>
                            <input
                                ref={bannerInput} type="file" accept="image/*" hidden
                                onChange={(e) => { const f = e.target.files[0]; if (f) uploadBanner(f); e.target.value = ''; }}
                            />
                            <div className="cat-banner" onClick={() => bannerInput.current?.click()}>
                                {bannerBusy ? <span className="spinner spinner-sm" />
                                    : catalog.banner ? <img src={catalog.banner} alt="" />
                                        : <span className="cat-banner-empty"><FaImage /> {t('catalog.banner_set')}</span>}
                            </div>
                            {catalog.banner && (
                                <button type="button" className="cat-btn-ghost cat-banner-remove"
                                    onClick={() => saveField({ banner_remove: true })}>
                                    <FaTrash /> {t('catalog.banner_remove')}
                                </button>
                            )}
                        </div>

                        <div className="cat-form-row cat-settings-foot">
                            <label className="cat-check">
                                <input
                                    type="checkbox"
                                    checked={catalog.is_active}
                                    onChange={(e) => saveField({ is_active: e.target.checked })}
                                />
                                <span>{t('catalog.active')}</span>
                            </label>
                            <button type="button" className="qr-dl" disabled={!attached} onClick={downloadQr}
                                title={attached ? undefined : t('catalog.not_attached_hint')}>
                                <FaQrcode /> {t('catalog.qr_download')}
                            </button>
                        </div>
                        {attached && <p className="cat-hint">{t('catalog.qr_hint')}</p>}
                        {!catalog.is_active && <p className="cat-warn">{t('catalog.inactive_hint')}</p>}
                    </div>

                    {/* ---- Categories ---- */}
                    <div className="edit-card cat-cats">
                        <div className="blocks-head">
                            <h3>{t('catalog.categories')} <span className="blocks-count">{categories.length}/{MAX_CATEGORIES}</span></h3>
                            <button type="button" className="add-btn" disabled={categories.length >= MAX_CATEGORIES} onClick={addCategory}>
                                <FaPlus /> {t('catalog.add_category')}
                            </button>
                        </div>

                        {categories.length === 0 ? (
                            <p className="blocks-empty">{t('catalog.empty_categories')}</p>
                        ) : (
                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onCategoryDragEnd}>
                                <SortableContext items={categories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                                    {categories.map((c) => (
                                        <SortableCategory
                                            key={c.id}
                                            category={c}
                                            expanded={expanded === c.id}
                                            onToggle={(cid) => setExpanded((cur) => (cur === cid ? null : cid))}
                                            onRename={renameCategory}
                                            onDelete={deleteCategory}
                                            t={t}
                                        >
                                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onItemDragEnd(c)}>
                                                <SortableContext items={(c.items || []).map((i) => i.id)} strategy={verticalListSortingStrategy}>
                                                    {(c.items || []).map((item) => (
                                                        <ItemRow
                                                            key={item.id}
                                                            item={item}
                                                            currency={catalog.currency}
                                                            onEdit={(it) => setModal({ categoryId: c.id, item: it })}
                                                            onDelete={removeItem(c)}
                                                            t={t}
                                                        />
                                                    ))}
                                                </SortableContext>
                                            </DndContext>
                                            {(c.items || []).length === 0 && (
                                                <p className="blocks-empty">{t('catalog.empty_items')}</p>
                                            )}
                                            <button type="button" className="cat-add-item" onClick={() => setModal({ categoryId: c.id, item: null })}>
                                                <FaPlus /> {t('catalog.add_item')}
                                            </button>
                                        </SortableCategory>
                                    ))}
                                </SortableContext>
                            </DndContext>
                        )}
                    </div>
                </div>
            </main>

            {modal && (
                <ItemModal
                    catalogId={catalog.id}
                    categoryId={modal.categoryId}
                    item={modal.item}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); refetch(); }}
                    showErr={showErr}
                />
            )}
        </div>
    );
};

export default CatalogEditor;
