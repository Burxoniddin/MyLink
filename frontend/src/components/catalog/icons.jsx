import React from 'react';

// Line-icon set for the catalog surfaces (menu page, editor, modal). One shared
// 24px grid so stroke weights stay consistent wherever they appear.
const PATHS = {
    back: <path d="M15 18l-6-6 6-6" />,
    x: <path d="M18 6L6 18M6 6l12 12" />,
    chevR: <path d="M9 6l6 6-6 6" />,
    chevD: <path d="M6 9l6 6 6-6" />,
    out: <path d="M7 17L17 7M9 7h8v8" />,
    copy: <g><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></g>,
    layers: <g><rect x="3" y="7" width="13" height="13" rx="3" /><path d="M8 3.5h9.5A3.5 3.5 0 0 1 21 7v9.5" /></g>,
    qr: (
        <g>
            <rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" />
            <rect x="4" y="14" width="6" height="6" rx="1" />
            <path d="M14 14h3v3h-3zM20 20h-3.5M20 14v3M17 20v.01" />
        </g>
    ),
    drag: <path d="M8 6h8M8 12h8M8 18h8" />,
    plus: <path d="M12 5v14M5 12h14" />,
    trash: <g><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></g>,
    pen: <path d="M4 20l4.5-1L20 7.5a2.12 2.12 0 0 0-3-3L5.5 16zM13.5 6l3 3" />,
    warn: <g><path d="M12 3L2.5 20h19z" /><path d="M12 9.5V14M12 17v.01" /></g>,
    lock: <g><rect x="5" y="11" width="14" height="9" rx="2.5" /><path d="M8 11V7.5a4 4 0 0 1 8 0V11" /></g>,
    img: (
        <g>
            <rect x="3" y="5" width="18" height="14" rx="3" /><circle cx="9" cy="10" r="1.6" />
            <path d="M4 17.5l4.5-4.5 3.5 3.5 3-3 5 4.5" />
        </g>
    ),
    book: <g><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M8 7.5h8M8 11h5" /></g>,
    check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
    arrowR: <path d="M4 12h16m-6-6 6 6-6 6" />,
    dl: <path d="M12 4v11m0 0 4.5-4.5M12 15l-4.5-4.5M5 20h14" />,
    dish: <g><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="3.2" /></g>,
};

export const Ic = ({ n, s = 18, w = 1.8, style, className }) => (
    <svg
        className={className} width={s} height={s} viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"
        style={style} aria-hidden="true"
    >
        {PATHS[n]}
    </svg>
);

/** Verified seal tinted with the current theme accent (the gold VerifiedBadge
 *  would fight the non-indigo menu palettes). */
export const Seal = ({ s = 15, c = 'currentColor', style, title = 'Verified' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" style={style} role="img" aria-label={title}>
        <path fill={c} d="M12 1.8l2.5 2 3.2-.3 1 3 2.9 1.4-1 3.1 1 3.1-2.9 1.4-1 3-3.2-.3-2.5 2-2.5-2-3.2.3-1-3L2.4 14l1-3.1-1-3.1 2.9-1.4 1-3 3.2.3z" />
        <path d="M8.6 12.2l2.2 2.2 4.4-4.6" stroke="#fff" strokeWidth="2.1" fill="none"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default Ic;
