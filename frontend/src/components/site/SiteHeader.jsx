import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const LANGS = [['uz', 'UZ'], ['ru', 'RU'], ['en', 'EN']];

// Marketing site header (landing + CMS pages). Sticky; section anchors work
// from any page by routing back to the landing with a hash.
const SiteHeader = () => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const onHome = location.pathname === '/';
    const isLoggedIn = !!localStorage.getItem('token');
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const changeLang = (code) => {
        i18n.changeLanguage(code);
        localStorage.setItem('mylink-lang', code);
    };

    const anchor = (hash, label) =>
        onHome
            ? <a key={hash} href={`#${hash}`}>{label}</a>
            : <Link key={hash} to={`/#${hash}`}>{label}</Link>;

    return (
        <header className={`lp-header${scrolled ? ' scrolled' : ''}`}>
            <div className="wrap nav">
                <Link className="brand" to="/"><span className="glyph"></span> Mylink</Link>
                <nav className="nav-links">
                    {anchor('about', t('home.nav_about'))}
                    {anchor('how', t('home.nav_how'))}
                    {anchor('features', t('home.feats_eyebrow'))}
                    {anchor('pricing', t('home.nav_pricing'))}
                    <Link to="/blog">{t('home.footer_blog')}</Link>
                    {anchor('contact', t('home.nav_contact'))}
                </nav>
                <div className="nav-right">
                    <div className="lang">
                        {LANGS.map(([code, label]) => (
                            <button key={code} className={i18n.language === code ? 'is-active' : ''} onClick={() => changeLang(code)}>{label}</button>
                        ))}
                    </div>
                    {isLoggedIn ? (
                        <Link to="/dashboard" className="btn btn-primary">{t('home.dashboard')}</Link>
                    ) : (
                        <Link to="/login" className="btn btn-primary">{t('home.login')}</Link>
                    )}
                </div>
            </div>
        </header>
    );
};

export default SiteHeader;
