import React, { useEffect, useState } from 'react';
import { FaTimes, FaPlay, FaAlignLeft, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

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

// Instagram-style "highlights": a centered row of circular media thumbnails that
// open in a story-viewer modal. Sits between the bio and the links.
const Highlights = ({ blocks, getMediaUrl, toEmbed }) => {
    const items = (blocks || []).filter(hasContent);
    const [active, setActive] = useState(null);

    useEffect(() => {
        if (active === null) return undefined;
        const onKey = (e) => {
            if (e.key === 'Escape') setActive(null);
            else if (e.key === 'ArrowLeft') setActive((i) => (i > 0 ? i - 1 : i));
            else if (e.key === 'ArrowRight') setActive((i) => (i < items.length - 1 ? i + 1 : i));
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [active, items.length]);

    if (items.length === 0) return null;

    const renderThumb = (b) => {
        if (b.block_type === 'image' && b.image) {
            return <img src={getMediaUrl(b.image)} alt="" />;
        }
        if (b.block_type === 'video') {
            if (b.video) return <video src={getMediaUrl(b.video)} muted preload="metadata" />;
            const yt = ytThumb(b.embed_url);
            return yt ? <img src={yt} alt="" /> : <FaPlay />;
        }
        return <FaAlignLeft />;
    };

    const b = active !== null ? items[active] : null;

    return (
        <>
            <div className="hl-row">
                {items.map((item, i) => (
                    <button key={item.id} type="button" className="hl-item" onClick={() => setActive(i)}>
                        <span className={`hl-ring hl-${item.block_type}`}>
                            <span className="hl-thumb">{renderThumb(item)}</span>
                        </span>
                        <span className="hl-label">{item.title || '•'}</span>
                    </button>
                ))}
            </div>

            {b && (
                <div className="hl-modal" onClick={() => setActive(null)}>
                    <button type="button" className="hl-close" onClick={() => setActive(null)} aria-label="close">
                        <FaTimes />
                    </button>

                    {items.length > 1 && (
                        <button
                            type="button"
                            className="hl-nav hl-prev"
                            onClick={(e) => { e.stopPropagation(); setActive((i) => (i > 0 ? i - 1 : i)); }}
                            disabled={active === 0}
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
                            onClick={(e) => { e.stopPropagation(); setActive((i) => (i < items.length - 1 ? i + 1 : i)); }}
                            disabled={active === items.length - 1}
                            aria-label="next"
                        ><FaChevronRight /></button>
                    )}
                </div>
            )}
        </>
    );
};

export default Highlights;
