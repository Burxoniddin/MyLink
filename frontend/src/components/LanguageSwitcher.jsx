import React from 'react';
import { useTranslation } from 'react-i18next';

const LANGS = [
    { code: 'uz', label: "O'z" },
    { code: 'ru', label: 'Ру' },
    { code: 'en', label: 'En' },
];

const wrapStyle = {
    display: 'inline-flex',
    gap: 2,
    background: 'rgba(0,0,0,0.06)',
    borderRadius: 8,
    padding: 2,
};

const btnStyle = (active) => ({
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 600,
    padding: '4px 8px',
    borderRadius: 6,
    background: active ? '#fff' : 'transparent',
    color: active ? '#4f46e5' : 'inherit',
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
    transition: 'all 0.15s',
});

const LanguageSwitcher = ({ style }) => {
    const { i18n } = useTranslation();

    const change = (code) => {
        i18n.changeLanguage(code);
        localStorage.setItem('mylink-lang', code);
    };

    return (
        <div style={{ ...wrapStyle, ...style }} className="lang-switcher">
            {LANGS.map((l) => (
                <button
                    key={l.code}
                    type="button"
                    style={btnStyle(i18n.language === l.code)}
                    onClick={() => change(l.code)}
                >
                    {l.label}
                </button>
            ))}
        </div>
    );
};

export default LanguageSwitcher;
