import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaGlobe, FaCheck } from 'react-icons/fa';
import './LanguageSwitcher.css';

const LANGS = [
    { code: 'uz', short: "O'z", label: "O'zbekcha" },
    { code: 'ru', short: 'Ру', label: 'Русский' },
    { code: 'en', short: 'En', label: 'English' },
];

/** Compact language dropdown — three inline buttons made the navbar too busy. */
const LanguageSwitcher = ({ style, className = '' }) => {
    const { i18n, t } = useTranslation();
    const [open, setOpen] = useState(false);
    const wrap = useRef(null);

    const current = LANGS.find((l) => l.code === i18n.language) || LANGS[0];

    useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('pointerdown', onDown);
        window.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            window.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const change = (code) => {
        i18n.changeLanguage(code);
        localStorage.setItem('mylink-lang', code);
        setOpen(false);
    };

    return (
        <div className={`lang-dd ${className}`} style={style} ref={wrap}>
            <button
                type="button" className={`lang-dd-btn${open ? ' on' : ''}`}
                onClick={() => setOpen((v) => !v)}
                aria-haspopup="listbox" aria-expanded={open} aria-label={t('nav.language', 'Til')}
            >
                <FaGlobe className="lang-dd-globe" />
                <span>{current.short}</span>
                <svg className="lang-dd-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                </svg>
            </button>
            {open && (
                <ul className="lang-dd-menu" role="listbox">
                    {LANGS.map((l) => (
                        <li key={l.code}>
                            <button
                                type="button" role="option" aria-selected={l.code === current.code}
                                className={l.code === current.code ? 'on' : ''}
                                onClick={() => change(l.code)}
                            >
                                <span>{l.label}</span>
                                {l.code === current.code && <FaCheck className="lang-dd-check" />}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default LanguageSwitcher;
