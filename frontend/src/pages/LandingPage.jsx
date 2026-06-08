import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import LinkButton from '../components/LinkButton';
import { FaSun, FaMoon, FaCheckCircle } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';

// Backend base URL for media files - auto detect based on environment
const MEDIA_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://api.mylink.asia';

const LandingPage = () => {
    const { path } = useParams();
    const { t } = useTranslation();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('mylink-theme') || 'dark';
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await api.get(`public/${path}/`);
                setData(res.data);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [path]);

    // Save theme to localStorage when it changes
    useEffect(() => {
        localStorage.setItem('mylink-theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Helper function to get full logo URL
    const getLogoUrl = (logo) => {
        if (!logo) return null;
        // If logo already has http/https, return as is
        if (logo.startsWith('http://') || logo.startsWith('https://')) {
            return logo;
        }
        // Otherwise, prepend backend base URL
        return `${MEDIA_BASE_URL}${logo}`;
    };

    // Convert a YouTube watch/short URL to an embeddable URL; pass others through.
    const toEmbed = (url) => {
        if (!url) return '';
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
        return yt ? `https://www.youtube.com/embed/${yt[1]}` : url;
    };

    if (loading) {
        return (
            <div className={`landing-page ${theme === 'light' ? 'light-theme' : ''}`}>
                <div className="landing-loading">
                    <div className="landing-spinner"></div>
                    <p>{t('common.loading')}</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`landing-page ${theme === 'light' ? 'light-theme' : ''}`}>
                <div className="landing-error">
                    <div className="error-icon">🔍</div>
                    <h2>{t('landing.not_found_title')}</h2>
                    <p>{t('landing.not_found_desc')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`landing-page ${theme === 'light' ? 'light-theme' : ''}`}>
            {/* Animated background */}
            <div className="landing-bg-gradient"></div>

            {/* Theme Toggle Button */}
            <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}>
                {theme === 'dark' ? <FaSun /> : <FaMoon />}
            </button>

            {/* Main content card */}
            <div className="landing-card fade-in-up">
                {/* Profile section */}
                <div className="landing-profile">
                    {/* Only show logo if it exists */}
                    {data.logo && (
                        <div className="landing-avatar-wrapper">
                            <img
                                src={getLogoUrl(data.logo)}
                                alt={data.name}
                                className="landing-avatar"
                            />
                            <div className="landing-avatar-ring"></div>
                        </div>
                    )}

                    <h1 className="landing-title">
                        {data.name}
                        {data.verified && (
                            <FaCheckCircle
                                title="Verified"
                                style={{ color: '#3b82f6', marginLeft: 8, verticalAlign: 'middle', fontSize: '0.7em' }}
                            />
                        )}
                    </h1>

                    {data.description && (
                        <p className="landing-bio">{data.description}</p>
                    )}
                </div>

                {/* Links section */}
                <div className="landing-links">
                    {data.links && data.links.map((link, index) => (
                        <LinkButton key={link.id} link={link} index={index} />
                    ))}
                </div>

                {/* Empty state */}
                {(!data.links || data.links.length === 0) && (!data.content_blocks || data.content_blocks.length === 0) && (
                    <div className="landing-empty">
                        <div className="empty-icon">🔗</div>
                        <p>{t('landing.no_links')}</p>
                    </div>
                )}

                {/* Content blocks (banners / video / text) */}
                {data.content_blocks && data.content_blocks.length > 0 && (
                    <div className="landing-blocks">
                        {data.content_blocks.map((b) => (
                            <div key={b.id} className="landing-block">
                                {b.title && <h3 className="landing-block-title">{b.title}</h3>}
                                {b.block_type === 'text' && b.text && (
                                    <p className="landing-block-text">{b.text}</p>
                                )}
                                {b.block_type === 'image' && b.image && (
                                    <img src={getLogoUrl(b.image)} alt={b.title || ''} className="landing-block-img" />
                                )}
                                {b.block_type === 'video' && (
                                    b.video ? (
                                        <video src={getLogoUrl(b.video)} controls className="landing-block-video" />
                                    ) : b.embed_url ? (
                                        <div className="landing-block-embed">
                                            <iframe src={toEmbed(b.embed_url)} title={b.title || 'video'} allowFullScreen />
                                        </div>
                                    ) : null
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Footer — hidden for paid tiers (branding_removed) */}
                {!data.branding_removed && (
                    <div className="landing-branding">
                        <a href="https://mylink.asia" target="_blank" rel="noopener noreferrer" className="landing-branding-link">
                            <span className="powered-text">{t('landing.powered_by')}</span>
                            <img src="/logo.png" alt="MyLink" className="landing-brand-logo" />
                            <strong>MyLink</strong>
                        </a>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LandingPage;
