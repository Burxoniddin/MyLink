import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useTranslation } from 'react-i18next';
import { useEntitlements } from '../context/EntitlementContext';
import {
    FaPlus, FaTrash, FaGripLines, FaImage, FaVideo, FaAlignLeft, FaLock,
    FaSave, FaChevronDown, FaChevronUp, FaImages, FaCheck,
} from 'react-icons/fa';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const MAX_BLOCKS_PER_SECTION = 10;

const TYPE_ICON = { image: <FaImage />, video: <FaVideo />, text: <FaAlignLeft /> };

const SortableBlock = ({ block, onField, onDelete, t }) => {
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
        </div>
    );
};

// One section card: header (drag handle, cover, editable name, count, delete,
// expand) + when expanded, the per-block editor for its blocks.
const SortableSection = ({ section, expanded, onToggle, children, onRename, onCover, onDelete, t }) => {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: section.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    const [name, setName] = useState(section.name);
    // Sync the editable name when the prop changes — render-phase adjustment
    // (per React docs) instead of an effect, so no cascading re-render.
    const [prevSectionName, setPrevSectionName] = useState(section.name);
    if (prevSectionName !== section.name) {
        setPrevSectionName(section.name);
        setName(section.name);
    }

    return (
        <div ref={setNodeRef} style={style} className="section-item">
            <div className="section-head">
                <div className="block-drag" {...attributes} {...listeners}><FaGripLines /></div>
                <label className="section-cover" title={t('sections.cover')}>
                    {section.cover
                        ? <img src={section.cover} alt="" />
                        : <FaImages />}
                    <input type="file" accept="image/*" hidden onChange={(e) => {
                        const f = e.target.files[0];
                        if (f) onCover(section.id, f);
                        e.target.value = '';
                    }} />
                </label>
                <input
                    className="section-name"
                    value={name}
                    placeholder={t('sections.name_ph')}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => { if (name.trim() && name !== section.name) onRename(section.id, name.trim()); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                />
                <span className="section-count">{(section.blocks || []).length}/{MAX_BLOCKS_PER_SECTION}</span>
                <button type="button" className="block-del" onClick={() => onDelete(section.id)}><FaTrash /></button>
                <button type="button" className="section-toggle" onClick={() => onToggle(section.id)}>
                    {expanded ? <FaChevronUp /> : <FaChevronDown />}
                </button>
            </div>
            {expanded && (
                <div className="section-body">
                    {/* Explicit cover row — the tiny header thumbnail alone was easy to miss. */}
                    <div className="scr-row">
                        <label className="scr-btn">
                            {section.cover ? <img src={section.cover} alt="" /> : <FaImages />}
                            <span>{section.cover ? t('sections.cover_change') : t('sections.cover_set')}</span>
                            <input type="file" accept="image/*" hidden onChange={(e) => {
                                const f = e.target.files[0];
                                if (f) onCover(section.id, f);
                                e.target.value = '';
                            }} />
                        </label>
                        <span className="scr-hint">{t('sections.cover_hint')}</span>
                    </div>
                    {children}
                </div>
            )}
        </div>
    );
};

const MediaSections = ({ path, onChanged }) => {
    const { t } = useTranslation();
    const { entitlements } = useEntitlements();
    const [sections, setSections] = useState([]);
    const [expanded, setExpanded] = useState(null);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const [savingId, setSavingId] = useState(null);
    const [uploadingId, setUploadingId] = useState(null);
    const [savedFlash, setSavedFlash] = useState(false);
    // Shared hidden picker for the "tap → gallery/camera" multi-file flow.
    const mediaInput = useRef(null);
    const pickSid = useRef(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    const limit = entitlements?.features?.banners ?? 0;
    const canVideo = !!entitlements?.features?.banner_video;
    const atLimit = sections.length >= limit;

    useEffect(() => {
        let active = true;
        api.get(`businesses/${path}/sections/`)
            .then((res) => { if (active) setSections(res.data); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [path]);

    // Let the parent (editor preview) know the sections changed.
    const notify = (next) => { onChanged?.(next); };
    const setAndNotify = (updater) => {
        setSections((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            notify(next);
            return next;
        });
    };

    const showErr = (err) => {
        const reason = err.response?.data?.reason;
        const candidates = [`sections.err_${reason}`, `blocks.err_${reason}`];
        const found = candidates.find((k) => t(k) !== k);
        setMsg(found ? t(found) : t('common.error'));
    };

    // ---- sections ----
    const addSection = async () => {
        if (atLimit) return;
        setMsg('');
        try {
            const res = await api.post(`businesses/${path}/sections/`, { name: t('sections.new_name') });
            setAndNotify((ss) => [...ss, res.data]);
            setExpanded(res.data.id);
        } catch (err) { showErr(err); }
    };

    const renameSection = async (id, name) => {
        setMsg('');
        try {
            const res = await api.patch(`sections/${id}/`, { name });
            setAndNotify((ss) => ss.map((s) => (s.id === id ? { ...s, name: res.data.name } : s)));
        } catch (err) { showErr(err); }
    };

    const coverSection = async (id, file) => {
        setMsg('');
        try {
            const payload = new FormData();
            payload.append('cover_upload', file);
            const res = await api.patch(`sections/${id}/`, payload, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setAndNotify((ss) => ss.map((s) => (s.id === id ? { ...s, cover: res.data.cover } : s)));
        } catch (err) { showErr(err); }
    };

    const deleteSection = async (id) => {
        if (!window.confirm(t('sections.confirm_delete'))) return;
        try {
            await api.delete(`sections/${id}/`);
            setAndNotify((ss) => ss.filter((s) => s.id !== id));
        } catch (err) { showErr(err); }
    };

    const onSectionDragEnd = async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = sections.findIndex((s) => s.id === active.id);
        const newIndex = sections.findIndex((s) => s.id === over.id);
        const next = arrayMove(sections, oldIndex, newIndex);
        setAndNotify(next);
        try {
            await api.post(`businesses/${path}/sections/reorder/`, { order: next.map((s) => s.id) });
        } catch (err) { showErr(err); }
    };

    // ---- blocks (inside a section) ----
    const patchSectionBlocks = (sid, fn) =>
        setAndNotify((ss) => ss.map((s) => (s.id === sid ? { ...s, blocks: fn(s.blocks || []) } : s)));

    const addBlock = async (sid, type) => {
        setMsg('');
        try {
            const res = await api.post(`businesses/${path}/blocks/`, { block_type: type, section: sid });
            patchSectionBlocks(sid, (bs) => [...bs, res.data]);
        } catch (err) { showErr(err); }
    };

    // Multi-file flow: ONE "Media" button opens the device picker (gallery or
    // camera on mobile) for images and videos together; every chosen file
    // becomes its own block — type auto-detected per file — uploaded and placed
    // in order. Titles are then edited per block.
    const addMediaFiles = async (sid, files) => {
        if (!sid || files.length === 0) return;
        setMsg('');
        const section = sections.find((x) => x.id === sid);
        const room = MAX_BLOCKS_PER_SECTION - (section?.blocks || []).length;
        let picked = files.slice(0, Math.max(0, room)).map((f) => ({
            file: f,
            type: f.type.startsWith('video/') ? 'video' : 'image',
        }));
        if (picked.some((p) => p.type === 'video' && !canVideo)) {
            setMsg(t('blocks.err_banner_video'));
            picked = picked.filter((p) => p.type !== 'video');
        }
        if (picked.some((p) => p.type === 'video' && p.file.size > MAX_VIDEO_BYTES)) {
            setMsg(t('blocks.err_video_too_large'));
            picked = picked.filter((p) => !(p.type === 'video' && p.file.size > MAX_VIDEO_BYTES));
        }
        if (picked.length === 0) return;
        setUploadingId(sid);
        try {
            for (const { file, type } of picked) {
                const created = await api.post(`businesses/${path}/blocks/`, { block_type: type, section: sid });
                const fd = new FormData();
                fd.append('block_type', type);
                fd.append(type, file); // serializer field: image | video
                const res = await api.patch(`blocks/${created.data.id}/`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                patchSectionBlocks(sid, (bs) => [...bs, res.data]);
            }
        } catch (err) { showErr(err); } finally { setUploadingId(null); }
    };

    const openPicker = (sid) => {
        pickSid.current = sid;
        mediaInput.current?.click();
    };

    // Field edits only mark the block dirty — persisting happens once per
    // section via the single save button.
    const onField = (sid) => (id, patch) =>
        patchSectionBlocks(sid, (bs) => bs.map((b) => (b.id === id ? { ...b, ...patch, _dirty: true } : b)));

    const saveSection = (sid) => async () => {
        setMsg('');
        const section = sections.find((s) => s.id === sid);
        const dirty = (section?.blocks || []).filter((b) => b._dirty);
        if (dirty.length === 0) return;
        if (dirty.some((b) => b._videoFile && b._videoFile.size > MAX_VIDEO_BYTES)) {
            setMsg(t('blocks.err_video_too_large'));
            return;
        }
        setSavingId(sid);
        try {
            for (const block of dirty) {
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
                patchSectionBlocks(sid, (bs) => bs.map((b) => (b.id === block.id ? res.data : b)));
            }
            // Clear centre-screen confirmation — the old inline note was easy to miss.
            setSavedFlash(true);
            setTimeout(() => setSavedFlash(false), 1600);
        } catch (err) { showErr(err); } finally { setSavingId(null); }
    };

    const deleteBlock = (sid) => async (id) => {
        // Ask once before discarding — content/media can't be recovered.
        if (!window.confirm(t('blocks.confirm_delete'))) return;
        try {
            await api.delete(`blocks/${id}/`);
            patchSectionBlocks(sid, (bs) => bs.filter((b) => b.id !== id));
        } catch (err) { showErr(err); }
    };

    const onBlockDragEnd = (sid) => async ({ active, over }) => {
        if (!over || active.id === over.id) return;
        const section = sections.find((s) => s.id === sid);
        const bs = section?.blocks || [];
        const oldIndex = bs.findIndex((b) => b.id === active.id);
        const newIndex = bs.findIndex((b) => b.id === over.id);
        const next = arrayMove(bs, oldIndex, newIndex);
        patchSectionBlocks(sid, () => next);
        try {
            await api.post(`businesses/${path}/blocks/reorder/`, { order: next.map((b) => b.id) });
        } catch (err) { showErr(err); }
    };

    if (loading) return <div className="dashboard-loading"><div className="spinner" /></div>;

    if (limit === 0) {
        return (
            <div className="blocks-upsell">
                <FaLock className="blocks-upsell-icon" />
                <p>{t('sections.upsell')}</p>
                <Link to="/pricing" className="qr-dl">{t('limit.see_plans')}</Link>
            </div>
        );
    }

    return (
        <div className="blocks-tab">
            {savedFlash && (
                <div className="saved-flash-overlay">
                    <div className="saved-flash">
                        <FaCheck />
                        <span>{t('detail.saved')}</span>
                    </div>
                </div>
            )}
            {/* Hidden picker for the tap→gallery multi-file media flow */}
            <input
                ref={mediaInput} type="file" multiple hidden
                accept={canVideo ? 'image/*,video/*' : 'image/*'}
                onChange={(e) => { addMediaFiles(pickSid.current, Array.from(e.target.files)); e.target.value = ''; }}
            />
            <div className="blocks-head">
                <h3>{t('sections.title')} <span className="blocks-count">{sections.length}/{limit}</span></h3>
                <button type="button" className="add-btn" disabled={atLimit} onClick={addSection}>
                    <FaPlus /> {t('sections.add')}
                </button>
            </div>

            {msg && <div className="blocks-msg">{msg}</div>}

            {sections.length === 0 ? (
                <p className="blocks-empty">{t('sections.empty')}</p>
            ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSectionDragEnd}>
                    <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                        {sections.map((s) => {
                            const blocks = s.blocks || [];
                            const blocksFull = blocks.length >= MAX_BLOCKS_PER_SECTION;
                            return (
                                <SortableSection
                                    key={s.id}
                                    section={s}
                                    expanded={expanded === s.id}
                                    onToggle={(id) => setExpanded((cur) => (cur === id ? null : id))}
                                    onRename={renameSection}
                                    onCover={coverSection}
                                    onDelete={deleteSection}
                                    t={t}
                                >
                                    <div className="blocks-add">
                                        <button type="button" disabled={blocksFull || uploadingId === s.id} onClick={() => openPicker(s.id)}><FaPlus /> {t('blocks.media')}</button>
                                        <button type="button" disabled={blocksFull || uploadingId === s.id} onClick={() => addBlock(s.id, 'text')}><FaPlus /> {t('blocks.text')}</button>
                                        {uploadingId === s.id && <span className="blocks-uploading">{t('blocks.uploading')}</span>}
                                    </div>

                                    {blocks.length === 0 ? (
                                        <p className="blocks-empty">{t('blocks.empty')}</p>
                                    ) : (
                                        <>
                                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onBlockDragEnd(s.id)}>
                                                <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                                                    {blocks.map((b) => (
                                                        <SortableBlock
                                                            key={b.id}
                                                            block={b}
                                                            onField={onField(s.id)}
                                                            onDelete={deleteBlock(s.id)}
                                                            t={t}
                                                        />
                                                    ))}
                                                </SortableContext>
                                            </DndContext>
                                            {/* One save for the whole section — persists every edited block. */}
                                            <button
                                                type="button"
                                                className="block-save section-save"
                                                disabled={savingId === s.id || !blocks.some((b) => b._dirty)}
                                                onClick={saveSection(s.id)}
                                            >
                                                <FaSave /> {savingId === s.id ? t('detail.saving') : t('common.save')}
                                            </button>
                                        </>
                                    )}
                                </SortableSection>
                            );
                        })}
                    </SortableContext>
                </DndContext>
            )}
        </div>
    );
};

export default MediaSections;
