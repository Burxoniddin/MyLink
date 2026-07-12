import React, { useId } from 'react';
import './VerifiedBadge.css';

// Luxury gold "verified" seal shown next to a Pro business's name — a
// scalloped rosette with a gold gradient, white check and a periodic shine
// sweep. Pure SVG so it renders identically on the classic and sector
// templates and inside the scaled editor preview.
const VerifiedBadge = ({ size = '0.72em', title = 'Verified' }) => {
    // Gradient/clip ids must be unique per mount — the badge can be on the
    // page and in the live preview at the same time.
    const uid = useId();
    const goldId = `vb-gold-${uid}`;
    const shineId = `vb-shine-${uid}`;
    const clipId = `vb-clip-${uid}`;
    const seal = 'M23 12l-2.44-2.79.34-3.69-3.61-.82-1.89-3.2L12 2.96 8.6 1.5 6.71 4.69l-3.61.82.34 3.69L1 12l2.44 2.79-.34 3.7 3.61.82L8.6 22.5l3.4-1.47 3.4 1.46 1.89-3.19 3.61-.82-.34-3.69L23 12z';

    return (
        <svg
            className="vb-badge"
            style={{ width: size, height: size }}
            viewBox="0 0 24 24"
            role="img"
            aria-label={title}
        >
            <title>{title}</title>
            <defs>
                <linearGradient id={goldId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#FDE68A" />
                    <stop offset="0.5" stopColor="#F59E0B" />
                    <stop offset="1" stopColor="#B45309" />
                </linearGradient>
                <linearGradient id={shineId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0" stopColor="#fff" stopOpacity="0" />
                    <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
                    <stop offset="1" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <clipPath id={clipId}><path d={seal} /></clipPath>
            </defs>
            <path d={seal} fill={`url(#${goldId})`} />
            {/* thin lighter-gold inner rim */}
            <path
                d={seal}
                fill="none"
                stroke="#FEF3C7"
                strokeWidth="0.9"
                opacity="0.65"
                transform="translate(12 12) scale(0.82) translate(-12 -12)"
            />
            <path
                d="M7.7 12.3l2.9 2.9 5.7-5.9"
                fill="none"
                stroke="#fff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <g clipPath={`url(#${clipId})`}>
                <g transform="skewX(-20)">
                    <rect className="vb-shine" x="-4" y="-2" width="9" height="28" fill={`url(#${shineId})`} />
                </g>
            </g>
        </svg>
    );
};

export default VerifiedBadge;
