import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import LinkButton from '../components/LinkButton';
import { FaLink, FaSun, FaMoon } from 'react-icons/fa';

// Backend base URL for media files - auto detect based on environment
const MEDIA_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:8000'
    : 'https://api.mylink.asia';

const LandingPage = () => {
    const { path } = useParams();
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
            } catch (err) {
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

    if (loading) {
        return (
            <div className={`landing-page ${theme === 'light' ? 'light-theme' : ''}`}>
                <div className="landing-loading">
                    <div className="landing-spinner"></div>
                    <p>Yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`landing-page ${theme === 'light' ? 'light-theme' : ''}`}>
                <div className="landing-error">
                    <div className="error-icon">🔍</div>
                    <h2>Sahifa topilmadi</h2>
                    <p>Siz qidirgan sahifa mavjud emas.</p>
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

                    <h1 className="landing-title">{data.name}</h1>

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
                {(!data.links || data.links.length === 0) && (
                    <div className="landing-empty">
                        <div className="empty-icon">🔗</div>
                        <p>Hali havolalar qo'shilmagan</p>
                    </div>
                )}

                {/* Footer */}
                <div className="landing-branding">
                    <a href="https://mylink.asia" target="_blank" rel="noopener noreferrer" className="landing-branding-link">
                        <span className="powered-text">Powered by</span>
                        <img src="/logo.png" alt="MyLink" className="landing-brand-logo" />
                        <strong>MyLink</strong>
                    </a>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
