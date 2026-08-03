import React, { useEffect, useState } from 'react';
import { FaTimes, FaPlay, FaAlignLeft, FaChevronLeft, FaChevronRight, FaImages } from 'react-icons/fa';

// Seconds an image/text slide stays open before auto-advancing (IG-story style).
const SLIDE_SECS = 5;

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
// that section's blocks in a story-viewer modal that auto-advances like an
// Instagram story (images/text on a timer, uploaded videos when they end),
// flowing into the next section and closing after the last one.
const Highlights = ({ sections, getMediaUrl, toEmbed }) => {
    const groups = (sections || [])
        .map((s) => ({ ...s, items: (s.blocks || []).filter(hasContent) }))
        .filter((s) => s.items.length > 0);

    // Story-viewer position: { s: sectionIdx, b: blockIdx } or null.
    const [pos, setPos] = useState(null);
    const [vidProgress, setVidProgress] = useState(0); // 0..1 for uploaded videos
    const items = pos ? groups[pos.s]?.items || [] : [];

    // Next block → next section → close after the very last item.
    // Video progress resets on every position change (handlers, not an effect).
    const goNext = () => {
        setVidProgress(0);
        setPos((p) => {
            if (!p) return p;
            const its = groups[p.s]?.items || [];
            if (p.b < its.length - 1) return { ...p, b: p.b + 1 };
            if (p.s < groups.length - 1) return { s: p.s + 1, b: 0 };
            return null;
        });
    };
    const goPrev = () => {
        setVidProgress(0);
        setPos((p) => {
            if (!p) return p;
            if (p.b > 0) return { ...p, b: p.b - 1 };
            if (p.s > 0) return { s: p.s - 1, b: Math.max(0, (groups[p.s - 1].items || []).length - 1) };
            return p;
        });
    };

    useEffect(() => {
        if (pos === null) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setPos(null);
            else if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pos]);

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
    // Uploaded videos advance when they end; images/text run the fixed timer.
    // Embeds (YouTube iframe) can't report progress — manual navigation only.
    const isUploadedVideo = !!(b && b.block_type === 'video' && b.video);
    const isEmbed = !!(b && b.block_type === 'video' && !b.video && b.embed_url);
    const isTimed = !!(b && !isUploadedVideo && !isEmbed);

    const canNavigate = items.length > 1 || groups.length > 1;

    return (
        <>
            <div className="hl-row">
                {groups.map((s, si) => (
                    <button key={s.id} type="button" className="hl-item" onClick={() => { setVidProgress(0); setPos({ s: si, b: 0 }); }}>
                        <span className="hl-ring">
                            <span className="hl-thumb">{sectionCover(s)}</span>
                        </span>
                        <span className="hl-label">{s.name}</span>
                    </button>
                ))}
            </div>

            {b && (
                <div className="hl-modal" onClick={() => setPos(null)}>
                    {/* IG-style progress segments for the current section */}
                    <div className="hl-progress">
                        {items.map((it, i) => (
                            <span key={it.id} className="hl-seg">
                                {i < pos.b && <span className="hl-seg-fill done" />}
                                {i === pos.b && (
                                    isTimed ? (
                                        <span
                                            key={`t-${pos.s}-${pos.b}`}
                                            className="hl-seg-fill anim"
                                            style={{ animationDuration: `${SLIDE_SECS}s` }}
                                            onAnimationEnd={goNext}
                                        />
                                    ) : isUploadedVideo ? (
                                        <span className="hl-seg-fill" style={{ width: `${vidProgress * 100}%` }} />
                                    ) : (
                                        <span className="hl-seg-fill hold" />
                                    )
                                )}
                            </span>
                        ))}
                    </div>

                    <button type="button" className="hl-close" onClick={() => setPos(null)} aria-label="close">
                        <FaTimes />
                    </button>

                    <div className="hl-counter">{groups[pos.s].name} · {pos.b + 1}/{items.length}</div>

                    {canNavigate && (
                        <button
                            type="button"
                            className="hl-nav hl-prev"
                            onClick={(e) => { e.stopPropagation(); goPrev(); }}
                            disabled={pos.s === 0 && pos.b === 0}
                            aria-label="prev"
                        ><FaChevronLeft /></button>
                    )}

                    {/* Stage has no stopPropagation: tapping any empty side closes.
                        Only the interactive video stops it so its controls work. */}
                    <div className="hl-stage">
                        {/* Only text blocks have titles — media shows clean. */}
                        {b.block_type === 'text' && b.title && <div className="hl-stage-title">{b.title}</div>}
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
                                    onTimeUpdate={(e) => {
                                        const el = e.currentTarget;
                                        if (el.duration) setVidProgress(el.currentTime / el.duration);
                                    }}
                                    onEnded={goNext}
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

                    {canNavigate && (
                        <button
                            type="button"
                            className="hl-nav hl-next"
                            onClick={(e) => { e.stopPropagation(); goNext(); }}
                            aria-label="next"
                        ><FaChevronRight /></button>
                    )}
                </div>
            )}
        </>
    );
};

export default Highlights;
