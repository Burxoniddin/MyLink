import React, { useEffect, useRef, useState } from 'react';
import api from '../../api';
import { useTranslation } from 'react-i18next';
import { Ic } from './icons';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MAX_IMAGES_PER_ITEM = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

/** One draggable photo in the modal's strip; the first one is the card cover. */
const ImgCell = ({ img, main, onDelete, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? .6 : 1 };
    return (
        <span ref={setNodeRef} style={style} className="md-img" {...attributes} {...listeners}>
            <img src={img.thumb || img.image} alt="" />
            {main && <i className="md-main">{t('catalog.main_image')}</i>}
            <button
                type="button" className="md-imgx" aria-label={t('common.delete')}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(img); }}
            >
                <Ic n="x" s={10} w={2.6} />
            </button>
        </span>
    );
};

/**
 * Create/edit one catalog item. In create mode the picked photos are queued
 * locally and uploaded once the item exists; in edit mode every photo action
 * (add/delete/reorder) hits the API straight away.
 */
const ItemModal = ({ catalogId, categoryId, item, currency, onClose, onSaved, showErr }) => {
    const { t } = useTranslation();
    const isEdit = !!item;
    const [form, setForm] = useState({
        name: item?.name || '',
        price: item?.price ?? '',
        old_price: item?.old_price ?? '',
        description: item?.description || '',
        is_available: item?.is_available ?? true,
    });
    const [images, setImages] = useState(item?.images || []);
    const [pending, setPending] = useState([]);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInput = useRef(null);
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // Revoke object URLs for photos queued but never uploaded.
    const pendingRef = useRef(pending);
    pendingRef.current = pending;
    useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)), []);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const count = isEdit ? images.length : pending.length;
    const canSave = form.name.trim() && form.price !== '' && Number(form.price) >= 0;

    const pickFiles = (files) => {
        const room = MAX_IMAGES_PER_ITEM - count;
        let picked = Array.from(files).slice(0, Math.max(0, room));
        if (picked.some((f) => f.size > MAX_IMAGE_BYTES)) {
            showErr({ response: { data: { reason: 'image_too_large' } } });
            picked = picked.filter((f) => f.size <= MAX_IMAGE_BYTES);
        }
        if (!picked.length) return;
        if (!isEdit) {
            setPending((ps) => [...ps, ...picked.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
            return;
        }
        uploadFiles(picked);
    };

    const uploadFiles = async (files) => {
        setUploading(true);
        try {
            for (const file of files) {
                const fd = new FormData();
                fd.append('image_upload', file);
                const res = await api.post(`catalog/items/${item.id}/images/`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                setImages((imgs) => [...imgs, res.data]);
            }
        } catch (err) { showErr(err); } finally { setUploading(false); }
    };

    const deleteImage = async (img) => {
        if (!window.confirm(t('catalog.confirm_delete_image'))) return;
        try {
            await api.delete(`catalog/images/${img.id}/`);
            setImages((imgs) => imgs.filter((i) => i.id !== img.id));
        } catch (err) { showErr(err); }
    };

    const onImgDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const next = arrayMove(images,
            images.findIndex((i) => i.id === active.id),
            images.findIndex((i) => i.id === over.id));
        setImages(next);
        try {
            await api.post(`catalog/items/${item.id}/images/reorder/`, { order: next.map((i) => i.id) });
        } catch (err) { showErr(err); }
    };

    const save = async () => {
        if (!canSave || busy) return;
        setBusy(true);
        const payload = {
            name: form.name.trim(),
            price: Number(form.price),
            old_price: form.old_price === '' ? null : Number(form.old_price),
            description: form.description,
            is_available: form.is_available,
        };
        try {
            if (isEdit) {
                await api.patch(`catalog/items/${item.id}/`, payload);
            } else {
                const res = await api.post(`catalogs/${catalogId}/items/`, { ...payload, category: categoryId });
                for (const p of pending) {
                    const fd = new FormData();
                    fd.append('image_upload', p.file);
                    await api.post(`catalog/items/${res.data.id}/images/`, fd, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                    });
                }
            }
            onSaved();
        } catch (err) { showErr(err); setBusy(false); }
    };

    const strip = isEdit ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onImgDragEnd}>
            <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
                {images.map((img, k) => (
                    <ImgCell key={img.id} img={img} main={k === 0} onDelete={deleteImage} t={t} />
                ))}
            </SortableContext>
        </DndContext>
    ) : (
        pending.map((p, k) => (
            <span key={p.url} className="md-img">
                <img src={p.url} alt="" />
                {k === 0 && <i className="md-main">{t('catalog.main_image')}</i>}
                <button
                    type="button" className="md-imgx" aria-label={t('common.delete')}
                    onClick={() => {
                        URL.revokeObjectURL(p.url);
                        setPending((ps) => ps.filter((_, idx) => idx !== k));
                    }}
                >
                    <Ic n="x" s={10} w={2.6} />
                </button>
            </span>
        ))
    );

    return (
        <div className="md-ovl cat-scope" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="md-card">
                <div className="md-head">
                    <b>{isEdit ? t('catalog.edit_item') : t('catalog.add_item')}</b>
                    <button type="button" className="ed-ico" onClick={onClose} aria-label={t('common.close')}>
                        <Ic n="x" s={16} />
                    </button>
                </div>

                <label className="ed-lab">
                    {t('catalog.images_lab')}<i>{count}/{MAX_IMAGES_PER_ITEM}</i>
                </label>
                <input
                    ref={fileInput} type="file" accept="image/*" multiple hidden
                    onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }}
                />
                <div className="md-imgs">
                    {strip}
                    {count < MAX_IMAGES_PER_ITEM && (
                        <button
                            type="button" className="md-addimg" disabled={uploading}
                            onClick={() => fileInput.current?.click()}
                        >
                            {uploading ? <span className="spinner spinner-sm" /> : <Ic n="plus" s={16} w={2} />}
                            <i>{t('catalog.photo')}</i>
                        </button>
                    )}
                </div>
                <p className="ed-note soft">{t('catalog.image_hint')}</p>

                <label className="ed-lab" htmlFor="md-nom">
                    {t('catalog.item_name')}<i>{form.name.length}/100</i>
                </label>
                <input
                    id="md-nom" className="ed-in" autoFocus maxLength={100}
                    placeholder={t('catalog.item_name_ph')}
                    value={form.name} onChange={(e) => set({ name: e.target.value })}
                />

                <div className="ed-2col">
                    <span>
                        <label className="ed-lab" htmlFor="md-narx">{t('catalog.price')}</label>
                        <span className="ed-inwrap">
                            <input
                                id="md-narx" className="ed-in" type="number" min="0" placeholder="0"
                                value={form.price} onChange={(e) => set({ price: e.target.value })}
                            />
                            <i>{currency}</i>
                        </span>
                    </span>
                    <span>
                        <label className="ed-lab" htmlFor="md-eski">
                            {t('catalog.old_price')}<i>{t('catalog.optional')}</i>
                        </label>
                        <span className="ed-inwrap">
                            <input
                                id="md-eski" className="ed-in" type="number" min="0" placeholder="—"
                                value={form.old_price} onChange={(e) => set({ old_price: e.target.value })}
                            />
                            <i>{currency}</i>
                        </span>
                    </span>
                </div>

                <label className="ed-lab" htmlFor="md-tasnif">{t('catalog.description')}</label>
                <textarea
                    id="md-tasnif" className="ed-in" rows={3} placeholder={t('catalog.desc_ph')}
                    value={form.description} onChange={(e) => set({ description: e.target.value })}
                />

                <label className="md-chk">
                    <input
                        type="checkbox" checked={form.is_available}
                        onChange={(e) => set({ is_available: e.target.checked })}
                    />
                    <span className="md-chkbox"><Ic n="check" s={11} w={3} /></span>
                    {t('catalog.available')}
                </label>

                <div className="md-foot">
                    <button type="button" className="mc-btn ghost" onClick={onClose}>{t('common.cancel')}</button>
                    <button type="button" className="mc-btn grad" disabled={!canSave || busy} onClick={save}>
                        {busy ? t('detail.saving') : t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ItemModal;
