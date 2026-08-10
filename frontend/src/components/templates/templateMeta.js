// Per-template behaviour flags (visual specifics live in templates.css).
export const TEMPLATE_META = {
    restoran: { defaultTheme: 'dark', perLinkColor: true },
    moda: { defaultTheme: 'light', rule: true },
    klinika: { defaultTheme: 'light' },
    avto: { defaultTheme: 'dark', chev: true },
    fitnes: { defaultTheme: 'dark', chev: true },
};

// id + a small preview palette (matches templates.css). Order matters: the
// tier feature `templates` unlocks the first N entries (backend gates the same
// order). Used by the editor TemplatePicker and the new-business wizard preview.
export const TEMPLATE_OPTIONS = [
    { id: 'classic', accent: '#6366f1', bg: '#0f1020', surface: '#1c1d33' },
    { id: 'restoran', accent: '#f0a23c', bg: '#160f0b', surface: '#2e2017' },
    { id: 'moda', accent: '#9c8466', bg: '#f3efe7', surface: '#faf8f3', light: true },
    { id: 'klinika', accent: '#2aa79f', bg: '#eef6f6', surface: '#ffffff', light: true },
    { id: 'avto', accent: '#e11d2a', bg: '#0a0b0e', surface: '#1c2028' },
    { id: 'fitnes', accent: '#b6f23a', bg: '#0b0c0a', surface: '#1c1f18' },
];
