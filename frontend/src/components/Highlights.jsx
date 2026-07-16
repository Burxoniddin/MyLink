import React, { useEffect, useState } from 'react';
import { FaTimes, FaPlay, FaAlignLeft, FaChevronLeft, FaChevronRight, FaImages } from 'react-icons/fa';

// YouTube thumbnail from a watch/short/embed URL.
const ytThumb = (url) => {
    const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
    return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
};

const hasContent = (b) => {
    if (b.block_type === 'text') return !!(b.text || b.title);
    if (b.block_type === 'image') return !!b.image;
    if (b.block_type === 'video') return !!(b.video || b.embed_url);
    return false;
};

// Media sections on the public page: a horizontal scroll-snap carousel of
// section cover cards (between the bio and the links). Tapping a card opens
// that section's blocks in a story-viewer modal with prev/next navigation.
const Highlights = ({ sections, getMediaUrl, toEmbed }) => {
    const groups = (sections || [])
        .map((s) => ({ ...s, items: (s.blocks || []).filter(hasContent) }))
        .filter((s) => s.items.length > 0);

    // Story-viewer position: { s: sectionIdx, b: blockIdx } or null.
    const [pos, setPos] = useState(null);
    const items = pos ? groups[pos.s]?.items || [] : [];

    useEffect(() => {
        if (pos === null) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setPos(null);
            else if (e.key === 'ArrowLeft') setPos((p) => (p.b > 0 ? { ...p, b: p.b - 1 } : p));
            else if (e.key === 'ArrowRight') setPos((p) => (p.b < items.length - 1 ? { ...p, b: p.b + 1 } : p));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [pos, items.length]);

    if (groups.length === 0) return null;

    const blockThumb = (b) => {
        if (b.block_type === 'image' && b.image) return <img src={getMediaUrl(b.image)} alt="" />;
        if (b.block_type === 'video') {
            if (b.video) return <video src={getMediaUrl(b.video)} muted preload="metadata" />;
            const yt = ytThumb(b.embed_url);
            return yt ? <img src={yt} alt="" /> : <FaPlay />;
        }
        return <FaAlignLeft />;
    };

    const sectionCover = (s) => {
        if (s.cover) return <img src={getMediaUrl(s.cover)} alt="" />;
        const first = s.items.find((b) => b.block_type !== 'text');
        return first ? blockThumb(first) : <FaImages />;
    };

    const b = pos !== null ? items[pos.b] : null;

    return (
        <>
            <div className="hl-row">
                {groups.map((s, si) => (
                    <button key={s.id} type="button" className="hl-item" onClick={() => setPos({ s: si, b: 0 })}>
                        <span className="hl-ring">
                            <span className="hl-thumb">{sectionCover(s)}</span>
                            <span className="hl-count">{s.items.length}</span>
                        </span>
                        <span className="hl-label">{s.name}</span>
                    </button>
                ))}
            </div>

            {b && (
                <div className="hl-modal" onClick={() => setPos(null)}>
                    <button type="button" className="hl-close" onClick={() => setPos(null)} aria-label="close">
                        <FaTimes />
                    </button>

                    <div className="hl-counter">{groups[pos.s].name} · {pos.b + 1}/{items.length}</div>

                    {items.length > 1 && (
                        <button
                            type="button"
                            className="hl-nav hl-prev"
                            onClick={(e) => { e.stopPropagation(); setPos((p) => (p.b > 0 ? { ...p, b: p.b - 1 } : p)); }}
                            disabled={pos.b === 0}
                            aria-label="prev"
                        ><FaChevronLeft /></button>
                    )}

                    {/* Stage has no stopPropagation: tapping any empty side closes.
                        Only the interactive video stops it so its controls work. */}
                    <div className="hl-stage">
                        {b.title && <div className="hl-stage-title">{b.title}</div>}
                        {b.block_type === 'text' && b.text && (
                            <div className="hl-stage-text" onClick={(e) => e.stopPropagation()}>{b.text}</div>
                        )}
                        {b.block_type === 'image' && b.image && (
                            <img className="hl-stage-media" src={getMediaUrl(b.image)} alt={b.title || ''} onClick={(e) => e.stopPropagation()} />
                        )}
                        {b.block_type === 'video' && (
                            b.video ? (
                                <video
                                    className="hl-stage-media"
                                    src={getMediaUrl(b.video)}
                                    controls
                                    autoPlay
                                    playsInline
                                    onClick={(e) => e.stopPropagation()}
                                />
                            ) : b.embed_url ? (
                                <div className="hl-stage-embed" onClick={(e) => e.stopPropagation()}>
                                    <iframe
                                        src={`${toEmbed(b.embed_url)}${toEmbed(b.embed_url).includes('?') ? '&' : '?'}autoplay=1`}
                                        title={b.title || 'video'}
                                        allow="autoplay; encrypted-media"
                                        allowFullScreen
                                    />
                                </div>
                            ) : null
                        )}
                    </div>

                    {items.length > 1 && (
                        <button
                            type="button"
                            className="hl-nav hl-next"
                            onClick={(e) => { e.stopPropagation(); setPos((p) => (p.b < items.length - 1 ? { ...p, b: p.b + 1 } : p)); }}
                            disabled={pos.b === items.length - 1}
                            aria-label="next"
                        ><FaChevronRight /></button>
                    )}
                </div>
            )}
        </>
    );
};

export default Highlights;
