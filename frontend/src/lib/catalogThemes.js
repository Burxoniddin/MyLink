// MyCatalog — 8 visual presets for the public web-menu, each with a dark and a
// light palette. Ported from the design project; the ids must stay in sync with
// Catalog.THEME_CHOICES in backend/catalog/models.py.
//
// Per preset: d = display font, s = body font, r = card radius, cr = chip radius,
// sw = the two swatch colors shown in the editor picker.
export const CATALOG_THEMES = [
    {
        id: 'mylink', nom: 'MyLink',
        d: '"Outfit",system-ui,sans-serif', s: '"Outfit",system-ui,sans-serif',
        r: 18, cr: 999, sw: ['#6366F1', '#A855F7'],
        dark: {
            bg: '#0F0F1A', card: '#1A1A2A', line: 'rgba(165,165,225,.14)', text: '#F1F1FA',
            muted: '#9C9CBB', soft: 'rgba(129,140,248,.15)', accent: '#818CF8', accent2: '#C084FC',
            aInk: '#fff', tex: 'radial-gradient(620px 340px at 50% -120px, rgba(99,102,241,.25), transparent 70%)',
        },
        light: {
            bg: '#F6F6FC', card: '#FFFFFF', line: '#E6E5F2', text: '#1B1A2E',
            muted: '#6E6C8A', soft: 'rgba(99,102,241,.10)', accent: '#6366F1', accent2: '#A855F7',
            aInk: '#fff', tex: 'radial-gradient(620px 340px at 50% -120px, rgba(139,92,246,.13), transparent 70%)',
        },
    },
    {
        id: 'tandir', nom: 'Tandir',
        d: '"Bricolage Grotesque",system-ui,sans-serif', s: '"Manrope",system-ui,sans-serif',
        r: 20, cr: 999, sw: ['#F2A65A', '#D95D39'],
        dark: {
            bg: '#170F0A', card: '#241710', line: 'rgba(255,224,196,.13)', text: '#FCEEE1',
            muted: '#B79A85', soft: 'rgba(242,166,90,.15)', accent: 'oklch(0.78 0.16 65)',
            accent2: 'oklch(0.62 0.2 32)', aInk: '#2A1305',
            tex: 'radial-gradient(520px 300px at 50% -100px, oklch(0.62 0.18 55 / .35), transparent 70%)',
        },
        light: {
            bg: '#FFF6EE', card: '#FFFDFB', line: 'rgba(120,70,35,.13)', text: '#2A1408',
            muted: '#9A6A48', soft: 'rgba(217,93,57,.10)', accent: 'oklch(0.66 0.17 55)',
            accent2: 'oklch(0.56 0.19 32)', aInk: '#fff',
            tex: 'radial-gradient(520px 300px at 50% -100px, oklch(0.82 0.13 65 / .5), transparent 70%)',
        },
    },
    {
        id: 'anor', nom: 'Anor',
        d: '"Sora",system-ui,sans-serif', s: '"Manrope",system-ui,sans-serif',
        r: 16, cr: 999, sw: ['#E14D5E', '#8E1F3F'],
        dark: {
            bg: '#150B0F', card: '#231218', line: 'rgba(255,190,205,.13)', text: '#FAEDEF',
            muted: '#B78E98', soft: 'rgba(225,77,94,.15)', accent: 'oklch(0.66 0.19 15)',
            accent2: 'oklch(0.5 0.2 350)', aInk: '#fff',
            tex: 'radial-gradient(520px 300px at 50% -100px, oklch(0.5 0.19 10 / .4), transparent 70%)',
        },
        light: {
            bg: '#FBF1F1', card: '#FFFFFF', line: '#F0DCDE', text: '#2C1218',
            muted: '#935F6B', soft: 'rgba(225,77,94,.09)', accent: 'oklch(0.55 0.2 15)',
            accent2: 'oklch(0.45 0.19 350)', aInk: '#fff',
            tex: 'radial-gradient(520px 300px at 50% -100px, oklch(0.8 0.08 15 / .45), transparent 70%)',
        },
    },
    {
        id: 'rayhon', nom: 'Rayhon',
        d: '"Space Grotesk",system-ui,sans-serif', s: '"Manrope",system-ui,sans-serif',
        r: 14, cr: 11, sw: ['#5FA85F', '#8CC63F'],
        dark: {
            bg: '#0C120D', card: '#17211A', line: 'rgba(190,230,200,.13)', text: '#ECF6EC',
            muted: '#97AF9C', soft: 'rgba(95,168,95,.15)', accent: 'oklch(0.68 0.15 145)',
            accent2: 'oklch(0.76 0.15 120)', aInk: '#08150C',
            tex: 'radial-gradient(520px 300px at 50% -100px, oklch(0.55 0.12 145 / .3), transparent 70%)',
        },
        light: {
            bg: '#F3F7F1', card: '#FFFFFF', line: '#E1EADF', text: '#17251A',
            muted: '#6C8371', soft: 'rgba(95,168,95,.11)', accent: 'oklch(0.52 0.14 145)',
            accent2: 'oklch(0.62 0.14 120)', aInk: '#fff',
            tex: 'radial-gradient(520px 300px at 50% -100px, oklch(0.85 0.09 140 / .5), transparent 70%)',
        },
    },
    {
        id: 'oltin', nom: 'Oltin tun',
        d: '"Cormorant Garamond",Georgia,serif', s: '"Jost",system-ui,sans-serif',
        r: 9, cr: 7, sw: ['#D9B36A', '#8A6B33'],
        dark: {
            bg: '#131210', card: '#1C1A16', line: 'rgba(217,179,106,.17)', text: '#F4EDDE',
            muted: '#A79B82', soft: 'rgba(217,179,106,.12)', accent: 'oklch(0.79 0.11 85)',
            accent2: 'oklch(0.62 0.1 70)', aInk: '#1C1608',
            tex: 'repeating-linear-gradient(135deg, rgba(217,179,106,.05) 0 1px, transparent 1px 10px)',
        },
        light: {
            bg: '#FAF6ED', card: '#FFFEFA', line: '#EBE2CD', text: '#262013',
            muted: '#8D7F63', soft: 'rgba(170,135,70,.10)', accent: 'oklch(0.6 0.1 80)',
            accent2: 'oklch(0.48 0.09 70)', aInk: '#fff',
            tex: 'repeating-linear-gradient(135deg, rgba(170,135,70,.05) 0 1px, transparent 1px 10px)',
        },
    },
    {
        id: 'chinni', nom: 'Chinni',
        d: '"Jost",system-ui,sans-serif', s: '"Jost",system-ui,sans-serif',
        r: 22, cr: 999, sw: ['#2E5FB7', '#57B7D4'],
        dark: {
            bg: '#0B1220', card: '#151F34', line: 'rgba(150,190,240,.14)', text: '#EEF3FB',
            muted: '#93A5C4', soft: 'rgba(87,183,212,.13)', accent: 'oklch(0.64 0.14 255)',
            accent2: 'oklch(0.74 0.11 215)', aInk: '#08111F',
            tex: 'radial-gradient(rgba(130,175,235,.10) 1px, transparent 1px)', texSize: '17px 17px',
        },
        light: {
            bg: '#F2F6FB', card: '#FFFFFF', line: '#DFE8F4', text: '#14233B',
            muted: '#64789A', soft: 'rgba(46,95,183,.09)', accent: 'oklch(0.5 0.16 258)',
            accent2: 'oklch(0.63 0.12 215)', aInk: '#fff',
            tex: 'radial-gradient(rgba(46,95,183,.08) 1px, transparent 1px)', texSize: '17px 17px',
        },
    },
    {
        id: 'qaymoq', nom: 'Qaymoq',
        d: '"Manrope",system-ui,sans-serif', s: '"Manrope",system-ui,sans-serif',
        r: 12, cr: 999, sw: ['#3B342C', '#C9BEB0'],
        dark: {
            bg: '#16130F', card: '#211D17', line: 'rgba(230,215,195,.12)', text: '#F1EAE0',
            muted: '#A2988A', soft: 'rgba(233,223,206,.12)', accent: '#E9DFCE',
            accent2: '#C4B69C', aInk: '#221C12', tex: 'none',
        },
        light: {
            bg: '#FAF7F2', card: '#FFFEFC', line: '#E9E2D8', text: '#26211B',
            muted: '#877D70', soft: 'rgba(60,50,40,.07)', accent: '#2E2822',
            accent2: '#5C5240', aInk: '#FFF9EE', tex: 'none',
        },
    },
    {
        id: 'tut', nom: 'Tut',
        d: '"Sora",system-ui,sans-serif', s: '"Manrope",system-ui,sans-serif',
        r: 18, cr: 999, sw: ['#B34ACF', '#E85D9E'],
        dark: {
            bg: '#150D18', card: '#211326', line: 'rgba(230,180,240,.13)', text: '#F6EEF8',
            muted: '#AE95B8', soft: 'rgba(179,74,207,.16)', accent: 'oklch(0.66 0.18 330)',
            accent2: 'oklch(0.7 0.17 355)', aInk: '#fff',
            tex: 'radial-gradient(520px 300px at 50% -100px, oklch(0.5 0.18 330 / .35), transparent 70%)',
        },
        light: {
            bg: '#FAF2FA', card: '#FFFFFF', line: '#EFDDF0', text: '#2A1430',
            muted: '#8A6C96', soft: 'rgba(179,74,207,.09)', accent: 'oklch(0.52 0.2 330)',
            accent2: 'oklch(0.58 0.19 355)', aInk: '#fff',
            tex: 'radial-gradient(520px 300px at 50% -100px, oklch(0.82 0.08 330 / .5), transparent 70%)',
        },
    },
];

export const getCatalogTheme = (id) =>
    CATALOG_THEMES.find((x) => x.id === id) || CATALOG_THEMES[0];

/** CSS custom properties for one theme + mode — spread onto the menu root. */
export const themeVars = (theme, mode) => {
    const th = typeof theme === 'string' ? getCatalogTheme(theme) : (theme || CATALOG_THEMES[0]);
    const P = th[mode === 'light' ? 'light' : 'dark'];
    return {
        '--bg': P.bg, '--card': P.card, '--line': P.line, '--text': P.text,
        '--muted': P.muted, '--soft': P.soft, '--accent': P.accent, '--a2': P.accent2,
        '--aink': P.aInk, '--grad': `linear-gradient(135deg, ${P.accent}, ${P.accent2})`,
        '--r': `${th.r}px`, '--rs': `${Math.max(9, th.r - 7)}px`, '--rc': `${th.cr}px`,
        '--display': th.d, '--sans': th.s,
    };
};

/** Background texture layer props for one theme + mode. */
export const themeTexture = (theme, mode) => {
    const th = typeof theme === 'string' ? getCatalogTheme(theme) : (theme || CATALOG_THEMES[0]);
    const P = th[mode === 'light' ? 'light' : 'dark'];
    return {
        backgroundImage: P.tex && P.tex !== 'none' ? P.tex : 'none',
        backgroundSize: P.texSize || 'auto',
    };
};
