import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaBookOpen } from 'react-icons/fa';
import { getLinkIcon, getBrandColor } from '../../lib/linkIcons';
import { TEMPLATE_META } from './templateMeta';
import Highlights from '../Highlights';
import VerifiedBadge from '../VerifiedBadge';
import './templates.css';

const ChevIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
);
const initials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'M';

const ProfileTemplate = ({ data, tpl, theme, onLinkClick = () => {}, getLogoUrl, toEmbed, t, previewMode = false }) => {
    const meta = TEMPLATE_META[tpl] || {};
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setReady(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const logo = getLogoUrl(data.logo);
    const sections = data.media_sections || [];
    const links = data.links || [];
    const linkClick = (link) => (e) => {
        if (previewMode) {
            e.preventDefault();
            return;
        }
        onLinkClick(link.title);
    };

    return (
        <div className={`tpl ${ready ? 'ready' : ''}`} data-tpl={tpl} data-theme={theme}>
            <main className="tpl-card">
                <div className="tpl-avatar">
                    {logo ? <img className="tpl-avatar-img" src={logo} alt={data.name} /> : initials(data.name)}
                </div>

                <h1 className="tpl-name">
                    {data.name}
                    {data.verified && <VerifiedBadge size="0.62em" />}
                </h1>

                {data.description && <p className="tpl-bio">{data.description}</p>}
                {meta.rule && <div className="tpl-rule" />}

                <Highlights sections={sections} getMediaUrl={getLogoUrl} toEmbed={toEmbed} />

                {/* MyCatalog: featured web-menu button, styled per template archetype */}
                {data.has_catalog && (
                    <Link
                        to={`/${data.path}/menu`}
                        className={`tpl-menu is-${meta.menuBtn || 'soft'}`}
                        onClick={(e) => {
                            if (previewMode) { e.preventDefault(); return; }
                            onLinkClick(data.catalog_label || t('landing.menu_button'));
                        }}
                    >
                        {meta.menuBtn !== 'line' && (
                            <span className="tpl-menu-ico"><FaBookOpen /></span>
                        )}
                        <span className="tpl-menu-lbl">{data.catalog_label || t('landing.menu_button')}</span>
                        <span className="tpl-menu-chev" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round">
                                <path d={meta.menuBtn === 'line' ? 'M4 12h16m-6-6 6 6-6 6' : 'M9 6l6 6-6 6'} />
                            </svg>
                        </span>
                        {meta.menuBtn === 'flame' && <span className="tpl-menu-sheen" />}
                    </Link>
                )}

                <nav className="tpl-links">
                    {links.map((link, i) => (
                        <a
                            key={link.id ?? i}
                            className="tpl-lnk"
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={linkClick(link)}
                            style={{
                                '--d': `${0.04 * (i + 1)}s`,
                                ...(meta.perLinkColor ? { '--bc': getBrandColor(link.icon_type) } : {}),
                            }}
                        >
                            <span className="tpl-ico">{getLinkIcon(link.icon_type)}</span>
                            <span className="tpl-lbl">{link.title}</span>
                            {meta.chev && <span className="tpl-chev"><ChevIcon /></span>}
                        </a>
                    ))}
                </nav>

                {links.length === 0 && sections.length === 0 && !data.has_catalog && (
                    <div className="tpl-empty">{t('landing.no_links')}</div>
                )}
            </main>

            {/* Platform badge — outside the business card frame on purpose. */}
            {!data.branding_removed && (
                <div className="tpl-powered">
                    <a href="https://mylink.asia" target="_blank" rel="noopener noreferrer">
                        {t('landing.powered_by')}
                        <span className="mklogo"><span className="mk"><img src="/brand/appicon-192.png" alt="" /></span>MyLink</span>
                    </a>
                </div>
            )}
        </div>
    );
};

export default ProfileTemplate;
