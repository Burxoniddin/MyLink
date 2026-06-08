import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import { FaPlus, FaTrash, FaGripLines, FaImage, FaVideo, FaAlignLeft, FaLock, FaSave } from 'react-icons/fa';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

const TYPE_ICON = { image: <FaImage />, video: <FaVideo />, text: <FaAlignLeft /> };

const SortableBlock = ({ block, onField, onSave, onDelete, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
    const style = { transform: CSS.Transform.toString(transform), transition };

    return (
        <div ref={setNodeRef} style={style} className="block-item">
            <div className="block-head">
                <div className="block-drag" {...attributes} {...listeners}><FaGripLines /></div>
                <span className="block-type">{TYPE_ICON[block.block_type]} {t(`blocks.${block.block_type}`)}</span>
                <button type="button" className="block-del" onClick={() => onDelete(block.id)}><FaTrash /></button>
            </div>

            <input
                className="block-input"
                placeholder={t('blocks.title_ph')}
                value={block.title || ''}
                onChange={(e) => onField(block.id, { title: e.target.value })}
            />

            {block.block_type === 'text' && (
                <textarea
                    className="block-input block-textarea"
                    placeholder={t('blocks.text_ph')}
                    value={block.text || ''}
                    onChange={(e) => onField(block.id, { text: e.target.value })}
                />
            )}

            {block.block_type === 'image' && (
                <div className="block-media">
                    {(block._imagePreview || block.image) && (
                        <img src={block._imagePreview || block.image} alt="" className="block-thumb" />
                    )}
                    <label className="block-file">
                        <FaImage /> {t('blocks.upload_image')}
                        <input type="file" accept="image/*" hidden onChange={(e) => {
                            const f = e.target.files[0];
                            if (f) onField(block.id, { _imageFile: f, _imagePreview: URL.createObjectURL(f) });
                        }} />
                    </label>
                </div>
            )}

            {block.block_type === 'video' && (
                <div className="block-media">
                    <input
                        className="block-input"
                        placeholder={t('blocks.embed_ph')}
                        value={block.embed_url || ''}
                        onChange={(e) => onField(block.id, { embed_url: e.target.value })}
                    />
                    <div className="block-or">{t('blocks.or')}</div>
                    <label className="block-file">
                        <FaVideo /> {block._videoFile ? block._videoFile.name : t('blocks.upload_video')}
                        <input type="file" accept="video/*" hidden onChange={(e) => {
                            const f = e.target.files[0];
                            if (f) onField(block.id, { _videoFile: f });
                        }} />
                    </label>
                </div>
            )}

            <button type="button" className="block-save" onClick={() => onSave(block)}>
                <FaSave /> {t('common.save')}
            </button>
        </div>
    );
};

const ContentBlocks = ({ path }) => {
    const { t } = useTranslation();
    const { entitlements } = useEntitlements();
    const [blocks, setBlocks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const limit = entitlements?.features?.banners ?? 0;
    const canVideo = !!entitlements?.features?.banner_video;
    const atLimit = blocks.length >= limit;

    useEffect(() => {
        let active = true;
        api.get(`businesses/${path}/blocks/`)
            .then((res) => { if (active) setBlocks(res.data); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [path]);

    const showErr = (err) => {
        const reason = err.response?.data?.reason;
        const key = reason ? `blocks.err_${reason}` : 'common.error';
        const txt = t(key);
        setMsg(txt === key ? t('common.error') : txt);
    };

    const addBlock = async (type) => {
        if (atLimit) return;
        setMsg('');
        try {
            const res = await api.post(`businesses/${path}/blocks/`, { block_type: type });
            setBlocks((bs) => [...bs, res.data]);
        } catch (err) { showErr(err); }
    };

    const onField = (id, patch) =>
        setBlocks((bs) => bs.map((b) => (b.id === id ? { ...b, ...patch } : b)));

    const saveBlock = async (block) => {
        setMsg('');
        if (block._videoFile && block._videoFile.size > MAX_VIDEO_BYTES) {
            setMsg(t('blocks.err_video_too_large'));
            return;
        }
        try {
            let payload, config;
            if (block._imageFile || block._videoFile) {
                payload = new FormData();
                payload.append('block_type', block.block_type);
                payload.append('title', block.title || '');
                payload.append('text', block.text || '');
                payload.append('embed_url', block.embed_url || '');
                if (block._imageFile) payload.append('image', block._imageFile);
                if (block._videoFile) payload.append('video', block._videoFile);
                config = { headers: { 'Content-Type': 'multipart/form-data' } };
            } else {
                payload = {
                    block_type: block.block_type,
                    title: block.title || '',
                    text: block.text || '',
                    embed_url: block.embed_url || '',
                };
                config = {};
            }
            const res = await api.patch(`blocks/${block.id}/`, payload, config);
            setBlocks((bs) => bs.map((b) => (b.id === block.id ? res.data : b)));
            setMsg(t('blocks.saved'));
        } catch (err) { showErr(err); }
    };

    const deleteBlock = async (id) => {
        try {
            await api.delete(`blocks/${id}/`);
            setBlocks((bs) => bs.filter((b) => b.id !== id));
        } catch (err) { showErr(err); }
    };

    const onDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = blocks.findIndex((b) => b.id === active.id);
        const newIndex = blocks.findIndex((b) => b.id === over.id);
        const next = arrayMove(blocks, oldIndex, newIndex);
        setBlocks(next);
        try {
            await api.post(`businesses/${path}/blocks/reorder/`, { order: next.map((b) => b.id) });
        } catch (err) { showErr(err); }
    };

    if (loading) return <div className="dashboard-loading"><div className="spinner" /></div>;

    if (limit === 0) {
        return (
            <div className="blocks-upsell">
                <FaLock className="blocks-upsell-icon" />
                <p>{t('blocks.upsell')}</p>
                <Link to="/pricing" className="qr-dl">{t('limit.see_plans')}</Link>
            </div>
        );
    }

    return (
        <div className="blocks-tab">
            <div className="blocks-head">
                <h3>{t('blocks.title')} <span className="blocks-count">{blocks.length}/{limit}</span></h3>
            </div>

            <div className="blocks-add">
                <button type="button" disabled={atLimit} onClick={() => addBlock('image')}><FaPlus /> {t('blocks.image')}</button>
                {canVideo && <button type="button" disabled={atLimit} onClick={() => addBlock('video')}><FaPlus /> {t('blocks.video')}</button>}
                <button type="button" disabled={atLimit} onClick={() => addBlock('text')}><FaPlus /> {t('blocks.text')}</button>
            </div>

            {msg && <div className="blocks-msg">{msg}</div>}

            {blocks.length === 0 ? (
                <p className="blocks-empty">{t('blocks.empty')}</p>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                        {blocks.map((b) => (
                            <SortableBlock key={b.id} block={b} onField={onField} onSave={saveBlock} onDelete={deleteBlock} t={t} />
                        ))}
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
};

export default ContentBlocks;
