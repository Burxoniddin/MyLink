import React, { useEffect, useState } from 'react';
import { FaCheckCircle } from 'react-icons/fa';
import { getLinkIcon, getBrandColor } from '../../lib/linkIcons';
import { TEMPLATE_META } from './templateMeta';
import Highlights from '../Highlights';
import './templates.css';

const SunIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
    </svg>
);
const MoonIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z" /></svg>
);
const ShareIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
);
const ChevIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
);
const MkIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10.6 13.4a4 4 0 0 1 0-5.6l2.8-2.8a4 4 0 1 1 5.6 5.6l-1.4 1.4-1.4-1.4 1.4-1.4a2 2 0 1 0-2.8-2.8l-2.8 2.8a2 2 0 0 0 0 2.8zm2.8-2.8a4 4 0 0 1 0 5.6l-2.8 2.8a4 4 0 1 1-5.6-5.6l1.4-1.4 1.4 1.4-1.4 1.4a2 2 0 1 0 2.8 2.8l2.8-2.8a2 2 0 0 0 0-2.8z" /></svg>
);

const initials = (name = '') =>
    name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || 'M';

const ProfileTemplate = ({ data, tpl, theme, onToggleTheme, onShare, onLinkClick, getLogoUrl, toEmbed, t }) => {
    const meta = TEMPLATE_META[tpl] || {};
    const [ready, setReady] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setReady(true));
        return () => cancelAnimationFrame(id);
    }, []);

    const logo = getLogoUrl(data.logo);
    const blocks = data.content_blocks || [];
    const links = data.links || [];

    return (
        <div className={`tpl ${ready ? 'ready' : ''}`} data-tpl={tpl} data-theme={theme}>
            <button className="tpl-share" onClick={onShare} title={t('detail.share')} aria-label={t('detail.share')}>
                <ShareIcon />
            </button>
            <button className="tpl-toggle" onClick={onToggleTheme} aria-label="Theme">
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <main className="tpl-card">
                <div className="tpl-avatar">
                    {logo ? <img className="tpl-avatar-img" src={logo} alt={data.name} /> : initials(data.name)}
                </div>

                {meta.statusBadge && (
                    <div className="tpl-badge"><span className="dot" />{t('tpl.open_today')}</div>
                )}

                <h1 className="tpl-name">
                    {data.name}
                    {data.verified && <FaCheckCircle className="tpl-verified" title="Verified" />}
                </h1>

                {data.description && <p className="tpl-bio">{data.description}</p>}
                {meta.rule && <div className="tpl-rule" />}

                <Highlights blocks={blocks} getMediaUrl={getLogoUrl} toEmbed={toEmbed} />

                <nav className="tpl-links">
                    {links.map((link, i) => (
                        <a
                            key={link.id}
                            className="tpl-lnk"
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => onLinkClick(link.title)}
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

                {links.length === 0 && blocks.length === 0 && (
                    <div className="tpl-empty">{t('landing.no_links')}</div>
                )}

                {!data.branding_removed && (
                    <div className="tpl-powered">
                        <a href="https://mylink.asia" target="_blank" rel="noopener noreferrer">
                            {t('landing.powered_by')}
                            <span className="mklogo"><span className="mk"><MkIcon /></span>MyLink</span>
                        </a>
                    </div>
                )}
            </main>
        </div>
    );
};

export default ProfileTemplate;
