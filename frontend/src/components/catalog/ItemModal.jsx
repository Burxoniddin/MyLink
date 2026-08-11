import React, { useEffect, useRef, useState } from 'react';
import api from '../../api';
import { useTranslation } from 'react-i18next';
import { FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MAX_IMAGES_PER_ITEM = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// One draggable thumbnail in the modal's image strip (media-cell fork).
const ImageCell = ({ img, onDelete }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: img.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
    return (
        <div ref={setNodeRef} style={style} className="cat-img-cell" {...attributes} {...listeners}>
            <img src={img.thumb || img.image} alt="" />
            <button
                type="button" className="cat-img-del" aria-label="delete"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onDelete(img); }}
            >
                <FaTrash />
            </button>
        </div>
    );
};

/**
 * Create/edit one catalog item. Create mode queues picked images locally and
 * uploads them after the item exists; edit mode uploads/deletes/reorders
 * immediately (media-grid style). `onSaved` refetches the catalog.
 */
const ItemModal = ({ catalogId, categoryId, item, onClose, onSaved, showErr }) => {
    const { t } = useTranslation();
    const isEdit = !!item;
    const [form, setForm] = useState({
        name: item?.name || '',
        price: item?.price ?? '',
        old_price: item?.old_price ?? '',
        description: item?.description || '',
        is_available: item?.is_available ?? true,
    });
    const [images, setImages] = useState(item?.images || []); // edit mode (server rows)
    const [pending, setPending] = useState([]);               // create mode (local files)
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const fileInput = useRef(null);
    const sensors = useSensors(useSensor(PointerSensor));

    // Revoke local previews on unmount.
    useEffect(() => () => pending.forEach((p) => URL.revokeObjectURL(p.url)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []);

    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const count = isEdit ? images.length : pending.length;
    const canSave = form.name.trim() && form.price !== '' && Number(form.price) >= 0;

    const pickFiles = (files) => {
        const room = MAX_IMAGES_PER_ITEM - count;
        let picked = Array.from(files).slice(0, Math.max(0, room));
        const oversize = picked.some((f) => f.size > MAX_IMAGE_BYTES);
        if (oversize) picked = picked.filter((f) => f.size <= MAX_IMAGE_BYTES);
        if (oversize) showErr({ response: { data: { reason: 'image_too_large' } } });
        if (picked.length === 0) return;
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

    const onImageDragEnd = async ({ active, over }) => {
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
                const res = await api.post(`catalogs/${catalogId}/items/`,
                    { ...payload, category: categoryId });
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

    return (
        <div className="cat-modal" onClick={onClose}>
            <div className="cat-modal-box" onClick={(e) => e.stopPropagation()}>
                <div className="cat-modal-head">
                    <h3>{isEdit ? t('catalog.edit_item') : t('catalog.add_item')}</h3>
                    <button type="button" className="cat-modal-close" onClick={onClose}><FaTimes /></button>
                </div>

                {/* Image strip */}
                <div className="cat-img-strip">
                    <input
                        ref={fileInput} type="file" accept="image/*" multiple hidden
                        onChange={(e) => { pickFiles(e.target.files); e.target.value = ''; }}
                    />
                    <button
                        type="button" className="cat-img-add"
                        disabled={count >= MAX_IMAGES_PER_ITEM || uploading}
                        onClick={() => fileInput.current?.click()}
                        title={t('catalog.images', { n: count })}
                    >
                        {uploading ? <span className="spinner spinner-sm" /> : <FaPlus />}
                    </button>
                    {isEdit ? (
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onImageDragEnd}>
                            <SortableContext items={images.map((i) => i.id)} strategy={rectSortingStrategy}>
                                {images.map((img) => (
                                    <ImageCell key={img.id} img={img} onDelete={deleteImage} />
                                ))}
                            </SortableContext>
                        </DndContext>
                    ) : (
                        pending.map((p, idx) => (
                            <div key={p.url} className="cat-img-cell">
                                <img src={p.url} alt="" />
                                <button
                                    type="button" className="cat-img-del" aria-label="delete"
                                    onClick={() => {
                                        URL.revokeObjectURL(p.url);
                                        setPending((ps) => ps.filter((_, i) => i !== idx));
                                    }}
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        ))
                    )}
                </div>
                <p className="cat-img-hint">{t('catalog.images', { n: count })}</p>

                <div className="cat-form">
                    <input
                        className="cat-input" autoFocus
                        placeholder={t('catalog.item_name_ph')}
                        value={form.name}
                        onChange={(e) => set({ name: e.target.value })}
                    />
                    <div className="cat-form-row">
                        <input
                            className="cat-input" type="number" min="0"
                            placeholder={t('catalog.price_ph')}
                            value={form.price}
                            onChange={(e) => set({ price: e.target.value })}
                        />
                        <input
                            className="cat-input" type="number" min="0"
                            placeholder={t('catalog.old_price_ph')}
                            value={form.old_price}
                            onChange={(e) => set({ old_price: e.target.value })}
                        />
                    </div>
                    <textarea
                        className="cat-input cat-textarea"
                        placeholder={t('catalog.desc_ph')}
                        value={form.description}
                        onChange={(e) => set({ description: e.target.value })}
                    />
                    <label className="cat-check">
                        <input
                            type="checkbox"
                            checked={form.is_available}
                            onChange={(e) => set({ is_available: e.target.checked })}
                        />
                        <span>{t('catalog.available')}</span>
                    </label>
                </div>

                <div className="cat-modal-actions">
                    <button type="button" className="cat-btn-ghost" onClick={onClose}>{t('common.cancel')}</button>
                    <button type="button" className="cat-btn-primary" disabled={!canSave || busy} onClick={save}>
                        {busy ? t('detail.saving') : t('common.save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ItemModal;
