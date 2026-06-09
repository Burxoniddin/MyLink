// Colour palettes for the classic public template. `bg`/`accent` of `null` keep
// the original look (default). Each palette recolours the page background and the
// link buttons. Gated by the color_edit feature; chosen in the editor "Sozlash" tab.
export const PALETTES = {
    default: { bg: null, accent: null, swatch: 'linear-gradient(165deg,#312e81,#0f0f1a)' },
    ocean: { bg: 'linear-gradient(165deg,#0b2545,#0f3d5e)', accent: '#0ea5e9', swatch: 'linear-gradient(165deg,#0b2545,#0f3d5e)' },
    forest: { bg: 'linear-gradient(165deg,#0c1f17,#14352a)', accent: '#16a34a', swatch: 'linear-gradient(165deg,#0c1f17,#14352a)' },
    noir: { bg: 'radial-gradient(circle at 50% 0%,#1c1c20,#070708 75%)', accent: '#52525b', swatch: 'radial-gradient(circle at 50% 0%,#2a2a30,#0a0a0a 75%)' },
    rose: { bg: 'linear-gradient(165deg,#2a0f1f,#3d1330)', accent: '#e11d6b', swatch: 'linear-gradient(165deg,#2a0f1f,#3d1330)' },
    sunset: { bg: 'linear-gradient(165deg,#2a160b,#3d2413)', accent: '#f97316', swatch: 'linear-gradient(165deg,#2a160b,#3d2413)' },
};

export const PALETTE_IDS = ['default', 'ocean', 'forest', 'noir', 'rose', 'sunset'];

export const getPalette = (id) => PALETTES[id] || PALETTES.default;
