import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { FaTelegramPlane } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import api from '../api';
import './HelpCTA.css';

// Fallback until admin sets support_telegram_url in SiteSettings.
const FALLBACK_URL = 'https://t.me/mylink_asia';

// Known top-level platform routes. A single-segment path NOT in this set is a
// public business card (/:path) — we hide the platform Help button there.
const KNOWN = new Set([
    'login', 'register', 'forgot-password', 'reset-password',
    'dashboard', 'profile', 'analytics', 'referral', 'pricing',
    'about', 'privacy', 'terms', 'blog', 'business',
]);

const shouldShow = (pathname) => {
    const seg = pathname.split('/').filter(Boolean);
    if (seg.length === 0) return true;            // home
    if (seg.length === 1) return KNOWN.has(seg[0]); // hide on /:businessPath
    return true;                                   // /business/*, /blog/*, ...
};

const HelpCTA = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const [url, setUrl] = useState(FALLBACK_URL);

    useEffect(() => {
        api.get('public/settings/')
            .then((r) => { if (r.data?.support_telegram_url) setUrl(r.data.support_telegram_url); })
            .catch(() => {});
    }, []);

    if (!shouldShow(location.pathname)) return null;

    return (
        <a href={url} target="_blank" rel="noreferrer" className="help-cta" title={t('help.title')} aria-label={t('help.title')}>
            <FaTelegramPlane />
            <span className="help-cta-label">{t('help.label')}</span>
        </a>
    );
};

export default HelpCTA;
