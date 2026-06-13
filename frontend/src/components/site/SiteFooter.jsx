import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Marketing site footer, shared by the landing and CMS pages.
const SiteFooter = () => {
    const { t } = useTranslation();
    const location = useLocation();
    const onHome = location.pathname === '/';

    const anchor = (hash, label) =>
        onHome
            ? <a key={hash} href={`#${hash}`}>{label}</a>
            : <Link key={hash} to={`/#${hash}`}>{label}</Link>;

    return (
        <footer>
            <div className="wrap">
                <div className="foot-grid">
                    <div>
                        <Link className="brand" to="/"><span className="glyph"></span> Mylink</Link>
                        <p>{t('home.footer_tagline')}</p>
                    </div>
                    <div className="foot-col">
                        <h4>{t('home.footer_product')}</h4>
                        {anchor('about', t('home.nav_about'))}
                        {anchor('how', t('home.nav_how'))}
                        {anchor('pricing', t('home.nav_pricing'))}
                    </div>
                    <div className="foot-col">
                        <h4>{t('home.footer_company')}</h4>
                        <Link to="/about">{t('home.footer_about_us')}</Link>
                        <Link to="/blog">{t('home.footer_blog')}</Link>
                        {anchor('contact', t('home.nav_contact'))}
                    </div>
                    <div className="foot-col">
                        <h4>{t('home.footer_legal')}</h4>
                        <Link to="/privacy">{t('home.footer_privacy')}</Link>
                        <Link to="/terms">{t('home.footer_terms')}</Link>
                    </div>
                </div>
                <div className="foot-bottom">
                    <span>© {new Date().getFullYear()} Mylink.asia</span>
                    <span>{t('home.footer_madein')}</span>
                </div>
            </div>
        </footer>
    );
};

export default SiteFooter;
